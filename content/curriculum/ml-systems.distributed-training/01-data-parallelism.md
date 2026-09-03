---
title: Data parallelism
minutes: 19
summary: The default way to use many GPUs, the all-reduce that costs, and why scaling is sublinear.
---

Data parallelism is the first and usually the right way to use more than one GPU:
every device holds a full copy of the model, processes a different slice of the
batch, and they synchronise gradients each step. It scales well until
communication becomes the constraint, and understanding exactly when that happens
is what this chapter is for.

## The mechanism

```text
  each step:

  GPU 0   model copy   batch slice 0  ──▶ gradients_0 ─┐
  GPU 1   model copy   batch slice 1  ──▶ gradients_1 ─┤
  GPU 2   model copy   batch slice 2  ──▶ gradients_2 ─┼─▶ ALL-REDUCE
  GPU 3   model copy   batch slice 3  ──▶ gradients_3 ─┘   (average)
                                                            │
  every GPU applies the SAME averaged gradient ◀────────────┘
  → the model copies stay identical
```

The invariant that makes it correct: **all replicas must remain bit-identical**.
They start identical and apply the same averaged gradient, so they stay identical.
Anything that breaks that — a rank with different data ordering affecting batch
norm, a non-deterministic reduction differing per rank, a dropped all-reduce —
causes silent divergence between replicas, which is one of the harder bugs in this
area.

## Effective batch size

```text
  effective batch = per_device_batch × num_devices × accumulation_steps

  8 GPUs × 32 per device = 256

  → this is a DIFFERENT EXPERIMENT from batch 32.
  → the learning rate almost certainly needs to change.
```

This is the most common mistake when moving from one GPU to many, and it produces
the misleading conclusion "distributed training made the model worse".

```text
  LINEAR SCALING RULE   lr ∝ batch size, with warmup
                        → the standard recipe for vision

  SQRT SCALING          lr ∝ √batch
                        → often better for transformers

  either way: WARMUP is essential at large batch. going
  straight to a scaled LR with a random initialisation
  usually diverges.
```

There is also a limit. Past some critical batch size, larger batches stop
improving convergence per sample — you get more throughput and need proportionally
more steps' worth of data for the same result. The critical batch size is
task-dependent and worth measuring before buying more GPUs to grow the batch.

## All-reduce

```text
  every rank has a gradient vector.
  every rank must end with the SUM (then divided by N).
```

The naive implementations are bad:

```text
  ALL-TO-ALL       every rank sends to every rank
                   → N² messages

  PARAMETER SERVER a central rank collects and redistributes
                   → the server's bandwidth is the bottleneck
                   → and it is a single point of failure
```

**Ring all-reduce** is what is actually used:

```text
  ranks arranged in a ring; the gradient split into N chunks

  PHASE 1 — reduce-scatter (N-1 steps)
    each step, each rank sends one chunk to its neighbour and
    adds the chunk it receives
    → after N-1 steps, each rank holds the FULLY REDUCED
      value for ONE chunk

  PHASE 2 — all-gather (N-1 steps)
    each step, each rank passes its completed chunk around
    → after N-1 steps, every rank has every chunk
```

```text
  data sent per rank = 2 × (N-1)/N × gradient_size
                     ≈ 2 × gradient_size,  INDEPENDENT OF N
```

That independence is the key property: **ring all-reduce's per-rank bandwidth
cost does not grow with the number of ranks.** Its *latency* does — 2(N−1) steps —
which is why very large clusters use hierarchical or tree algorithms that trade
bandwidth for fewer hops.

## The scaling limit

```text
  time per step = compute + communication

  compute       scales DOWN with more GPUs (less data each)
  communication is roughly CONSTANT (ring property)

  → the communication fraction grows until it dominates
```

```text
  efficiency
     │ ────────╲
     │          ╲___
     │              ╲____
     │                   ╲_____
     └────────────────────────────▶ number of GPUs

  the knee is where communication ≈ compute
```

The arithmetic worth doing before scaling out:

```text
  a 1B-parameter model, bf16 gradients = 2 GB
  ring all-reduce sends ~2 × 2 GB = 4 GB per rank per step

  over NVLink (600 GB/s):     ~7 ms
  over 100 GbE (12.5 GB/s):   ~320 ms

  if a step's compute is 100 ms:
    NVLink      → 7% overhead. fine.
    100 GbE     → 320 ms of communication on 100 ms of compute.
                  76% of the time is waiting.
```

