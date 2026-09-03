---
title: Debugging a training run
minutes: 18
summary: A procedure for a model that is not learning, ordered by what is most often wrong.
---

"The loss is not going down" has a small number of causes and a reliable
diagnostic order. Working through it systematically takes an hour; guessing at
hyperparameters takes a week and usually finds the wrong answer.

## The order

Cheapest and most likely first:

```text
  1. CAN IT OVERFIT 10 EXAMPLES?
  2. Is the data what you think it is?
  3. Is the loss what you think it is?
  4. Are gradients flowing?
  5. Is the learning rate sane?
  6. Only now: architecture and hyperparameters
```

Most teams start at 6. Almost all real bugs are at 1–4.

## Step 1: overfit a tiny batch

```text
  take 10 examples. train on them, repeatedly, with no
  regularisation, no augmentation, no dropout.

  the loss MUST go to approximately zero.

  if it does not, there is a BUG. no amount of tuning will
  fix it, because the model cannot even memorise ten things.
```

This runs in seconds and is the highest-value test in ML engineering. When it
fails, the cause is one of:

```text
  □  the loss is not connected to the parameters
       (a detached tensor, a `with torch.no_grad()` in the
        wrong place, a numpy round-trip in the middle)
  □  the optimizer is not stepping
       (no `optimizer.step()`, or the params were not passed
        to the optimizer)
  □  labels are shuffled relative to inputs
  □  the model is in eval mode during training
  □  the learning rate is 0, or absurdly small
  □  a layer is frozen that should not be
  □  gradients are being zeroed AFTER backward, not before
```

## Step 2: look at the data

```text
  □  PRINT AN ACTUAL BATCH. inputs and labels, denormalised,
     rendered as the human-readable thing they represent.
     look at it.
  □  check the label distribution — is it what you expect?
  □  check input ranges — normalised, or still 0–255?
  □  verify the input/label ALIGNMENT survived shuffling
  □  check for NaN or inf in the inputs
  □  confirm augmentation is not destroying the signal
     (a random crop that removes the object; a normalisation
      applied twice)
```

**Looking at a batch is the most under-used debugging technique in ML.** Rendering
ten training images with their labels, or printing ten tokenized sequences with
their targets, catches an enormous share of real bugs in under a minute — and it
is skipped because it feels too basic.

The alignment check deserves its own note: a shuffle applied to inputs and labels
separately produces a dataset where nothing is learnable, and the symptom is
exactly "the loss will not go below chance".

## Step 3: check the loss

```text
  □  what is the loss at INITIALISATION?
       for balanced n-way classification it should be ≈ ln(n)
         2-way:  0.693
         10-way: 2.303
         1000-way: 6.908
       a very different starting loss means the output layer,
       the loss function, or the label encoding is wrong

  □  are you using the right loss for the output?
       cross-entropy expecting LOGITS, given softmax output
       → the classic double-softmax, which trains slowly and
         badly rather than failing

  □  is the reduction right? mean vs sum changes the effective
     learning rate by the batch size

  □  is class imbalance being handled?
       99% negatives means predicting all-negative gets 99%
       accuracy and a low loss
```

The initialisation-loss check is a thirty-second test with a high hit rate. A
10-class problem starting at 0.5 rather than 2.3 means the model is already
confident, which means the labels or the loss are wrong.

## Step 4: gradients

```text
  □  print gradient NORMS per layer after backward

  healthy:   norms within a couple of orders of magnitude
             of each other

  VANISHING: early layers ~1e-8, later layers ~1e-2
             → deep network without residuals, saturating
               activations, or bad initialisation

  EXPLODING: norms 1e4+, then NaN
             → too-high LR, no gradient clipping, an unstable
               loss

  ZERO:      some layer's gradient is exactly 0
             → it is detached, frozen, or unreachable from
               the loss
```

```python
for name, p in model.named_parameters():
    if p.grad is None:
        print(f"{name}: NO GRADIENT")        # ← usually the bug
    else:
        print(f"{name}: {p.grad.norm():.3e}")
```

`None` gradients on a parameter you expected to train is a precise, immediate
finding: that parameter is not connected to the loss.

