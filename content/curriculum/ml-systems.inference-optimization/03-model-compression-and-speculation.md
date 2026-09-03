---
title: Compression and speculative decoding
minutes: 19
summary: Making the model smaller, and getting more than one token per weight read.
---

Batching and cache management make better use of a model. The remaining
optimisations change the model itself, or change how many tokens each expensive
weight read produces. Both attack the same bandwidth bound from different sides.

## Quantisation for serving

The formats and their trade-offs were covered in the GPU topic; here is what
matters operationally.

```text
  WEIGHT-ONLY (int4/int8 weights, bf16 activations)
    → attacks BANDWIDTH: 2–4× fewer bytes per weight read
    → helps DECODE, which is memory bound
    → the standard for interactive single-stream serving

  WEIGHT + ACTIVATION (both int8/fp8)
    → uses int8/fp8 TENSOR CORES
    → helps PREFILL and large-batch serving, which are
      compute bound
    → harder to keep accurate (activation outliers)
```

```text
  choose by workload:

    chat, low concurrency      → weight-only int4
    high-throughput batch      → int8 weight+activation
    quality-critical           → bf16, and optimise elsewhere
```

Applying weight-only quantisation to a compute-bound batch workload gives almost
no speedup, which is a common disappointment with an obvious cause once the
roofline is in mind.

```text
  the methods, briefly

  GPTQ    layer-by-layer, minimising reconstruction error
          against real calibration activations
  AWQ     protect the ~1% of weights that matter most, based
          on activation magnitude
  SmoothQuant  rescale to move difficulty from activations
          (outlier-prone) to weights (well-behaved)
  bitsandbytes  simple runtime quantisation; convenient,
          usually lower quality than the above
```

**Always evaluate on your own task.** Published perplexity deltas do not predict
degradation on a specific downstream use, and the check costs an afternoon.

## Distillation

Train a small model to imitate a large one.

```text
  TEACHER (70B)  ──▶ outputs / logits / reasoning traces
                          │
                          ▼
  STUDENT (7B)   trained to match the teacher, not just the
                 ground-truth labels
```

Why it beats training the small model directly: the teacher's full output
distribution carries more information than a hard label. Knowing an image is 70%
cat, 25% lynx, 5% dog teaches similarity structure that "cat" does not.

```text
  variants
    LOGIT MATCHING       match the full output distribution
    SEQUENCE-LEVEL       train on the teacher's generated
                         sequences
    FEATURE MATCHING     match intermediate representations
    RATIONALE            train on the teacher's reasoning, not
                         only its answers
```

**Distillation is frequently the largest available win and is under-used**,
because it looks like a modelling project rather than an efficiency one. A
distilled model that meets the quality bar is 10× cheaper than every serving
optimisation applied to the large one, permanently.

The realistic assessment: on a *narrow* task, a well-distilled small model
routinely matches its teacher. On broad general capability it does not, and
expecting it to leads to disappointment.

## Pruning

```text
  UNSTRUCTURED    zero out individual weights by magnitude
                  ✓ high sparsity with little quality loss
                  ✗ NO SPEEDUP on standard hardware — a sparse
                    matrix stored densely is the same work

  STRUCTURED      remove whole heads, channels or layers
                  ✓ a real speedup, because the tensor is
                    genuinely smaller
                  ✗ more quality loss for the same sparsity

  2:4 SEMI-STRUCTURED   2 of every 4 weights zero
                  ✓ ~2× on Ampere+ tensor cores, hardware
                    supported
                  ✓ the practical middle ground
```

The first row is the trap: reporting "90% sparsity" from unstructured pruning and
expecting a speedup. Without hardware or kernel support for the sparsity pattern,
the arithmetic is unchanged.

## Speculative decoding

The most elegant inference optimisation, and it is worth understanding precisely
because its guarantee is unusual.

```text
  the observation: verifying K tokens costs about the same as
  generating ONE, because both are one pass over the weights
  and the pass is memory-bound.

  so: have a cheap DRAFT model propose K tokens, then verify
  them all in a single forward pass of the target model.
```

```text
  draft model (small, fast) proposes:   " the cat sat on the"
                                          ▲   ▲   ▲   ▲   ▲
  target model verifies ALL FIVE in ONE pass:
                                          ✓   ✓   ✓   ✗
                                                      └─ reject
                                                         here

  → accept "the cat sat", regenerate from the target at the
    rejection point
  → 3 tokens for the cost of ~1 target pass
```

