---
title: Regularization and generalization
minutes: 18
summary: Why overparameterised networks generalise at all, and the techniques that help.
---

Classical statistics says a model with more parameters than data points will
memorise and fail to generalise. Deep networks have vastly more parameters than
data points and generalise well. Understanding why — and what actually helps — is
more useful than a list of techniques.

## The classical picture, and where it breaks

```text
  CLASSICAL BIAS-VARIANCE

  error │╲                    ╱
        │ ╲   underfit    ╱  overfit
        │  ╲___________╱
        │       sweet spot
        └────────────────────────▶ model capacity
```

```text
  DOUBLE DESCENT — what actually happens

  error │╲          ╱╲
        │ ╲______╱    ╲______________
        │             ↑
        │        interpolation
        │        threshold
        └────────────────────────────▶ capacity

  past the point where the model can fit the training data
  EXACTLY, test error falls AGAIN — often below the classical
  sweet spot.
```

**Bigger models can generalise better, not worse**, past the interpolation
threshold. The mechanism is not fully settled, but the working explanation is
implicit regularisation: among the many parameter settings that fit the training
data, gradient descent finds ones with particular properties (small norm, flat
minima) that happen to generalise.

The practical consequence: **do not reduce model size as a first response to
overfitting.** More data, better augmentation and appropriate regularisation are
usually better answers.

## The techniques

```text
  MORE DATA               the most effective, and often
                          unavailable

  DATA AUGMENTATION       transformations preserving the label
                          → effectively more data, for free

  WEIGHT DECAY            penalise large weights
                          → the default; 0.01–0.1 for
                            transformers

  DROPOUT                 randomly zero units during training
                          → strong for MLPs and CNNs
                          → largely REPLACED by other methods
                            in large transformers, which are
                            trained for ~1 epoch and cannot
                            overfit in the usual way

  EARLY STOPPING          stop when validation stops improving
                          → simple and effective

  LABEL SMOOTHING         target 0.9 instead of 1.0
                          → better calibration, less
                            overconfidence

  NORMALISATION           batch norm regularises as a side
                          effect (batch noise)

  ENSEMBLING              average several models
                          → reliably helps; costs N× inference
```

```text
  the modern LLM situation is different:

    trained on trillions of tokens for roughly ONE EPOCH,
    the model never sees an example twice.
    → classical overfitting barely applies
    → dropout is often disabled entirely
    → the constraint is DATA, not capacity
```

That distinction matters when reading advice: regularisation guidance written for
multi-epoch training on small datasets does not transfer to single-epoch training
on enormous ones.

## Data augmentation

```text
  IMAGES     crop, flip, rotate, colour jitter,
             mixup (blend two images and their labels),
             cutmix, RandAugment

  TEXT       back-translation, synonym replacement,
             paraphrase generation
             → weaker: text transformations often change
               meaning

  AUDIO      time stretch, pitch shift, noise, SpecAugment
```

```text
  the rule: the transformation must PRESERVE THE LABEL.

    flipping a photo of a cat → still a cat        ✓
    flipping a photo of text → no longer readable  ✗
    flipping a chest X-ray → dextrocardia, a
      different diagnosis                          ✗
```

The medical example is the one worth remembering: an augmentation that is
obviously label-preserving in one domain can silently destroy the label in
another, and the model learns from corrupted data with no error anywhere.

## Diagnosing

```text
  train loss ≪ validation loss, and diverging
    → OVERFITTING
    → more data, augmentation, weight decay, early stopping

  both high, both flat
    → UNDERFITTING
    → more capacity, longer training, higher LR, better
      features

  validation BETTER than training
    → usually normal: dropout and augmentation are active in
      training only
    → if the gap is large, suspect a data leak or different
      preprocessing between splits

  train loss falls, validation is noisy but flat
    → the model is learning something not present in
      validation — often a leak, or a distribution mismatch
```

## Test-set discipline

```text
  TRAIN        fit parameters
  VALIDATION   choose models, tune, early stopping
  TEST         touched ONCE, on the final choice
```

```text
  selecting the best of many runs on validation makes the
  validation metric OPTIMISTIC — you have implicitly fitted
  to it.

  → the test set exists to give an unbiased estimate, and it
    stops being unbiased the second time you look at it
```

This is the multiple-comparisons point from the evaluation topic, and it is the
most-violated rule in applied ML. If you look at the test set twice, it is a second
validation set and you need a new one.

## What actually helps most

Roughly in order of observed effect:

```text
  1. MORE / BETTER DATA
  2. appropriate AUGMENTATION
  3. the right ARCHITECTURE for the problem
  4. proper NORMALISATION and initialisation
  5. weight decay and early stopping
  6. dropout (for smaller models)
  7. ensembling — reliable, and expensive at inference
```

The ordering is the point: **data and architecture dominate regularisation
tricks.** Teams frequently tune dropout rates on a model that would improve far
more from a thousand more labelled examples.

## What to take away

1. Double descent means bigger models can generalise better past the interpolation
   threshold — do not shrink the model as a first response to overfitting.
2. Modern single-epoch LLM training barely overfits in the classical sense, so
   regularisation advice written for multi-epoch small-data training does not
   transfer.
3. Augmentation must preserve the label, and what preserves it is domain-specific —
   a flipped X-ray is a different diagnosis.
4. Validation better than training is usually normal; a large gap suggests a leak or
   preprocessing mismatch.
5. The test set is unbiased only until you look at it — selecting on validation
   makes that metric optimistic.
6. Data and architecture dominate regularisation tricks; tune those first.

Next: convolutional networks and vision.
