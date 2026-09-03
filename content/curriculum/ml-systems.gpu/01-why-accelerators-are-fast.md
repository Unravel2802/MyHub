---
title: Why accelerators are fast
minutes: 19
summary: The architectural bargain a GPU makes, and what it is therefore bad at.
---

A GPU is not a fast CPU. It is a different bargain: enormously more arithmetic
throughput in exchange for giving up almost everything a CPU spends transistors
on. Understanding what was given up explains both why deep learning runs well on
one and why so much other code does not.

## The bargain

```text
  CPU                                GPU
  ───                                ───
  ~8–64 complex cores                ~10,000+ simple cores
  large caches per core              small caches, huge bandwidth
  deep out-of-order execution        in-order, massively threaded
  branch prediction                  branches are expensive
  optimised for LATENCY              optimised for THROUGHPUT
    (finish one thing fast)            (finish many things per second)
```

```text
  a modern CPU spends most of its transistors on:
    caches, branch predictors, out-of-order machinery,
    speculation — all to make ONE instruction stream fast

  a GPU spends them on:
    ALUs. thousands of them.
```

The consequence is the design rule for everything that follows: **a GPU is fast
only when thousands of threads are doing the same operation on different data.**
That is exactly what a matrix multiply is, which is why deep learning and GPUs
found each other.

## The execution model

```text
  a kernel launches a GRID of thread BLOCKS

  GRID
  ┌──────────┬──────────┬──────────┬──────────┐
  │ BLOCK 0  │ BLOCK 1  │ BLOCK 2  │ BLOCK 3  │ ...
  │ 256      │ 256      │ 256      │ 256      │
  │ threads  │ threads  │ threads  │ threads  │
  └──────────┴──────────┴──────────┴──────────┘
       │
       │ each block runs on ONE streaming multiprocessor (SM)
       │ and is scheduled as WARPS of 32 threads
       ▼
  WARP: 32 threads executing the SAME instruction in lockstep
```

The warp is the unit that matters. Threads within a warp share an instruction
pointer, so **divergence is expensive**:

```text
  if (x > 0) {  A  } else {  B  }

  within one warp, if some threads take each path:
    the warp executes A with the else-threads MASKED OFF,
    then executes B with the if-threads masked off.
  → both branches run. the cost is the SUM, not the max.
```

This is why data-dependent branching is discouraged in GPU code, and why
operations are expressed as arithmetic over masks rather than as conditionals.

## Occupancy and latency hiding

A GPU does not avoid memory latency; it hides it by having something else to run.

```text
  a warp issues a memory load (~400 cycles)
       │
       └─ the SM immediately switches to ANOTHER resident warp
          and issues its work

  with enough resident warps, the memory latency of any one
  is completely covered.
```

```text
  OCCUPANCY = resident warps ÷ the maximum an SM can hold

  limited by, per SM:
    □  registers per thread (more registers → fewer warps fit)
    □  shared memory per block
    □  the hardware's block and warp limits
```

Higher occupancy generally means better latency hiding — but **not always**. A
kernel using many registers per thread may run faster at lower occupancy because
each thread does more work with fewer memory round trips. Occupancy is a means,
not a goal, which is why blindly optimising it can make code slower.

## Tensor cores

The specialised units that make modern training viable:

```text
  a tensor core computes a small matrix multiply-accumulate
  in one instruction:

      D = A × B + C        for small tiles (e.g. 16×16)

  throughput vs general-purpose CUDA cores:
    fp32 on CUDA cores        1×
    bf16 on tensor cores      ~8–16×
    fp8 on tensor cores       ~16–32×
```

The catch that matters in practice:

```text
  tensor cores are used ONLY when:
    □  the operation is a matmul or convolution
    □  the precision is supported (bf16/fp16/tf32/fp8)
    □  the dimensions are aligned — typically multiples of 8
       or 16 depending on the generation

  a matmul with an inner dimension of 4095 may fall back to
  CUDA cores and run several times slower than one with 4096.
```

**Pad dimensions to multiples of 8 (or 64 for best results).** A hidden size of
768 is not an accident; a hidden size of 770 is a several-fold slowdown nobody
will find without a profiler. This single rule accounts for a surprising number of
"why is this model slower than that one" questions.

## The memory hierarchy

