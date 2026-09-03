---
title: Keeping the accelerator busy
minutes: 19
summary: The one metric that matters in training infrastructure, and the four things that starve it.
---

A GPU costs between one and forty dollars an hour. A training job that keeps it
40% busy is throwing away most of that, and 40% is a very common number for jobs
nobody has profiled. Training infrastructure is, almost entirely, the discipline
of keeping the expensive part fed.

## The metric

```text
  GPU UTILISATION        the fraction of time a kernel is running
                         → what nvidia-smi shows
                         → necessary and NOT sufficient

  MODEL FLOPS
  UTILISATION (MFU)      achieved FLOPs ÷ the hardware's peak
                         → the honest number
```

The distinction matters. `nvidia-smi` showing 100% means "a kernel is executing",
not "useful work at full rate" — a memory-bound kernel reads and writes at full
occupancy while doing almost no arithmetic.

```text
  realistic MFU targets

    large transformer training, well-tuned    40–55%
    a reasonably optimised job                30–40%
    typical unoptimised training              10–20%
    something is badly wrong                  <10%
```

MFU is worth computing even roughly: `6 × parameters × tokens` is the standard
approximation for transformer training FLOPs, divided by elapsed time, divided by
the GPU's peak. A number under 20% means there is a large, findable problem.

## The four ways the GPU starves

```text
  ┌────────────────────────────────────────────────────────┐
  │  1. DATA LOADING     the GPU waits for the next batch  │
  │  2. COMMUNICATION    the GPU waits for other GPUs      │
  │  3. SYNCHRONISATION  the GPU waits for the CPU         │
  │  4. SMALL KERNELS    the GPU is busy but not with maths│
  └────────────────────────────────────────────────────────┘
```

```text
  timeline of a starved job

  GPU  ▓▓░░░░░░▓▓░░░░░░▓▓░░░░░░▓▓░░░░░░      25% busy
  CPU  ░░▓▓▓▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓▓▓      loading data

  timeline of a healthy job

  GPU  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      95% busy
  CPU  ░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░▓      prefetching ahead
```

## Diagnosing which one

Before optimising anything, find out which of the four it is:

```text
  □  RUN WITH SYNTHETIC DATA
       replace the dataloader with a tensor generator.
       if throughput jumps → it is DATA LOADING.
       this one test is the highest-value diagnostic here.

  □  RUN ON ONE GPU vs MANY
       if per-GPU throughput drops badly with more GPUs
       → it is COMMUNICATION.

  □  PROFILE
       PyTorch profiler / Nsight Systems shows gaps in the GPU
       stream. a gap is the CPU not having queued work in time.

  □  CHECK FOR SYNCHRONISATION POINTS
       .item(), .cpu(), print(loss), an if on a tensor value
       → each forces the CPU to wait for the GPU, draining the
         queue that keeps it busy
```

The synchronisation one is worth expanding because it is easy to write:

```text
  # this line, inside the training loop, is a stall
  if loss.item() > threshold:     ← blocks until the GPU finishes
      ...

  # and so is this
  print(f"loss: {loss}")          ← same

  # accumulate on the GPU and sync ONCE per N steps instead
  running_loss += loss.detach()
  if step % 100 == 0:
      log(running_loss.item() / 100)      # one sync per 100 steps
```

A `.item()` per step on a fast model can cost 20–30% of throughput, because it
empties the asynchronous queue the GPU relies on.

## Asynchronous execution, and why the queue matters

```text
  CUDA kernels are launched ASYNCHRONOUSLY.
  the CPU queues work; the GPU consumes it.

  CPU:  [launch][launch][launch][launch][launch] ──▶
  GPU:      [k1  ][k2  ][k3  ][k4  ][k5  ] ──▶
            the GPU is always working on queued kernels

  a synchronisation point empties the queue:

  CPU:  [launch][WAIT.................][launch]
  GPU:      [k1][k2]                    [k3]
                    └─ idle. the queue ran dry.
```

Keeping the queue full is the whole game. That means: no per-step syncs, a
dataloader that stays ahead, and kernels large enough that launch overhead is not
the bottleneck.

## Batch size

```text
  LARGER BATCH                       SMALLER BATCH
  ────────────                       ─────────────
  better GPU utilisation             fits in memory
  fewer optimiser steps              more gradient noise
    (less overhead per sample)         (sometimes helps
  more memory                          generalisation)
  may need LR rescaling              more steps for the same
                                       data
```

