---
title: Learning theory
minutes: 18
summary: Why generalisation is possible at all, and the decompositions worth carrying.
---

Learning theory asks why fitting training data should tell you anything about
unseen data. The formal answers are loose in practice, and the *concepts* they
produce — bias-variance, capacity, the no-free-lunch result — are among the most
useful mental tools in applied ML.

## The setup

```text
  we minimise EMPIRICAL risk (loss on the training sample)
  and care about TRUE risk (expected loss on the
  distribution).

    generalisation gap = true risk − empirical risk
```

```text
  the assumption everything rests on:

    training and test data are drawn from the SAME
    DISTRIBUTION.

  → when it is violated, all guarantees evaporate
  → and it is violated constantly in production, which is
    what the monitoring topic's drift material is about
```

## Bias and variance

```text
  error = BIAS² + VARIANCE + IRREDUCIBLE NOISE

  BIAS       error from wrong assumptions — the model is too
             simple to represent the truth
  VARIANCE   error from sensitivity to the particular
             training sample
  NOISE      inherent randomness; no model can beat it
```

```text
  HIGH BIAS (underfit)          HIGH VARIANCE (overfit)
  train error high              train error low
  test error high, ≈ train      test error much higher
  → more capacity, better       → more data, augmentation,
    features, longer training     regularisation
```

```text
  the diagnostic is the GAP:

    both high, similar     → bias
    train low, test high   → variance
```

That single comparison determines which direction to move in, and it is the first
thing to compute when a model underperforms — before any hyperparameter tuning.

**And the classical trade-off is not the whole story**, as the regularisation
chapter covered: double descent means very overparameterised models can have low
bias *and* low variance, which the classical curve does not predict.

## Capacity

```text
  VC DIMENSION      the largest set of points a model class
                    can shatter (label arbitrarily)
                    → bounds are far too loose to be useful
                      for neural networks

  RADEMACHER
  COMPLEXITY        how well the class fits random noise
                    → tighter, still loose in practice

  the honest position: classical capacity measures do not
  explain why deep networks generalise. the bounds they give
  are vacuous — often larger than 1 for an error probability.
```

```text
  the current understanding is IMPLICIT REGULARISATION:

    among the many parameter settings that fit the training
    data, gradient descent finds particular ones — small
    norm, flat minima — that happen to generalise.

  → the ALGORITHM, not just the model class, determines
    generalisation.
```

That reframing is the useful takeaway: two models with identical architecture
trained differently generalise differently, so optimiser and schedule are part of
the model's inductive bias rather than merely its training procedure.

## No free lunch

```text
  averaged over ALL possible problems, every algorithm
  performs identically.

  → there is no universally best model
  → every method's advantage comes from ASSUMPTIONS that
    happen to match the problem
```

```text
  which is why INDUCTIVE BIAS is the design question:

    CNNs        locality, translation equivariance
    RNNs / SSMs sequential structure
    transformers weak bias, learned routing
    trees       axis-aligned splits
    linear      additive effects

  → choosing a model is choosing which assumptions to make
```

The practical corollary: **the "best model" question is meaningless without the
data.** Gradient-boosted trees beat neural networks on most tabular problems
because axis-aligned splits match tabular structure, and that is not a fact about
which is better in general.

## PAC learning, briefly

```text
  Probably Approximately Correct:

    with probability ≥ 1−δ, the error is ≤ ε,
    given m examples, where m grows with capacity and with
    1/ε and 1/δ.
```

The concrete content is a scaling relationship: **more data reduces error, more
capacity requires more data, and higher confidence requires more data.** The
constants are useless; the shape is right, and it is why "more data" is a reliable
answer.

## Cross-validation

```text
  HOLDOUT        one train/test split
                 → fast; high variance on small data

  k-FOLD         k splits, average the results
                 → better estimate, k× the compute

  STRATIFIED     preserve class proportions per fold

  GROUPED        keep related samples in ONE fold
                 → essential when samples share an entity
                   (a patient, a user, a document)

  TIME SERIES    train on past, test on future, always
                 → a random split leaks the future
```

The grouped and time-series cases are where cross-validation is most often done
wrong, and both produce the same symptom: an optimistic estimate that does not
survive deployment.

## The practical residue

```text
  □  DIAGNOSE bias vs variance from the train/test gap before
     tuning anything
  □  choose a model class whose inductive bias matches the
     data
  □  more data is the most reliable improvement
  □  a validation set used for selection is optimistic;
     keep a test set touched once
  □  all guarantees assume the same distribution — which is
     why production monitoring exists
```

## What to take away

1. Everything rests on train and test coming from the same distribution, which
   production violates constantly.
2. The train/test gap diagnoses bias versus variance and determines which direction
   to move — compute it before tuning.
3. Classical capacity measures give vacuous bounds for neural networks;
   generalisation is currently explained by implicit regularisation from the
   optimiser.
4. That means the algorithm is part of the inductive bias, not just the
   architecture.
5. No free lunch: every method's advantage comes from assumptions matching the
   problem, so "best model" is meaningless without the data.
6. Group your cross-validation folds by entity and split time series temporally, or
   you get an optimistic estimate that does not survive deployment.

Next: the supervised learning methods themselves.
