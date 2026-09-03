---
title: The modern transformer block
minutes: 19
summary: What a decoder layer actually computes, and the changes that separate a 2026 model from the 2017 original.
---

The transformer described in *Attention Is All You Need* is not what current
models run. A decade of accumulated changes — normalisation placement, positional
encoding, attention variants, activation functions — has produced a fairly stable
modern design, and each change exists for a reason worth knowing.

## The block

```text
  x ──┬──────────────────────────────────────────┐
      │                                          │
      ▼                                          │
  RMSNorm                                        │
      │                                          │
      ▼                                          │
  ATTENTION (grouped-query, with RoPE)           │
      │                                          │
      ▼                                          │
      ⊕ ◀────────────────────────────────────────┘  residual
      │
      ├──────────────────────────────────────────┐
      ▼                                          │
  RMSNorm                                        │
      │                                          │
      ▼                                          │
  FEED-FORWARD (SwiGLU)                          │
      │                                          │
      ▼                                          │
      ⊕ ◀────────────────────────────────────────┘  residual
      │
      ▼  to the next layer
```

Repeat this 32–120 times, add embeddings at the bottom and a projection to
vocabulary at the top, and that is a modern language model.

## Pre-norm, not post-norm

```text
  ORIGINAL (post-norm)          MODERN (pre-norm)

  x + Attention(x)              x + Attention(Norm(x))
  then Norm                     norm INSIDE the residual branch

  → gradients must pass         → the residual path is a clean
    through a norm at every       identity from input to output
    layer                       → gradients flow unimpeded
  → deep models diverge         → deep models train stably
    without careful warmup      → less warmup needed
```

**Pre-norm is what made very deep transformers trainable.** The residual stream
becomes an unobstructed highway; each block reads from it, computes a correction,
and adds it back. That framing — the residual stream as a shared workspace that
layers read from and write to — is the most useful mental model for what a
transformer does.

The cost is a small quality loss at equal depth, which is why some models
normalise both inside and after the block.

## RMSNorm, not LayerNorm

```text
  LayerNorm   (x − mean) / std × γ + β
  RMSNorm     x / sqrt(mean(x²)) × γ

  → no mean subtraction, no bias term
  → ~10–15% faster, fewer parameters
  → empirically no quality loss
```

A small change repeated 32–120 times per forward pass, which is why it is worth
making.

## Positional information

Attention is permutation-invariant — without positional information, "dog bites
man" and "man bites dog" are identical to it.

```text
  ABSOLUTE (learned or sinusoidal)
    add a position vector to the embedding
    ✗ does not extrapolate past the trained length
    ✗ encodes absolute position, when what matters is
      RELATIVE distance

  ALiBi
    add a distance-proportional penalty to attention scores
    ✓ extrapolates naturally
    ✓ extremely simple

  RoPE (rotary) — the modern default
    ROTATE the query and key vectors by an angle proportional
    to position
    → the dot product between them then depends only on
      their RELATIVE distance
    ✓ relative by construction, and it composes with
      efficient attention kernels
```

```text
  why RoPE is relative

    rotate q by angle mθ, k by angle nθ
    their dot product depends on (m − n) — the DISTANCE —
    not on m and n individually
```

**Context extension** is where RoPE's parameters matter in practice:

```text
  a model trained at 4k tokens, extended to 128k

  POSITION INTERPOLATION   squeeze positions into the trained
                           range — simple, degrades detail
  NTK-AWARE SCALING        scale the frequency base θ,
                           preserving high-frequency detail
  YaRN                     a refined combination
  → all typically need a short FINE-TUNE at the longer length
```

This is how a model advertised at 4k context becomes a 128k model without
retraining from scratch, and it explains why long-context quality often degrades
well before the advertised limit.

## Attention variants