## Step 5: learning rate

```text
  TOO HIGH                           TOO LOW
  ────────                           ───────
  loss spikes or NaNs                loss decreases very slowly
  loss oscillates                    loss plateaus early at a
  diverges after a few steps           bad value
```

The **LR range test** finds a good value in one short run:

```text
  increase the LR exponentially over a few hundred steps and
  plot loss against LR

  loss
    │╲
    │ ╲___
    │      ╲___
    │           ╲__          ← steepest descent: a good LR is
    │              ╲╱─╲        roughly here, or 1/3 of the
    │                   ╲      minimum
    └───────────────────────▶ log(LR)
      1e-6              1e-1
```

And two settings that matter more than the peak value:

**Warmup.** Starting at the full LR with a randomly initialised model — especially
with Adam, whose second-moment estimate is unreliable early — often destabilises
training. A few hundred to a few thousand warmup steps is standard and frequently
the difference between diverging and converging.

**The batch-size interaction.** As the previous chapters noted, changing batch
size without rescaling the LR invalidates the comparison.

## Step 6: only now, the model

```text
  □  is the architecture appropriate for the data size?
       a large model on a small dataset memorises;
       a small model on a large dataset underfits
  □  is regularisation appropriate? too much prevents fitting
  □  is normalisation placed correctly?
  □  is the initialisation scheme right for the depth?
```

And the check that reframes everything:

```text
  WHAT IS THE BASELINE?

  predict the majority class          → accuracy?
  predict the mean                    → error?
  a logistic regression on 5 features → accuracy?

  a deep model that does not beat logistic regression is not
  a modelling problem. it is a bug, or the features carry no
  signal.
```

## Symptom → cause table

```text
  loss is NaN
    → LR too high · division by zero · log(0) · fp16 overflow
    → clip gradients; check the loss for degenerate inputs;
      try bf16 instead of fp16

  training loss falls, validation does not
    → overfitting · a train/val distribution mismatch · leakage
      in the training set only

  validation is BETTER than training
    → dropout/augmentation active in training only (normal,
      and mild) · a data leak into validation · different
      preprocessing between the two

  loss decreases then explodes
    → LR too high late in training · a bad batch ·
      numerical instability

  loss is flat from step 0
    → gradients not flowing · LR ≈ 0 · the tiny-batch test
      will catch it

  works on 1 GPU, not on 8
    → LR not scaled for the larger effective batch ·
      batch norm computing statistics per rank ·
      a data sharding bug where ranks see the same data
```

That last row is worth remembering. **Multi-GPU changes the effective batch
size**, so a configuration tuned on one GPU is not the same experiment on eight.
And batch normalisation computes statistics per device unless synchronised, which
changes the model's behaviour with the number of ranks.

## The discipline

```text
  □  change ONE thing at a time
  □  keep a small, fast configuration for debugging — a small
     model on a small subset, iterating in under a minute
  □  reproduce at small scale before debugging at large scale
  □  write the tiny-batch test into the test suite so a
     regression is caught by CI
  □  log the gradient norm continuously in production runs —
     a spike precedes divergence by many steps
```

The fast debug configuration is worth setting up deliberately. Debugging with a
twenty-minute iteration loop produces bad hypotheses because the cost of testing
one is too high; getting the loop under a minute changes how carefully you can
think.

## What to take away

1. Work the order: overfit ten examples, look at the data, check the loss, check
   gradients, check the LR — and only then the architecture.
2. "Can it overfit ten examples?" runs in seconds and catches most training-loop
   bugs; put it in the test suite.
3. Actually print and look at a batch — it is the most under-used technique and
   catches misalignment, wrong ranges and destructive augmentation.
4. Check the loss at initialisation against ln(n); a very different value means the
   loss, output layer or labels are wrong.
5. Print per-layer gradient norms; a `None` gradient is an immediate, precise
   finding.
6. Establish a baseline — a deep model that does not beat logistic regression has a
   bug or no signal, not a tuning problem.

That completes training infrastructure. Next in the track: **GPUs and
accelerators** — what the hardware actually does, and why some operations are
hundreds of times faster than others.