```text
  ┌──────────────────────────────────────────────────────┐
  │ REGISTERS      per thread    ~256 KB/SM   ~20 TB/s   │
  ├──────────────────────────────────────────────────────┤
  │ SHARED MEMORY  per block     ~228 KB/SM   ~15 TB/s   │
  ├──────────────────────────────────────────────────────┤
  │ L2 CACHE       per device    ~50 MB       ~5 TB/s    │
  ├──────────────────────────────────────────────────────┤
  │ HBM (global)   per device    40–192 GB    2–8 TB/s   │
  ├──────────────────────────────────────────────────────┤
  │ HOST RAM       over PCIe/NVLink           ~30–900 GB/s│
  └──────────────────────────────────────────────────────┘
```

HBM bandwidth is enormous by CPU standards and is still, for most kernels, the
binding constraint — which is the subject of the next chapter.

**Coalescing** is the rule that decides whether you get that bandwidth:

```text
  COALESCED — adjacent threads read adjacent addresses
    thread 0 → addr 0    thread 1 → addr 4    thread 2 → addr 8
    → one 128-byte transaction serves 32 threads

  STRIDED — adjacent threads read scattered addresses
    thread 0 → addr 0    thread 1 → addr 1024  ...
    → 32 separate transactions
    → up to 32× less effective bandwidth
```

This is why memory layout matters so much: a tensor in the wrong layout for the
kernel reading it can cost an order of magnitude, and it is the reason
`.contiguous()` exists and occasionally makes code dramatically faster.

## What GPUs are bad at

Worth stating plainly, because it explains where they should not be used:

```text
  ✗  serial, dependent computation — no parallelism to exploit
  ✗  heavy branching on data
  ✗  irregular memory access (graph traversal, pointer chasing)
  ✗  small workloads — kernel launch overhead (~5–10 µs)
     dominates
  ✗  anything requiring frequent CPU–GPU round trips
  ✗  problems that do not fit in device memory
```

The small-workload point is the one that catches people deploying models: a tiny
model on a single request may be *slower* on a GPU than on a CPU, because launch
overhead and transfer dominate the arithmetic. GPUs win on batches.

## The generations, roughly

```text
  V100 (2017)   fp16 tensor cores, 900 GB/s, 32 GB
  A100 (2020)   bf16 + TF32, 2 TB/s, 40/80 GB, MIG partitioning
  H100 (2022)   fp8, 3.35 TB/s, 80 GB, transformer engine
  H200 (2024)   H100 compute, 4.8 TB/s, 141 GB
  B200 (2025)   fp4, ~8 TB/s, 192 GB
```

Two trends worth reading from that table. **Memory bandwidth has grown far slower
than arithmetic throughput**, which is why more and more kernels are
memory-bound — the subject of the next chapter. And **precision keeps dropping**,
because lower precision buys both arithmetic and bandwidth at once.

`bf16` deserves a specific note: it has the same exponent range as fp32 with fewer
mantissa bits, so it does not overflow where fp16 does. That makes it far more
robust for training, and it is why bf16 replaced fp16 as the default on hardware
that supports it.

## The consumer/datacentre distinction

```text
  a consumer card (RTX 4090) has excellent raw FLOPs and:
    ✗  24 GB, non-expandable
    ✗  no NVLink (on recent generations)
    ✗  much slower fp64 and often restricted fp16 accumulate
    ✗  licence terms restricting datacentre use
    ✓  a fraction of the price

  → fine for a single-GPU workstation, unsuitable for
    multi-GPU training at scale
```

The interconnect is the reason, not the FLOPs: multi-GPU training is
communication-bound, and cards without NVLink communicate over PCIe at a small
fraction of the bandwidth.

## What to take away

1. A GPU trades single-stream speed for arithmetic throughput; it is fast only
   when thousands of threads do the same thing to different data.
2. Warps execute in lockstep, so a divergent branch costs the sum of both paths.
3. Latency is hidden by having many resident warps; occupancy is a means, not a
   goal.
4. Tensor cores need supported precision and aligned dimensions — pad to multiples
   of 8, or fall back to several-times-slower CUDA cores.
5. Coalesced access gets full HBM bandwidth; strided access can be 32× worse,
   which is why memory layout matters so much.
6. Bandwidth has grown far slower than FLOPs, which is why so many kernels are
   memory-bound — and bf16's fp32 exponent range is why it replaced fp16.

Next: arithmetic intensity — the number that predicts whether a kernel is limited
by maths or by memory.
