---
title: Reading a profile
minutes: 18
summary: Finding out what is actually slow, in the order that finds it fastest.
---

Every optimisation in the previous chapters is worthless applied to the wrong
thing. Profiling GPU code is different from profiling CPU code in one important
way — the asynchrony means naive timing lies — and knowing the tools' order of
use saves days.

## Why naive timing is wrong

```text
  start = time.time()
  output = model(x)              # returns IMMEDIATELY; the
  print(time.time() - start)     # kernels are still queued

  → measures the time to QUEUE the work, not to do it
```

```python
torch.cuda.synchronize()          # wait for the queue to drain
start = time.perf_counter()
output = model(x)
torch.cuda.synchronize()          # wait for the work to finish
elapsed = time.perf_counter() - start
```

And two more requirements for a trustworthy number:

```text
  □  WARM UP first — the first iterations include cuDNN
     autotuning, memory-pool growth and JIT compilation.
     discard 10–20 iterations.
  □  measure MANY iterations and take a median; GPU clocks
     vary with temperature and power state.
```

Alternatively use CUDA events, which measure on the device without a host sync:

```python
start, end = torch.cuda.Event(True), torch.cuda.Event(True)
start.record(); output = model(x); end.record()
torch.cuda.synchronize()
ms = start.elapsed_time(end)
```

## The tools, in order of use

```text
  1. nvidia-smi / dcgm            is the GPU busy at all?
                                  seconds to check

  2. torch.profiler               which OPERATIONS take the time?
                                  minutes; usually enough

  3. Nsight Systems               where are the GAPS in the
                                  timeline? CPU vs GPU vs
                                  communication
                                  → the tool for "why is the GPU idle"

  4. Nsight Compute               why is THIS KERNEL slow?
                                  occupancy, memory throughput,
                                  instruction mix
                                  → only when you are optimising
                                    a specific kernel
```

**Most problems are found at levels 1–3.** Level 4 is for people writing kernels,
and reaching for it before checking whether the dataloader is the bottleneck is
the classic misdirected effort.

## What each level tells you

```text
  nvidia-smi

    utilisation 30%     → the GPU is idle most of the time.
                          go to Nsight Systems.
    utilisation 100%    → busy. but with WHAT? go to
                          torch.profiler. do not assume it is
                          doing useful maths.
    memory near limit   → likely fragmenting or about to OOM
    power well below
      the limit         → not doing much arithmetic; probably
                          memory bound
```

```text
  torch.profiler — a typical table

    Name                    Self CUDA   %     Calls
    ─────────────────────────────────────────────────
    aten::mm                  1.203s   42%      480
    aten::_softmax            0.612s   21%      240   ← suspicious
    aten::add                 0.318s   11%     2400   ← MANY small
    aten::layer_norm          0.201s    7%      240
    aten::copy_               0.180s    6%      960   ← copies?
```

Reading that table:

```text
  □  matmul dominating          expected and healthy
  □  softmax at 21%             too high — likely materialising
                                the attention matrix; use a
                                fused attention kernel
  □  2400 tiny adds             fusion opportunity; torch.compile
  □  copy_ appearing at all     unnecessary transfers or
                                non-contiguous tensors
```

## Reading a Nsight Systems timeline

```text
  CPU    ▓▓▓░░▓▓▓░░▓▓▓░░▓▓▓░░
  GPU    ░░░▓▓░░░▓▓░░░▓▓░░░▓▓        ← gaps between kernels
  NCCL   ░░░░░░░░░░░░░░░░░░░░
         ▲
    the GPU waits. the CPU is the bottleneck — either data
    loading or launch overhead.
```

```text
  CPU    ▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░
  GPU    ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        ← healthy
  NCCL   ░░░▓▓░░░░░▓▓░░░░░▓▓░
```

```text
  CPU    ▓░▓░▓░▓░▓░▓░▓░▓░▓░▓░
  GPU    ▓▓░░░░░▓▓░░░░░▓▓░░░░
  NCCL   ░░▓▓▓▓▓░░▓▓▓▓▓░░▓▓▓▓        ← communication bound
         ▲
    all-reduce dominates. see the distributed-training topic:
    gradient bucketing, overlap, or fewer/larger messages.
```

