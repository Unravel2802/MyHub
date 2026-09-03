---
title: Training dynamics
minutes: 19
summary: Optimizers, schedules and normalisation — the settings that decide whether a model converges.
---

The forward pass and the loss are usually not where a training run goes wrong.
Convergence is decided by the optimizer, the learning-rate schedule and the
normalisation, and these interact in ways that make each one hard to tune in
isolation.

## Optimizers

```text
  SGD                 θ ← θ − η∇L
                      simple; slow; needs careful tuning

  SGD + MOMENTUM      accumulate a velocity
                      v ← βv + ∇L ;  θ ← θ − ηv
                      → damps oscillation, accelerates along
                        consistent directions
                      → still the best generaliser for vision

  ADAM                per-parameter adaptive rates from the
                      first and second gradient moments
                      → robust, fast, needs little tuning
                      → the default for transformers

  ADAMW               Adam with DECOUPLED weight decay
                      → in Adam, L2 regularisation interacts
                        badly with the adaptive scaling;
                        decoupling fixes it
                      → use AdamW, not Adam. always.
```

```text
  the memory cost, which the training-infra topic depends on

    SGD               1× parameters (no state)
    SGD + momentum    2×
    Adam / AdamW      3×  (momentum + variance)

  → for a 7B model, Adam's state alone is ~56 GB in fp32
  → hence 8-bit optimizers and ZeRO sharding
```

**Adam's bias correction matters and is easy to get wrong on resume:** the moment
estimates start at zero and are corrected by a factor depending on the step count.
Restoring an optimizer without its step count restarts that correction and
produces a visible loss disturbance — the resume bug from the training-infra
topic, in its specific form.

## Learning rate

The most important hyperparameter, by a wide margin.

```text
  TOO HIGH                          TOO LOW
  loss spikes, oscillates, NaNs     converges very slowly
  diverges early                    plateaus at a worse value
```

```text
  the LR RANGE TEST finds it in one short run:
    increase LR exponentially over a few hundred steps,
    plot loss against LR, take roughly the point of
    steepest descent (or 1/3 of the minimum).
```

```text
  SCHEDULES

  WARMUP        linear from 0 over the first 1–10% of steps
                → ESSENTIAL for transformers and Adam: the
                  second-moment estimate is unreliable early,
                  so a full LR at step 0 destabilises

  COSINE        smooth decay to ~0
                → the standard for a fixed-length run

  WSD           warmup, constant, then a short sharp decay
                → the run length need not be known in advance,
                  and you can branch off at any point

  ONE-CYCLE     up then down
                → fast convergence for shorter runs
```

WSD (warmup-stable-decay) is worth knowing because it removes a practical
annoyance: cosine requires committing to a total step count up front, and WSD lets
you train indefinitely and decay whenever you decide to stop.

```text
  and the batch-size coupling

    larger batch → the gradient is less noisy → a larger LR
    is usable

    LINEAR scaling  lr ∝ batch      (vision)
    SQRT scaling    lr ∝ √batch     (often better for
                                     transformers)

  → changing batch size without changing LR invalidates the
    comparison, as the distributed-training chapter said.
```

## Normalisation

```text
  BATCH NORM     normalise across the BATCH, per feature
                 ✓ strong regulariser; accelerates vision
                   training
                 ✗ depends on batch size and composition
                 ✗ different behaviour in train and eval
                 ✗ awkward in distributed training (needs
                   syncing) and for sequences

  LAYER NORM     normalise across FEATURES, per example
                 ✓ batch-independent; identical in train and
                   eval
                 ✓ works for variable-length sequences
                 → the standard for transformers

  RMS NORM       layer norm without mean subtraction
                 → 10–15% faster, no measurable quality cost
```

```text
  WHY normalisation helps

    □  keeps activation scales stable through depth
    □  makes the loss surface better conditioned, so larger
       learning rates are usable
    □  reduces sensitivity to initialisation
```

Batch norm's train/eval difference is a recurring source of bugs: it uses batch
statistics in training and running averages at inference, so a model evaluated in
train mode gives different (usually better-looking) numbers. This is the
`model.eval()` bug from the previous chapter, and batch norm is what makes it
consequential.

## Gradient clipping

```text
  if ‖∇‖ > threshold:  ∇ ← ∇ · threshold/‖∇‖

  → bounds the step size when a bad batch produces an
    enormous gradient
  → essential for transformers and RNNs; typical threshold 1.0
```

**Log the gradient norm continuously.** As the training-infra topic noted, a rising
norm precedes divergence by many steps and is the best available early warning.

## Reading a loss curve

```text
  HEALTHY                    train ╲___
                             valid  ╲___
                             both falling, valid tracking train

  OVERFITTING                train ╲____
                             valid  ╲__/‾‾‾
                             valid turns up → stop, or
                             regularise

  UNDERFITTING               both plateau high
                             → more capacity, longer training,
                               better features

  LR TOO HIGH                ╲/╲/╲/  oscillating or spiking

  A BAD BATCH                a single spike that recovers
                             → clipping handles it

  DEAD                       flat from step 0
                             → the tiny-batch test from the
                               training-infra topic
```

## Practical defaults

```text
  TRANSFORMERS
    AdamW, β = (0.9, 0.95), weight decay 0.1
    LR 1e-4 to 3e-4 for smaller models, lower for large
    warmup 1–2k steps, cosine or WSD decay
    gradient clipping at 1.0
    bf16 mixed precision
    LayerNorm or RMSNorm, pre-norm

  VISION (CNN)
    SGD + momentum 0.9, or AdamW
    LR 0.1 (SGD) with cosine decay
    weight decay 1e-4
    batch norm
```

```text
  the tuning ORDER, when something is wrong

    1. learning rate       (by far the most impactful)
    2. batch size and its LR coupling
    3. warmup length
    4. weight decay
    5. everything else
```

## What to take away

1. Use AdamW rather than Adam — decoupled weight decay fixes a genuine interaction
   with the adaptive scaling — and remember its state is 2× the parameters.
2. Learning rate is the dominant hyperparameter; find it with an LR range test
   rather than by guessing.
3. Warmup is essential for transformers because Adam's second-moment estimate is
   unreliable at the start; WSD removes the need to commit to a step count.
4. Batch size and learning rate are coupled — changing one without the other
   invalidates the comparison.
5. LayerNorm/RMSNorm is batch-independent and identical in train and eval, which is
   why transformers use it; batch norm's train/eval difference causes real bugs.
6. Clip gradients and log the gradient norm — a rising norm is the best early
   warning of divergence.

Next: making a model generalise rather than memorise.