The practical procedure: **increase the batch size until you are near an
out-of-memory error, then back off**. Larger batches nearly always improve
utilisation, and the main constraint is memory.

**Gradient accumulation** decouples the effective batch size from what fits:

```text
  micro-batch 8, accumulate 4 steps → effective batch 32

  for i, batch in enumerate(loader):
      loss = model(batch) / ACCUM
      loss.backward()                  # gradients accumulate
      if (i + 1) % ACCUM == 0:
          optimizer.step()
          optimizer.zero_grad()
```

Note the `/ ACCUM` — forgetting it scales the effective learning rate by the
accumulation factor and is a classic silent bug.

**Learning rate scaling.** When batch size changes, the learning rate usually must
too. Linear scaling (`lr ∝ batch`) with a warmup is the standard recipe for
vision; square-root scaling is often better for transformers. Changing batch size
without touching the LR and concluding "the large batch was worse" is a very
common false conclusion.

## Memory: what actually occupies it

```text
  training a model with P parameters, mixed precision, Adam:

    parameters (bf16)          2P bytes
    gradients (bf16)           2P
    optimizer momentum (fp32)  4P
    optimizer variance  (fp32) 4P
    fp32 master weights        4P
    ─────────────────────────────────
    ~16P bytes BEFORE any activations

    a 7B model: ~112 GB of state. an 80 GB GPU cannot hold it.
```

**Optimizer state dominates**, which is exactly what ZeRO and FSDP shard, and the
reason a model that fits for inference does not fit for training.

Activations are the other half, and they scale with batch size and sequence
length — for transformers, attention activations scale with the *square* of
sequence length unless a memory-efficient attention kernel is used.

```text
  reducing memory, in order of what to try

  1. gradient (activation) CHECKPOINTING
       recompute activations in the backward pass instead of
       storing them
       → ~30% more compute, often 5–10× less activation memory
       → the single highest-leverage memory technique

  2. MIXED PRECISION           halves parameter and gradient memory
  3. SMALLER MICRO-BATCH + gradient accumulation
  4. an 8-bit OPTIMIZER        4P + 4P becomes 1P + 1P
  5. SHARDING across GPUs      the distributed-training topic
```

## Diagnosing memory

```text
  □  torch.cuda.max_memory_allocated() — the peak, which is
     what matters, not the current
  □  FRAGMENTATION — allocated is well below reserved, and you
     still OOM. varying sequence lengths cause this.
       → PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
  □  the OOM happens on the BACKWARD pass, so a forward pass
     that fits proves nothing
  □  memory GROWING over steps → you are retaining a graph.
     usually `total_loss += loss` without `.detach()`.
```

That last one is the most common memory bug in training code: accumulating a
tensor that still carries its computation graph keeps every step's activations
alive, and the job OOMs after a few hundred steps having looked fine at the start.

## A checklist before scaling out

More GPUs will not fix a job that wastes the one it has, and this is the mistake
that costs the most money:

```text
  □  MFU measured, not assumed
  □  synthetic-data test run — is it data-bound?
  □  no per-step .item() / .cpu() / print of a tensor
  □  batch size pushed near the memory limit
  □  mixed precision enabled
  □  gradient checkpointing if activations dominate
  □  the profiler shows no large gaps in the GPU stream
```

Doubling the GPUs on a job at 20% MFU buys 2× at 20%. Fixing the dataloader first
often buys 3× on the hardware you already have, at no cost.

## What to take away

1. MFU, not `nvidia-smi` utilisation, is the honest metric; under 20% means there
   is a large findable problem.
2. The four starvation causes are data loading, communication, CPU
   synchronisation and small kernels — the synthetic-data test identifies the first
   in minutes.
3. A per-step `.item()` empties the asynchronous kernel queue and can cost 20–30%
   of throughput.
4. Push batch size toward the memory limit; use gradient accumulation to decouple
   effective batch from what fits, and remember to divide the loss.
5. Optimizer state is roughly 16P bytes and dominates memory — activation
   checkpointing is the highest-leverage single technique.
6. Fix utilisation before adding GPUs; doubling hardware on a 20% MFU job buys
   2× of 20%.

Next: the data loading path, which is the most common answer to "why is my GPU
idle".