**The timeline is the single most informative artifact in GPU performance work**,
because it distinguishes the four starvation causes from the training-infra
chapter at a glance.

## Kernel-level analysis

Only once you know which kernel matters:

```text
  Nsight Compute reports, per kernel:

    ACHIEVED OCCUPANCY      resident warps vs the maximum
    MEMORY THROUGHPUT       GB/s vs the hardware's peak
    COMPUTE THROUGHPUT      % of peak FLOP/s
    STALL REASONS           what threads are waiting on
```

```text
  memory throughput near peak, compute low
    → MEMORY BOUND. fuse, use lower precision, improve layout.

  compute near peak, memory low
    → COMPUTE BOUND. check tensor-core eligibility and
      dimension alignment.

  BOTH low
    → occupancy or latency problem. too few threads, poor
      access patterns, or excessive synchronisation.
```

That third case is the interesting one: the kernel is neither computing nor
moving data at rate, which means it is stalled — usually on uncoalesced memory
access or on too little parallelism to hide latency.

## Memory profiling

```text
  torch.cuda.memory_allocated()      current
  torch.cuda.max_memory_allocated()  PEAK — the number that
                                     matters
  torch.cuda.memory_reserved()       held by the allocator
  torch.cuda.memory_summary()        a breakdown
```

```text
  allocated 30 GB, reserved 70 GB, and you OOM
    → FRAGMENTATION. varying shapes (sequence lengths) cause it.
    → PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
    → or bucket inputs into a few fixed shapes

  memory grows steadily over steps
    → a retained graph. `loss_total += loss` without .detach().
```

## The routine

```text
  1. is the GPU busy?                    nvidia-smi
  2. if not, WHY?                        Nsight Systems timeline
       gaps before kernels               → CPU / dataloader
       gaps inside NCCL                  → communication
       many tiny kernels                 → launch overhead, fuse
  3. if busy, on WHAT?                   torch.profiler
       matmuls dominate                  → healthy; check MFU
       elementwise dominates             → fuse
       softmax/attention dominates       → fused attention
       copies appear                     → transfers, contiguity
  4. compute MFU                         is it near the roofline?
  5. only now, a specific kernel         Nsight Compute
```

**Steps 1–3 find the problem in the large majority of cases**, and they take
under an hour. The instinct to write a custom kernel should be resisted until
step 4 shows you are near the hardware limit and the algorithm is the constraint.

## Common findings

```text
  □  dataloader-bound                       fix the input pipeline
  □  many small kernels                     torch.compile
  □  attention materialising the N×N matrix use FlashAttention
  □  fp32 where bf16 would do                enable autocast
  □  dimensions not multiples of 8           pad them
  □  .item() in the training loop            accumulate on device
  □  unnecessary .cpu() / .numpy()           keep it on device
  □  non-contiguous tensors causing copies   .contiguous() once
  □  batch too small                         raise it
  □  gradient all-reduce not overlapped      bucketing
```

Roughly in order of how often each turns out to be the answer — and the first
three cover a large fraction of real cases.

## What to take away

1. GPU work is asynchronous, so naive timing measures queueing; synchronise, warm
   up, and take a median over many iterations.
2. Use the tools in order: `nvidia-smi`, `torch.profiler`, Nsight Systems, and only
   then Nsight Compute — most problems are found in the first three.
3. The Nsight Systems timeline distinguishes CPU-bound, communication-bound and
   healthy at a glance, which is why it is the most informative artifact.
4. In the profiler table, dominant matmuls are healthy; dominant softmax,
   thousands of tiny elementwise ops, and any `copy_` are findings.
5. A kernel low on both memory and compute throughput is stalled — usually
   uncoalesced access or insufficient parallelism.
6. Allocated far below reserved with an OOM means fragmentation; steadily growing
   memory means a retained graph.

That completes GPUs and accelerators. Next in the track: **distributed
training** — using many of them together, where communication becomes the
constraint.
