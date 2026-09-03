---
title: Numerical precision
minutes: 19
summary: Trading bits for speed and memory, why bf16 replaced fp16, and where precision must be kept.
---

Lower precision is the rare optimisation that improves two things at once: fewer
bytes to move and faster arithmetic. It is also the one most likely to produce
silently wrong results, because a model trained in the wrong format does not
crash — it diverges, or converges to something worse.

## The formats

```text
  format   bits   exponent  mantissa   range          use
  ──────   ────   ────────  ────────   ─────          ───
  fp32      32       8         23      ±3.4e38        the reference
  tf32      19       8         10      ±3.4e38        A100+ matmul
  bf16      16       8          7      ±3.4e38        TRAINING
  fp16      16       5         10      ±65,504        legacy/inference
  fp8       8      4 or 5    3 or 2    small          H100+ inference
  int8      8        —         —       ±127           quantised
  fp4/int4   4       —         —       tiny           aggressive
```

The row that explains everything:

```text
  bf16 has the SAME EXPONENT BITS as fp32.

  → the same dynamic range: ±3.4e38
  → it CANNOT overflow where fp32 would not
  → it trades mantissa (precision) rather than range

  fp16 has only 5 exponent bits:
  → max 65,504. gradients and activations exceed this routinely.
  → underflows below ~6e-8, where small gradients vanish to zero.
```

That difference is why **bf16 replaced fp16 as the training default** on hardware
that supports it. fp16 training requires loss scaling to keep gradients in range;
bf16 usually does not need it at all.

```text
  fp16 TRAINING WITHOUT LOSS SCALING

    gradients are small — often 1e-8 or below
    fp16's smallest normal value is ~6e-5
    → gradients FLUSH TO ZERO
    → the model does not learn, and nothing errors
```

## Mixed precision

The standard recipe: compute in low precision, accumulate and update in high.

```text
  ┌──────────────────────────────────────────────────────┐
  │  FORWARD    bf16     matmuls on tensor cores          │
  │  BACKWARD   bf16     gradients in bf16                │
  │  ACCUMULATE fp32     tensor cores accumulate in fp32  │
  │  MASTER     fp32     a full-precision copy of weights │
  │  UPDATE     fp32     optimizer step in fp32           │
  └──────────────────────────────────────────────────────┘
```

The fp32 master copy exists for a specific reason:

```text
  weight = 1.0,  update = 0.0001

  in bf16 (7 mantissa bits), 1.0 + 0.0001 rounds to 1.0
  → the update is LOST. every step. the model stops learning.

  in fp32, the update accumulates correctly.
```

This is **stochastic rounding's problem** and the reason "just train in bf16
everywhere" fails: small updates to large weights vanish. The master copy costs 4
bytes per parameter and is not optional for standard optimisers.

## Loss scaling, for fp16

```text
  gradients are small and fp16 underflows

  FIX: multiply the loss by S before backward, divide the
       gradients by S before the optimizer step

  loss = loss * 65536
  loss.backward()                 # gradients are 65536× larger
  for p in params: p.grad /= 65536
  optimizer.step()
```

**Dynamic loss scaling** adjusts S automatically: increase it while no overflow
occurs, halve it and skip the step when an inf or NaN appears. This is what
`torch.cuda.amp.GradScaler` does.

None of this is needed with bf16, which is a genuine simplification and the main
practical argument for it.

## What must stay in higher precision

```text
  □  SOFTMAX          exponentials overflow easily; compute in
                      fp32 (subtracting the max first)
  □  LAYER NORM /
     BATCH NORM       variance accumulation loses precision
  □  LOSS             especially cross-entropy with log
  □  OPTIMIZER STATE  Adam's second moment spans many orders
                      of magnitude
  □  MASTER WEIGHTS   as above
  □  LARGE REDUCTIONS summing millions of values in bf16
                      accumulates error
  □  ATTENTION SCORES before softmax, for long sequences
```

Framework autocast handles most of these automatically by maintaining a list of
ops that stay in fp32. **Writing a custom kernel or a custom loss means taking
that responsibility yourself**, and it is a common source of subtle instability in
hand-written code.

## Quantisation for inference

Training needs gradients; inference does not, which allows far more aggressive
formats.

