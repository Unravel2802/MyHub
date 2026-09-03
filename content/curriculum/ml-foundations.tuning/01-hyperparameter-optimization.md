---
title: Hyperparameter optimization and AutoML
minutes: 17
summary: Searching efficiently, and not fooling yourself with the result.
---

Hyperparameters are the settings not learned from data: learning rate, depth,
regularisation strength, architecture choices. Searching them well is mostly about
spending a fixed budget efficiently and not over-fitting the validation set in the
process.

## The search strategies

```text
  MANUAL            expert intuition
                    ✓ fast when you know the domain
                    ✗ does not scale; not reproducible

  GRID              exhaustive over a lattice
                    ✗ WASTEFUL: it spends the same number of
                      distinct values on the dimension that
                      matters and the one that does not

  RANDOM            sample from distributions
                    ✓ strictly better than grid at equal
                      budget (Bergstra & Bengio)
                    → 60 random samples land within the top
                      5% along the important dimensions with
                      ~95% probability

  BAYESIAN          model the objective; sample where
                    expected improvement is highest
                    ✓ best sample efficiency
                    ✗ sequential, so parallelises poorly

  HYPERBAND / ASHA  allocate budget adaptively; kill bad runs
                    early
                    ✓ usually the best WALL-CLOCK choice
                    ✓ combines with Bayesian sampling (BOHB)

  EVOLUTIONARY      mutate and select
                    → for large discrete spaces
```

```text
  why random beats grid, precisely

    with a grid of 5×5, you test 5 distinct values of each
    parameter.
    with 25 random samples, you test 25 distinct values of
    EACH — because every sample varies both.

    if only one parameter matters, grid explored it 5 times
    and random explored it 25 times.
```

## Successive halving

```text
  the idea behind Hyperband:

    start N configurations with a small budget
    keep the best half; double their budget
    repeat

    N=64 at 1 epoch
    32 at 2
    16 at 4
     8 at 8
     ...

  → most of the budget goes to promising configurations
  → typically 5–20× faster than training everything fully
```

```text
  the assumption it makes: early performance PREDICTS final
  performance.

  → usually true, and not always: a configuration with a
    long warmup or a low learning rate can look bad early
    and win eventually.
```

## What to search, and how

```text
  □  search LOG-scale for learning rate, weight decay,
     regularisation — they matter multiplicatively
  □  search LINEAR for layer counts, batch sizes
  □  fix the seed DURING search, then re-verify the winner
     across several seeds
  □  search the RANGES that matter — a badly chosen range
     wastes the whole budget
  □  record the SEARCH SPACE, not only the winner:
     "we tried LR from 1e-5 to 1e-1" is the reusable
     knowledge
```

```text
  the parameters worth searching, in order of impact

    learning rate            almost always dominant
    batch size (with LR)
    regularisation strength
    architecture width/depth
    everything else
```

## Overfitting the validation set

The failure specific to search, and the one that produces unreproducible results:

```text
  testing 200 configurations and picking the best means the
  validation metric is OPTIMISTICALLY BIASED — you have
  implicitly fitted to it.

  → the held-out performance of the winner will be worse
    than its validation performance, systematically
```

```text
  the defences

  □  a TEST SET touched once, on the final choice
  □  nested cross-validation for small data
  □  prefer fewer, better-chosen trials to many random ones
  □  be suspicious of a winner that beats the runner-up by
     less than the seed-to-seed variance
```

That last check is the practical one: if the top five configurations are within
noise of each other, you have not found a better configuration — you have found the
luckiest one.

## AutoML

```text
  automates: preprocessing, model selection, hyperparameter
  search, ensembling

    AutoGluon, auto-sklearn, H2O, cloud AutoML services
```

```text
  ✓  a strong BASELINE quickly, with little expertise
  ✓  good at tabular problems
  ✓  useful as a check on a hand-built model
  ✗  expensive in compute
  ✗  the result is often a large opaque ensemble
  ✗  it does not do FEATURE ENGINEERING or PROBLEM FRAMING,
     which is where most of the value is
```

**AutoML is best used as a baseline generator.** Run it, see what score is
achievable, and use that number to judge whether your hand-built model is worth
its complexity. Using it as the deliverable produces a model nobody can explain or
maintain.

## Practical guidance

```text
  □  start with sensible DEFAULTS — modern libraries have
     good ones
  □  tune the learning rate first, and often only
  □  use ASHA or Hyperband when you have parallel compute
  □  budget the search: define trials and time in advance
  □  log every trial (the experiment-tracking chapter)
  □  stop when improvements are within noise
  □  and remember: better DATA and FEATURES beat better
     hyperparameters, nearly always
```

## What to take away

1. Random search strictly beats grid at equal budget because every sample varies
   every dimension.
2. Successive halving (Hyperband/ASHA) is usually the best wall-clock choice, on the
   assumption that early performance predicts final performance.
3. Search learning rate and regularisation on a log scale, and record the search
   space rather than only the winner.
4. Testing many configurations biases the validation metric — keep a test set
   touched once, and distrust a winner inside the noise band.
5. AutoML is a baseline generator rather than a deliverable; it does not do feature
   engineering or problem framing.
6. Better data and features beat better hyperparameters nearly always — tune the
   learning rate and move on.

That completes the ML Foundations track. It connects forward to **Deep Learning**
for what these ideas become at scale, and to **ML Systems** for putting them into
production.
