---
title: Arithmetic intensity and the roofline
minutes: 19
summary: The single number that predicts whether an operation is compute-bound or memory-bound.
---

Before optimising a kernel, you need to know what is limiting it. There is one
number that answers this, it is easy to compute by hand, and it determines
whether an optimisation will help at all.

## Arithmetic intensity

```text
  AI = FLOPs performed ÷ bytes moved from memory
```

```text
  compare against the hardware's ratio:

    A100:  312 TFLOP/s (bf16) ÷ 2.0 TB/s = ~156 FLOP/byte
    H100:  990 TFLOP/s (bf16) ÷ 3.35 TB/s = ~295 FLOP/byte

  AI < the ratio   →  MEMORY BOUND
  AI > the ratio   →  COMPUTE BOUND
```

That the ratio is *hundreds* is the fact to internalise: modern accelerators can
perform hundreds of arithmetic operations in the time it takes to fetch one byte.
Almost nothing achieves that, which is why **most kernels are memory-bound**.

## The roofline

```text
  attainable
  FLOP/s
      │                    ┌──────────────────── peak compute
      │                   ╱
      │                  ╱  ← compute bound: more FLOPs/byte
      │                 ╱      does not help; you are at peak
      │                ╱
      │  memory       ╱
      │  bound:      ╱
      │  slope =    ╱
      │  bandwidth ╱
      │           ╱
      └──────────┴─────────────────────────────▶ arithmetic intensity
                 ▲
            the ridge point (~156 on A100)
```

The picture tells you what to do:

```text
  LEFT of the ridge (memory bound)
    □  reduce bytes moved: fuse kernels, use lower precision,
       improve layout, avoid materialising intermediates
    □  MORE FLOPs is free — recomputing can be faster than
       storing and re-reading

  RIGHT of the ridge (compute bound)
    □  use tensor cores; check dimension alignment
    □  reduce the number of operations
    □  better algorithms
```

The counter-intuitive consequence on the left: **recomputation can be a
speedup**. Activation checkpointing recomputes the forward pass in the backward
pass, adding ~30% more FLOPs — and on a memory-bound kernel, or when it saves the
memory traffic of storing and reloading activations, it can be faster as well as
smaller.

## Worked examples

```text
  MATRIX MULTIPLY  C = A×B,  all N×N, bf16

    FLOPs:  2N³
    bytes:  3N² × 2 bytes = 6N²
    AI  =   2N³ / 6N² = N/3

    N = 512   → AI 170    compute bound (just)
    N = 4096  → AI 1365   solidly compute bound
    N = 64    → AI 21     MEMORY bound
```

**Large matmuls are the only common operation that is comfortably compute-bound**,
which is exactly why deep learning is a good fit for this hardware — and why small
matmuls are not, which is the argument for batching.

```text
  ELEMENTWISE, e.g. y = relu(x)

    FLOPs:  N
    bytes:  2N × 2 = 4N   (read x, write y)
    AI  =   0.25

  → 600× below the ridge point. hopelessly memory bound.
  → every elementwise op runs at memory bandwidth, no matter
    how trivial the arithmetic.
```

```text
  A CHAIN OF ELEMENTWISE OPS
    y = relu(x); z = y * 2; w = z + b

    UNFUSED: 3 kernels, each reading and writing global memory
             → 6N reads + writes

    FUSED:   1 kernel, read x once, write w once
             → 2N
             → 3× less memory traffic → ~3× faster
```

Kernel fusion is the highest-value optimisation for memory-bound work, and it is
what `torch.compile`, XLA and Triton exist to do automatically.

## Attention: the canonical case

```text
  standard attention:  softmax(QKᵀ/√d)V

  the N×N attention matrix is MATERIALISED in HBM:
    write it (N² values)
    read it for softmax
    write the result
    read it for the multiply by V

  → memory traffic scales with N², and the whole thing is
    memory bound despite containing large matmuls
```

**FlashAttention** is the fix and is worth understanding as a general lesson:

```text
  never materialise the N×N matrix.

  process in TILES that fit in SHARED MEMORY:
    load a tile of Q, K, V
    compute the partial attention in shared memory
    accumulate the output with an online softmax
    move to the next tile

  → HBM traffic drops from O(N²) to O(N)
  → 2–4× faster and dramatically less memory
  → and it performs MORE arithmetic than the naive version
```

That last line is the lesson: **FlashAttention does more FLOPs and is much
faster**, because it is memory-bound work and it traded arithmetic for bandwidth.
Counting operations is the wrong model for predicting performance on this
hardware.

## Inference: the extreme case

```text
  autoregressive generation, batch size 1

    per token, you read the ENTIRE model's weights from HBM
    and perform one matmul against a single vector.

    7B model in bf16 = 14 GB read per token
    A100 at 2 TB/s   = 7 ms per token, minimum
    → ~140 tokens/second, and the arithmetic units are
      almost entirely idle
```

The GPU is at a few percent of its FLOP capability, entirely bandwidth-bound. This
single fact drives the whole inference-optimisation topic:

```text
  BATCHING       read the weights once, use them for many
                 sequences → AI rises linearly with batch size
  QUANTISATION   fewer bytes per weight → directly faster
  KV CACHING     avoid recomputing past keys and values
  SPECULATION    verify several tokens per weight read
```

Every one of them is a bandwidth optimisation, not a compute optimisation, and
that is because the roofline says so.

## Computing it for your own kernel

```text
  1. count FLOPs
       matmul (M×K)·(K×N):  2·M·K·N
       elementwise:          ~1 per element
       attention:            ~4·N²·d

  2. count bytes moved
       every tensor read from and written to HBM,
       × bytes per element

  3. AI = FLOPs / bytes; compare with the hardware ratio

  4. also compute the LOWER BOUND on time:
       max( FLOPs / peak_FLOPs , bytes / bandwidth )
       → if you are near it, stop optimising
```

That fourth step is the one that saves the most effort. Knowing that an operation
*cannot* go faster than 4 ms because it must move 8 GB tells you to stop, and to
change the algorithm instead of tuning the kernel.

## The practical rules

```text
  □  assume MEMORY BOUND unless you have checked
  □  fuse elementwise chains — torch.compile does this
  □  lower precision helps memory-bound work TWICE:
     less traffic and faster arithmetic
  □  larger batches raise AI for weight-stationary work
  □  prefer one large matmul to many small ones
  □  recomputation is cheap when bandwidth is the constraint
  □  compute the lower bound before optimising anything
```

## What to take away

1. Arithmetic intensity — FLOPs per byte moved — compared against the hardware's
   ratio tells you whether an operation is compute- or memory-bound.
2. Modern accelerators sit at hundreds of FLOPs per byte, so most kernels are
   memory-bound and most optimisation is about moving fewer bytes.
3. Large matmuls are the main compute-bound operation; elementwise ops sit ~600×
   below the ridge and always run at bandwidth.
4. Fusing an elementwise chain cuts memory traffic proportionally, which is what
   `torch.compile` and Triton exist to do.
5. FlashAttention performs *more* arithmetic and is several times faster, because
   it never materialises the N×N matrix — counting FLOPs mispredicts performance.
6. Batch-1 autoregressive inference reads the whole model per token, which is why
   every inference optimisation is a bandwidth optimisation.

Next: precision — the other lever that buys both bandwidth and arithmetic.
