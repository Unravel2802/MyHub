---
title: The data loading path
minutes: 18
summary: Feeding an accelerator that consumes gigabytes per second, and why small files are the enemy.
---

The most common answer to "why is my GPU at 30%" is the dataloader. An A100
processing images can consume several thousand samples per second; a naive Python
loop reading JPEGs from network storage delivers a few hundred. The gap is
entirely engineering.

## The pipeline

```text
  STORAGE ──▶ READ ──▶ DECODE ──▶ TRANSFORM ──▶ COLLATE ──▶ TRANSFER ──▶ GPU
     │          │         │            │            │           │
   network    syscalls   CPU          CPU         CPU        PCIe
   or disk               heavy        heavy                  bandwidth

  the SLOWEST stage sets the rate. find it before optimising.
```

Each stage has a characteristic failure:

```text
  READ       many small files → syscall and metadata overhead
                                dominates the bytes read
  DECODE     JPEG/PNG decode is expensive; often the true
             bottleneck for vision workloads
  TRANSFORM  Python-level augmentation, single-threaded
  COLLATE    copying and padding into a batch tensor
  TRANSFER   host-to-device copy, serialised with compute if
             not pinned and asynchronous
```

## The small-files problem

```text
  1,000,000 individual JPEGs on object storage

  per file:  a request, ~20–100 ms of latency, metadata
  → dominated by REQUESTS, not bytes
  → random access across a million objects also destroys any
    read-ahead the storage layer might do
```

The fix is **sharded sequential formats**: pack many samples into a few large
files and read them sequentially.

```text
  WebDataset  tar shards of ~1 GB, read as a stream
  TFRecord    protobuf records in large files
  Parquet     columnar; good for tabular and for metadata
  FFCV        a purpose-built format for vision throughput

  1,000,000 files  →  ~1,000 shards of 1,000 samples each
  random access    →  shuffle SHARDS, then shuffle a buffer
                      within them
```

The shuffle compromise is the important detail. True global shuffling requires
random access, which is what you gave up. **Shard shuffle plus a shuffle buffer**
gives adequate randomness:

```text
  1. shuffle the ORDER of shards each epoch
  2. read a shard sequentially into a buffer of N samples
  3. emit randomly from the buffer, refilling as you go

  buffer of 10,000 with 1,000 shards is statistically fine for
  most training. a buffer of 100 is not — samples from the same
  shard stay correlated within a batch.
```

## Parallelism and prefetching

```text
  num_workers          separate processes reading and transforming
  prefetch_factor      batches queued ahead per worker
  pin_memory           page-locked host memory → faster,
                       ASYNCHRONOUS host-to-device copy
  persistent_workers   do not tear down workers each epoch
```

```text
  torch.utils.data.DataLoader(
      dataset,
      batch_size=256,
      num_workers=8,           # start at ~4× GPUs, then tune
      prefetch_factor=4,
      pin_memory=True,
      persistent_workers=True, # epoch boundaries stop stalling
      drop_last=True,          # avoids a ragged final batch
  )
```

**More workers is not monotonically better.** Each is a process with a copy of the
dataset object; too many cause memory pressure, CPU contention with the main
process, and slower startup. Tune it — the curve usually rises, plateaus, then
falls.

Two specific traps:

```text
  □  WORKER STARTUP COST — without persistent_workers, every
     epoch pays process creation. on a small dataset with many
     epochs this is a large fraction of the run.

  □  COPY-ON-WRITE MEMORY BLOWUP — a Python list of a million
     objects in the dataset gets touched by refcounting in each
     forked worker, so pages are copied and memory multiplies
     by num_workers. store indices as a numpy array, not a
     list of Python objects.
```

That second one is a genuinely confusing production issue: memory grows with
worker count for a dataset that "should" be shared, and the cause is CPython's
reference counting writing to object headers.

## Moving work off the critical path

```text
  DO ONCE, OFFLINE                   DO PER EPOCH
  ────────────────                   ────────────
  resize to the training resolution  random crop
  parse and tokenize text            random flip / colour jitter
  compute static features            mixup / cutmix
  filter and deduplicate             anything that must vary

  → anything deterministic should be PRECOMPUTED
```

Decoding a 4000×3000 JPEG and resizing to 224×224 on every epoch, for every
epoch, is the classic waste. Pre-resizing the dataset once can be a 5–10×
throughput improvement for vision training, and it is a one-off cost.

**GPU-side augmentation** is the other lever: libraries like DALI and Kornia run
decode and augmentation on the GPU, removing the CPU bottleneck entirely at the
cost of some GPU time. Worth it when the CPU is the constraint and the GPU has
headroom — which the profiler will tell you.

## Overlapping transfer with compute

```text
  SERIALISED                         OVERLAPPED

  [copy][compute][copy][compute]     [copy][copy][copy][copy]
                                          [compute][compute]

  requires pinned memory + non_blocking=True + a separate
  CUDA stream for the copy
```

```text
  batch = batch.to(device, non_blocking=True)   # needs pin_memory
```

This is usually a modest gain relative to fixing the CPU path, but it is nearly
free once the memory is pinned.

## Streaming from object storage

For datasets too large to stage locally:

```text
  □  read SHARDS sequentially, with several in flight
  □  cache shards on local NVMe — the second epoch is then local
  □  overlap download with compute (prefetch the next shard)
  □  ensure each worker/rank reads a DISJOINT set of shards,
     or you waste bandwidth reading the same bytes N times
```

The last point is a common distributed-training bug: every rank streaming the
whole dataset and filtering locally, multiplying storage bandwidth by the number
of ranks. Shard assignment must be by rank.

## Measuring it

```text
  □  time the dataloader ALONE — iterate it with no model,
     measure samples/second. compare with what the GPU needs.
  □  the synthetic-data test from the previous chapter
  □  CPU utilisation across workers — pegged means CPU-bound
  □  disk/network throughput vs the storage limit
  □  a queue-depth metric if your loader exposes one
```

```text
  the arithmetic that settles it:

    GPU needs        2,000 samples/s
    dataloader gives   600 samples/s
    → the GPU is 30% utilised, and no model optimisation
      will change that
```

Doing this arithmetic first is the difference between a week of profiling the
model and an afternoon fixing the input pipeline.

## What to take away

1. The dataloader is the most common cause of GPU idling; time it alone and
   compare its rate to what the GPU consumes.
2. Millions of small files are dominated by request overhead — pack into large
   sequential shards and use shard shuffle plus a shuffle buffer.
3. Tune `num_workers`, and use `persistent_workers` and pinned memory; more
   workers is not monotonically better.
4. Store dataset indices as numpy arrays, not Python lists, or copy-on-write
   refcounting multiplies memory by worker count.
5. Precompute everything deterministic — pre-resizing images alone is often a
   5–10× win — and move augmentation to the GPU when the CPU is the constraint.
6. In distributed training, assign disjoint shards per rank or you multiply
   storage bandwidth by the number of ranks.

Next: checkpointing and surviving the failures that a long training run
guarantees.