```text
  POST-TRAINING QUANTISATION (PTQ)
    quantise a trained model directly
    + no retraining; minutes to apply
    - some accuracy loss, especially below 8 bits

  QUANTISATION-AWARE TRAINING (QAT)
    simulate quantisation during training so the model adapts
    + much better accuracy at low bit widths
    - requires a training run
```

```text
  typical quality (LLMs, perplexity change)

    bf16 → int8    negligible
    bf16 → int4    small with a good method (GPTQ/AWQ), noticeable
                   with naive rounding
    bf16 → int3-   significant degradation without QAT
```

The mechanics that matter:

```text
  x_int = round(x / scale) + zero_point

  PER-TENSOR    one scale for the whole tensor — simple, worst
  PER-CHANNEL   one scale per output channel — much better
  PER-GROUP     one scale per group of ~64–128 weights —
                the standard for 4-bit LLM quantisation

  finer granularity → better accuracy, slightly more metadata
```

**Outliers are the central difficulty.** A few activations with enormous magnitude
force a large scale, which destroys resolution for everything else. The
established answers:

```text
  SmoothQuant   shift difficulty from activations to weights by
                rescaling both
  AWQ           identify the ~1% of salient weights and protect them
  GPTQ          quantise layer by layer, minimising reconstruction
                error against real activations
  MIXED         keep outlier channels in higher precision
```

And the distinction that decides what you gain:

```text
  WEIGHT-ONLY quantisation (weights int4, activations bf16)
    → helps the MEMORY-BOUND case: batch-1 generation reads
      4× fewer bytes → up to 4× faster
    → does NOT use int8 tensor cores

  WEIGHT AND ACTIVATION quantisation (both int8)
    → uses int8 tensor cores → helps the COMPUTE-bound case,
      i.e. large batches
    → harder to keep accurate, because of activation outliers
```

Since batch-1 generation is bandwidth-bound (previous chapter), **weight-only
4-bit is the standard choice for single-stream LLM inference**, and int8
weight-and-activation is for high-throughput batch serving. Choosing the wrong one
gives a speedup of approximately zero.

## Diagnosing precision problems

```text
  SYMPTOM                            LIKELY CAUSE
  ───────                            ────────────
  loss NaN early with fp16           overflow; use bf16 or
                                     loss scaling
  loss plateaus, gradients tiny      fp16 underflow
  works in fp32, not in fp16/bf16    a reduction or softmax that
                                     needs fp32
  small quality loss after           accumulation precision, or a
  a precision change                 layer that should stay fp32
  quantised model much worse         activation outliers; try
                                     per-group or AWQ/GPTQ
  results differ across GPUs         different tensor-core paths;
                                     expected, within noise
```

```text
  the debugging order:
    1. reproduce in fp32 — does the problem disappear?
    2. bisect: cast individual layers back to fp32
    3. check for inf/NaN after each block
    4. compare intermediate activation statistics against the
       fp32 run
```

## The practical defaults

```text
  TRAINING
    bf16 mixed precision where the hardware supports it
    fp16 + dynamic loss scaling only on older hardware
    fp32 master weights and optimizer state
    8-bit optimizer states when memory-constrained

  INFERENCE
    single-stream / interactive → weight-only int4 (AWQ/GPTQ)
    high-throughput batch        → int8 weight+activation
    quality-critical             → bf16
    always: MEASURE quality on YOUR evaluation set, not on a
            published benchmark
```

That last line matters. Published quantisation results are on standard benchmarks;
your task's sensitivity may be quite different, and the check is cheap.

## What to take away

1. bf16 shares fp32's exponent range, so it does not overflow or underflow where
   fp16 does — which is why it replaced fp16 for training and removes the need for
   loss scaling.
2. Mixed precision computes in low precision and accumulates and updates in fp32;
   the fp32 master copy exists because small updates to large weights vanish in
   bf16.
3. Softmax, normalisation, loss, reductions and optimizer state must stay in
   higher precision — autocast handles this, custom kernels do not.
4. Quantisation granularity (per-tensor, per-channel, per-group) and outlier
   handling determine quality far more than the bit width alone.
5. Weight-only int4 helps bandwidth-bound single-stream generation; int8
   weight-and-activation helps compute-bound batch serving — choosing wrong gives
   no speedup.
6. Always measure quantised quality on your own evaluation set rather than trusting
   published benchmark numbers.

Next: reading a profile, and finding out what is actually slow.