```text
  MULTI-HEAD (MHA)      n query heads, n key/value heads
                        → the largest KV cache

  GROUPED-QUERY (GQA)   n query heads, n/g key/value heads
                        → 4–8× smaller cache
                        → negligible quality cost
                        → THE MODERN DEFAULT

  MULTI-QUERY (MQA)     n query heads, 1 key/value head
                        → smallest cache, some quality cost

  MLA (latent)          compress KV into a low-rank latent
                        → large reduction, used by recent
                          frontier models
```

```text
  MHA                    GQA (g=4)              MQA
  q q q q q q q q        q q q q  q q q q       q q q q q q q q
  │ │ │ │ │ │ │ │         \ | | /   \ | | /      \ \ | | / / /
  k k k k k k k k          kv        kv                kv
```

The KV cache was the memory bottleneck in the inference topic, and GQA is the
architectural answer — which is why it is near-universal in new models and why
serving an older MHA model is disproportionately expensive.

## The feed-forward network

```text
  ORIGINAL           FFN(x) = W₂ · ReLU(W₁x)
                     hidden = 4 × d_model

  MODERN (SwiGLU)    FFN(x) = W₃ · (Swish(W₁x) ⊙ W₂x)
                     THREE matrices, hidden ≈ 8/3 × d_model
                     (chosen to keep the parameter count equal)
```

The gating — one branch modulating another elementwise — consistently outperforms
a plain activation, and the hidden size is reduced to compensate for the third
matrix.

**The FFN is roughly two-thirds of the parameters** in a standard block, which is
why mixture-of-experts targets it specifically.

## Mixture of experts

```text
  DENSE FFN                      MoE FFN
  every token through            a ROUTER sends each token to
  one FFN                        k of E experts (k usually 1–2)

                                 ┌─ expert 1 ─┐
  token ──▶ FFN ──▶ out          │  expert 2  │
                                 token ─router──▶ 2 of 8 ──▶ out
                                 │  ...       │
                                 └─ expert 8 ─┘
```

```text
  → many more PARAMETERS, roughly constant compute per token
  → e.g. 8 experts, top-2: ~4× the parameters, ~1.3× the FLOPs

  the costs
    □  ALL experts' weights must be in memory
       → helps FLOPs, not memory or bandwidth per parameter
    □  routing must be LOAD BALANCED, or one expert becomes
       the bottleneck (an auxiliary loss handles this)
    □  an all-to-all communication step in distributed
       training and serving
```

MoE is why frontier parameter counts have grown far faster than inference cost,
and the engineering price is the routing and the all-to-all — as the
distributed-training topic covered.

## Long-context mechanisms

```text
  attention cost is O(N²) in sequence length.

  SLIDING WINDOW        attend only to the last W tokens
                        → linear cost; loses long-range
  ATTENTION SINKS       always keep the first few tokens —
                        they act as attention anchors and
                        removing them collapses quality
  INTERLEAVED           alternate local and global layers
  STATE SPACE
  MODELS                linear-time recurrence (Mamba); hybrid
                        with attention in practice
```

The attention-sink finding is worth knowing because it is counter-intuitive:
sliding-window attention that drops the *earliest* tokens degrades badly, and
keeping just the first four tokens restores it — the model uses them as a place to
dump attention it does not need to allocate elsewhere.

## What to take away

1. The modern block is pre-norm RMSNorm, grouped-query attention with RoPE, and a
   SwiGLU feed-forward — each change small, repeated 32–120 times.
2. Pre-norm makes the residual stream a clean identity path, which is what made
   very deep transformers trainable.
3. RoPE encodes relative distance by rotation, and its scaling parameters are how a
   4k model becomes a 128k model without retraining.
4. GQA is the architectural answer to the KV cache bottleneck and is now the
   default.
5. The FFN is two-thirds of the parameters, which is what MoE targets — more
   parameters at constant compute, at the cost of memory and all-to-all routing.
6. Attention sinks: keeping the first few tokens is necessary for sliding-window
   attention to work at all.

Next: how these models are trained in the first place.
