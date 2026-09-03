---
title: Tensor and pipeline parallelism
minutes: 19
summary: Splitting the model itself across devices, and the bubble that makes pipelines awkward.
---

Sharding removes redundancy but every device still executes every layer. When a
single layer is too large for one device, or when you need to reduce per-device
memory further, the model itself must be split — either *within* a layer (tensor
parallelism) or *across* layers (pipeline parallelism).

## Tensor parallelism

Split individual matrices across devices.

```text
  Y = X · W,  with W split column-wise across 2 GPUs

  GPU 0:  Y₀ = X · W[:, :h/2]
  GPU 1:  Y₁ = X · W[:, h/2:]

  Y = concat(Y₀, Y₁)      ← an all-gather
```

The clever part in transformers is arranging two consecutive matmuls so that only
*one* collective is needed for the pair:

```text
  MLP block:  Y = GeLU(X·W₁)·W₂

  W₁ split by COLUMN   → each GPU computes its slice of the
                         hidden activation independently
                         (GeLU is elementwise — no comms needed)
  W₂ split by ROW      → each GPU produces a PARTIAL output
                         → one ALL-REDUCE to sum them

  → ONE collective per MLP block, not two
```

Attention splits naturally by head:

```text
  16 attention heads across 4 GPUs → 4 heads each

  each GPU computes its heads completely independently,
  then ONE all-reduce combines the output projection.
```

```text
  per transformer layer: 2 all-reduces (attention + MLP)
                         in the forward, 2 in the backward
```

That is a lot of collectives, and they sit on the critical path — nothing can
proceed until the all-reduce completes.

```text
  → TENSOR PARALLELISM REQUIRES FAST INTERCONNECT.

  within a node over NVLink (600 GB/s):  practical
  across nodes over Ethernet:            usually a disaster

  the standard rule: TP degree ≤ the number of GPUs in one node.
```

This is the single most important operational fact about tensor parallelism, and
it is why TP=8 (one node) is so common.

## Pipeline parallelism

Split the model by *layer* across devices.

```text
  GPU 0: layers 1–8
  GPU 1: layers 9–16
  GPU 2: layers 17–24
  GPU 3: layers 25–32

  activations flow forward, gradients flow backward
```

Communication is small — only the activations at each boundary — so it works over
slower links. The problem is the bubble:

```text
  NAIVE PIPELINE, one batch

  GPU 0  [F1]                      [B1]
  GPU 1       [F2]            [B2]
  GPU 2            [F3]  [B3]
  GPU 3                 [F4][B4]

  ░░░░ idle ░░░░  — each GPU works 1/4 of the time
```

**Microbatching** fills the bubble:

```text
  split the batch into 4 microbatches (1,2,3,4)

  GPU 0  [F1][F2][F3][F4]            [B1][B2][B3][B4]
  GPU 1      [F1][F2][F3][F4]    [B1][B2][B3][B4]
  GPU 2          [F1][F2][F3][F4][B1][B2][B3][B4]
  GPU 3              [F1][F2][F3][F4][B1][B2][B3][B4]
                     ▲
                  much better utilisation
```

```text
  bubble fraction = (P - 1) / (M + P - 1)

    P = pipeline stages, M = microbatches

    P=4, M=4    → 43% bubble
    P=4, M=16   → 16%
    P=4, M=64   → 4.5%

  → M should be at least 4×P, ideally more
```

More microbatches means each is smaller, so per-device efficiency falls — the
usual trade. And more microbatches in flight means more activation memory held
simultaneously, which is what **1F1B scheduling** addresses: alternate forward and
backward passes so at most P microbatches' activations are live, rather than M.

```text
  GPipe (all forwards, then all backwards)
    → M microbatches' activations live simultaneously

  1F1B (interleaved)
    → at most P live. much less memory, same bubble.
    → what modern implementations use
```

## Comparison

| | Tensor | Pipeline |
| --- | --- | --- |
| Splits | within a layer | across layers |
| Communication | large, per layer | small, at boundaries |
| Interconnect need | **very high** | moderate |
| Bubble | none | yes, needs microbatching |
| Load balance | even by construction | needs equal-cost stages |
| Implementation | intrusive; layers rewritten | wraps the model |
| Scales to | ~8 (one node) | many nodes |