```text
  the critical property:

    with the correct acceptance rule (rejection sampling),
    the output distribution is EXACTLY that of the target
    model alone.

  → this is not an approximation. quality is unchanged.
```

That guarantee is what makes speculation different from every other technique
here: quantisation, pruning and distillation all trade quality for speed.
Speculative decoding trades *compute* for speed, with no quality cost at all.

```text
  speedup ≈ acceptance_rate × K,
            reduced by the draft model's own cost

  typical: 1.5–3×
  higher when the draft model agrees often — i.e. on
  predictable text (code, structured output, common phrasing)
  lower on genuinely uncertain generation
```

The variants remove the need for a separate draft model:

```text
  DRAFT MODEL     a small model of the same family
                  → best acceptance, needs a second model

  MEDUSA          extra prediction heads on the target model
                  itself predict several tokens ahead
                  → no second model

  EAGLE           predict at the FEATURE level rather than the
                  token level; higher acceptance
                  → currently among the strongest

  n-gram / lookup speculate by matching against the prompt
                  → free; excellent for tasks that copy from
                    context (summarisation, editing, RAG)
```

The lookup variant deserves a note because it costs nothing: when the output
frequently repeats spans from the input — which is true of summarisation, code
editing and retrieval-grounded answering — proposing continuations found in the
prompt has a high acceptance rate with no draft model at all.

## Other structural levers

```text
  EARLY EXIT           stop at an intermediate layer when
                       confident
                       → variable compute per token; awkward
                         to batch

  MIXTURE OF EXPERTS   route each token to a few of many
                       experts
                       → many more parameters, constant compute
                       → but ALL experts' weights must be in
                         memory, so it helps FLOPs and not
                         bandwidth-per-parameter

  CASCADES             try a small model; escalate to a large
                       one only when confidence is low
                       → often the best cost/quality trade in
                         practice, and simple to implement
```

**Cascades are under-used and easy.** If 80% of requests can be handled by a model
ten times cheaper, and a confidence signal identifies them reliably, the average
cost falls by most of that factor with no change to the hard cases. The engineering
is a threshold and a fallback path.

## Choosing what to apply

```text
  Is continuous batching enabled?
    └─ NO ──▶ do that first. nothing else compares.

  Is decode dominating (long outputs)?
    └─ YES ─▶ weight-only quantisation
              speculative decoding
              GQA/MQA if choosing the model

  Is prefill dominating (long prompts, short outputs)?
    └─ YES ─▶ prefix caching (often the biggest win)
              chunked prefill
              int8 weight+activation

  Is memory the constraint (preemptions > 0)?
    └─ YES ─▶ paged attention, KV quantisation, GQA

  Is quality budget available?
    └─ YES ─▶ distillation or a cascade — usually the
              largest total win
```

## Validating any of it

```text
  □  quality on YOUR evaluation set, not a published benchmark
  □  quality on SLICES — compression often hurts rare cases
     disproportionately, and the aggregate hides it
  □  latency at p50 AND p99
  □  throughput at realistic concurrency
  □  memory headroom
  □  a numerical comparison against the unoptimised model on a
     fixture — export and compilation bugs produce plausible
     wrong answers
```

The slice check is the one most often skipped and the one most likely to find a
real problem: quantisation and distillation tend to preserve average performance
while degrading the tail of the input distribution, which is exactly where the
users who complain live.

## What to take away

1. Weight-only quantisation helps memory-bound decode; weight-and-activation helps
   compute-bound prefill and batch — applying the wrong one gives no speedup.
2. Distillation is frequently the largest win and is under-used because it looks
   like modelling; it works well on narrow tasks and poorly for broad capability.
3. Unstructured pruning gives no speedup without hardware support; 2:4
   semi-structured sparsity is the practical middle ground.
4. Speculative decoding verifies K draft tokens in one target pass and, with the
   correct acceptance rule, leaves the output distribution *exactly* unchanged.
5. Lookup-based speculation is free and works well whenever output copies from the
   input; cascades are simple and often the best cost/quality trade.
6. Validate compression on your own evaluation set and on slices — the aggregate
   hides degradation of the rare cases.

That completes inference optimization. Next in the track: **vector search and
retrieval infrastructure** — the serving system behind RAG and recommendation.