**Interconnect is the deciding factor**, not GPU count — which is why the
scheduling chapter insisted that topology matters as much as cards.

## Overlapping communication with compute

The optimisation that makes data parallelism practical.

```text
  NAIVE — gradients all-reduced after the full backward pass

    backward ████████████████  all-reduce ██████████
    → strictly serial

  BUCKETED — all-reduce each bucket as soon as its gradients
             are ready

    backward ████████████████
    reduce      ███ ███ ███ ███
    → communication overlaps with the rest of the backward pass
```

The backward pass computes gradients from the last layer to the first, so the last
layer's gradients are ready long before the first layer's. Bucketing sends them
immediately rather than waiting for the whole pass.

```text
  bucket size tuning

  too small  → many small messages; latency and launch
               overhead dominate
  too large  → less overlap; you wait for a big bucket to fill

  typical: 25–100 MB. this is DDP's bucket_cap_mb.
```

This is why PyTorch DDP is much faster than the older DataParallel, and it is
usually enabled by default — but the bucket size is worth tuning on a slow
interconnect.

## The practical API

```python
# torchrun --nproc_per_node=8 train.py
dist.init_process_group("nccl")
torch.cuda.set_device(local_rank)

model = DDP(model.to(local_rank), device_ids=[local_rank],
            gradient_as_bucket_view=True)

sampler = DistributedSampler(dataset)   # DISJOINT shards per rank
for epoch in range(epochs):
    sampler.set_epoch(epoch)            # ← or every epoch is
                                        #   shuffled identically
    for batch in loader:
        loss = model(batch)
        loss.backward()                 # all-reduce happens here
        optimizer.step(); optimizer.zero_grad()
```

Two lines with outsized importance:

**`sampler.set_epoch(epoch)`** — without it, `DistributedSampler` uses the same
shuffle seed every epoch, so every epoch presents the data in exactly the same
order. Training still works and is measurably worse, with nothing indicating why.

**`DistributedSampler`** itself — omitting it means every rank trains on the whole
dataset, so the effective epoch is N times the data with N duplicate copies per
step. The loss curve looks plausible.

## Batch normalisation

```text
  batch norm computes statistics over the LOCAL batch on
  each device.

  8 GPUs × batch 4 = "batch 32", but each BN layer sees
  only 4 samples.

  → noisy statistics, and behaviour that changes with the
    number of GPUs
```

The fix is `SyncBatchNorm`, which all-reduces the statistics — correct, and an
extra communication per BN layer. For small per-device batches it is necessary; at
larger per-device batches the local statistics are fine.

This is one reason transformer architectures, which use LayerNorm (purely
per-sample), are easier to scale than convolutional ones.

## Common failures

```text
  □  ranks see the same data           → no DistributedSampler
  □  identical shuffling every epoch   → no set_epoch
  □  loss differs across ranks         → normal for the local
                                         loss; the GRADIENT must
                                         be identical after
                                         all-reduce
  □  a hang at an all-reduce           → one rank died, or ranks
                                         disagree about which
                                         collective to run
                                         (a conditional branch
                                         that differs per rank)
  □  NCCL timeout                      → a straggler, or a real
                                         hang. set the timeout
                                         explicitly.
  □  works on 1 GPU, diverges on 8     → LR not rescaled
```

The conditional-collective bug deserves a note: any `if` that causes some ranks to
call a collective and others not will hang forever, because collectives must be
called by every rank in the same order. Logging or checkpointing "only on rank 0"
is fine; *reducing* only on rank 0 is a deadlock.

## What to take away

1. Data parallelism replicates the model, splits the batch, and all-reduces
   gradients — replicas must stay bit-identical.
2. More devices means a larger effective batch, which is a different experiment
   and needs the learning rate rescaled with warmup.
3. Ring all-reduce's per-rank bandwidth cost is independent of rank count; its
   latency is not.
4. Interconnect decides the scaling limit — the same model can be 7% or 76%
   communication depending on NVLink versus Ethernet.
5. Bucketed overlap of all-reduce with the backward pass is what makes data
   parallelism practical; tune the bucket size on slow links.
6. `DistributedSampler` and `set_epoch` are two lines whose omission silently
   degrades training, and a conditional collective hangs forever.

Next: what to do when the model does not fit — sharding the optimizer state.