**Pipeline's load-balancing requirement is under-appreciated.** Every stage must
take roughly the same time, or the slowest sets the pace for all of them. Embedding
layers, the final LM head and layers with different sequence handling all break
naive equal-layer-count splits, and stage assignment usually needs measuring
rather than counting.

## 3D parallelism

Large-scale training combines all three:

```text
  DATA parallel      × N₁    replicate, split the batch
  PIPELINE parallel  × N₂    split by layer
  TENSOR parallel    × N₃    split within a layer

  total GPUs = N₁ × N₂ × N₃
```

```text
  a typical 512-GPU arrangement

    TP = 8       within a node, over NVLink
    PP = 8       across 8 nodes
    DP = 8       8 such groups, replicated

    8 × 8 × 8 = 512
```

The mapping to hardware is the point:

```text
  ┌──────── node (8 GPUs, NVLink) ────────┐
  │  TENSOR PARALLEL group                │  ← highest comms,
  └───────────────────────────────────────┘     fastest link
       │
       │ PIPELINE across nodes             ← small activations,
       ▼                                      tolerates slower links
  ┌───────────────────────────────────────┐
  │  DATA PARALLEL across pipeline groups │  ← one all-reduce
  └───────────────────────────────────────┘     per step
```

**Match the parallelism to the interconnect hierarchy**: the chattiest dimension
gets the fastest link. Getting this backwards — tensor parallelism across nodes —
is the classic configuration error and can cost several times the throughput.

## Sequence and context parallelism

A fourth dimension that matters for long contexts:

```text
  attention memory scales with sequence length SQUARED

  128k-token context → attention activations dominate
  everything else

  SEQUENCE PARALLELISM   split the sequence across devices for
                         the parts that allow it (layernorm,
                         dropout) — complements tensor parallelism
  CONTEXT / RING
  ATTENTION              split the sequence for attention itself,
                         passing K/V blocks around a ring
```

These are what make very long context training feasible, and they are increasingly
standard rather than exotic.

## Expert parallelism (MoE)

```text
  a Mixture-of-Experts layer has E experts; each token is
  routed to k of them (usually k=1 or 2)

  → experts are distributed across devices
  → an ALL-TO-ALL sends each token to its expert's device,
    and another brings the results back
```

```text
  the load-balance problem:

    if routing is uneven, one expert receives most tokens
    → its device is the bottleneck, others idle

  mitigations:
    □  an auxiliary load-balancing loss during training
    □  capacity factors — cap tokens per expert, drop or
       reroute the overflow
```

MoE gives many more parameters for roughly constant compute per token, which is
why frontier models use it — and the all-to-all plus the load-balancing problem
are the engineering price.

## Choosing a configuration

```text
  1. does it fit with DDP?              → DDP. done.
  2. fit with ZeRO/FSDP?                → FSDP. simpler than
                                          model parallelism.
  3. a single LAYER too large?          → TENSOR parallelism,
                                          within a node only
  4. still too large?                   → add PIPELINE across nodes
  5. very long sequences?               → add sequence/context
                                          parallelism
  6. want more parameters at the same
     compute?                           → MoE + expert parallelism
```

**Try FSDP before model parallelism.** It is far less intrusive — no model
rewriting, no stage balancing — and for many models it is sufficient. Tensor and
pipeline parallelism are what you reach for when a layer genuinely does not fit or
when FSDP's communication pattern does not suit the hardware.

## What to take away

1. Tensor parallelism splits within a layer and requires very fast interconnect —
   keep the TP degree within a single node.
2. The transformer MLP's column-then-row split needs only one collective per
   block, and attention splits naturally by head.
3. Pipeline parallelism communicates little but introduces a bubble of
   (P−1)/(M+P−1); use at least 4×P microbatches, and 1F1B scheduling to bound
   activation memory.
4. Pipeline stages must be balanced by measured cost, not by layer count.
5. In 3D parallelism, map the chattiest dimension to the fastest link — tensor
   parallelism across nodes is the classic expensive mistake.
6. Try FSDP before model parallelism; reach for TP/PP when a layer genuinely does
   not fit.

Next: the communication layer itself, and debugging a job that is slower than it
should be.
