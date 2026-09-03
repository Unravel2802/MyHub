---
title: Drift
minutes: 19
summary: The kinds of change that degrade a model, how to measure each, and which ones matter.
---

"Drift" covers several distinct phenomena with different causes and different
responses. Distinguishing them is what turns a drift alert from a nuisance into
an action.

## The kinds

```text
  COVARIATE SHIFT      P(X) changes, P(Y|X) does NOT
                       the inputs look different; the
                       relationship still holds
                       → a new user segment, a new region
                       → the model may still be fine

  CONCEPT DRIFT        P(Y|X) changes
                       the same inputs now imply a different
                       outcome
                       → fraud patterns evolve; user tastes
                         change
                       → the model IS wrong. retraining is
                         required.

  LABEL SHIFT          P(Y) changes
                       the base rate moves
                       → a fraud wave; a seasonal spike
                       → thresholds and calibration break

  UPSTREAM DATA
  CHANGE               not drift at all — a BUG
                       → a unit change, a renamed column, a
                         schema change
                       → the most common cause of a drift alert
```

```text
  the response differs completely:

    covariate shift    investigate; often no action needed
    concept drift      RETRAIN
    label shift        recalibrate; adjust thresholds
    upstream bug       FIX THE PIPELINE. do not retrain —
                       retraining bakes the corruption in.
```

**The fourth row is the most important operationally.** A drift alert should
trigger an investigation, not an automatic retrain, precisely because the most
likely cause is a broken pipeline and retraining on broken data is worse than
doing nothing.

## Measuring distribution change

```text
  POPULATION STABILITY INDEX (PSI)

    bucket both distributions, then
    PSI = Σ (actual% − expected%) × ln(actual% / expected%)

    < 0.1   no significant change
    0.1–0.2 moderate — investigate
    > 0.2   significant — act

  the industry default, particularly in finance. simple,
  interpretable, works on any binned feature.
```

```text
  KOLMOGOROV–SMIRNOV        max distance between CDFs
                            → continuous features; sensitive
                            → gives a p-value, which is a
                              problem at scale (see below)

  CHI-SQUARED               categorical features

  WASSERSTEIN               "earth mover" distance
                            → respects magnitude: a shift of
                              0.01 and a shift of 10 are
                              different, which KS does not see

  JENSEN–SHANNON            symmetric, bounded [0,1]
                            → good for comparing histograms
```

**The p-value trap** is worth stating plainly:

```text
  with a million samples, EVERY test is significant.
  a 0.1% shift in the mean gives p < 0.001 and matters to
  nobody.

  → use EFFECT SIZE (PSI, Wasserstein), not significance
  → or fix the sample size at a few thousand
```

This is the single most common reason drift monitoring gets ignored: it was built
on statistical tests over large samples, so it fires constantly.

## Multivariate drift

Individual features can each look stable while their *relationship* changes:

```text
  feature A: mean 50, unchanged
  feature B: mean 30, unchanged
  correlation(A,B): 0.8 → 0.1     ← the world changed
```

```text
  approaches

  DOMAIN CLASSIFIER   train a model to distinguish
                      "training data" from "recent data".
                      if it can (AUC ≫ 0.5), the distributions
                      differ — and its feature importances tell
                      you WHERE.
                      → simple, powerful, and diagnostic

  RECONSTRUCTION      an autoencoder on training data;
                      rising reconstruction error on new data
                      means it is unlike training

  EMBEDDING DRIFT     compare embedding distributions for
                      unstructured inputs
```

The domain classifier is the most useful of these because it does double duty:
it detects drift *and* points at which features are responsible, which is exactly
what the investigation needs.

## Prediction drift

The cheapest and often the most informative:

```text
  the model's OUTPUT distribution shifting is a summary of all
  input drift, weighted by how much the model actually cares.

  → a large input shift in an unimportant feature produces no
    prediction drift, correctly
  → a small shift in a critical feature produces a large one
```

That weighting property is why prediction drift is a better first alarm than
per-feature input drift: it automatically ignores changes the model does not use.

## Performance drift

The direct measure, once labels arrive:

```text
  □  accuracy over a rolling window vs the offline baseline
  □  the same, per SLICE
  □  calibration over time
  □  the business metric
```

```text
  the shape to watch for:

  accuracy
     │ ──────╲___
     │            ╲______
     │                    ╲____
     └──────────────────────────▶ time

  gradual decay → concept drift → retrain on a schedule

  accuracy
     │ ───────────┐
     │            └────────────
     └──────────────────────────▶ time

  a step change → something BROKE on that day → find it
```

**The shape of the curve identifies the cause.** Gradual decay is the world
moving; a step change is a deploy, a schema change or an upstream break, and the
question is what happened on that date.

## Responding

```text
  DRIFT DETECTED
       │
       ├─▶ is it an upstream BUG?
       │     check schema, nulls, ranges, freshness, and what
       │     shipped recently
       │     → FIX IT. do not retrain.
       │
       ├─▶ is performance actually affected?
       │     → covariate shift with stable performance often
       │       needs no action
       │
       ├─▶ is it a temporary anomaly?
       │     a holiday, an outage, a promotion
       │     → wait; do not train on the anomaly
       │
       └─▶ genuine concept drift?
             → RETRAIN on recent data
             → consider a shorter retraining cadence
             → consider whether the features still capture
               the phenomenon
```

The last line matters and is skipped: persistent concept drift after retraining
usually means the *feature set* no longer describes the world, not that the model
is stale. Retraining harder on inadequate features does not help.

## Retraining strategy

```text
  SCHEDULED       every N days
                  simple; retrains when nothing changed;
                  misses fast breaks

  TRIGGERED       on a drift or performance threshold
                  responsive; risks training on corrupted data

  CONTINUOUS      online learning, incremental updates
                  fastest adaptation; hardest to validate,
                  and a bad batch corrupts the model
                  immediately

  → most systems: SCHEDULED as a floor, TRIGGERED for sudden
    change, and ALWAYS gated on validation + evaluation
```

```text
  and the window question:

    ALL history         maximum data; slow to adapt
    RECENT ONLY         fast adaptation; may forget rare cases
    WEIGHTED            recent data weighted higher — usually
                        the right answer

  seasonal data needs FULL CYCLES, not just recent weeks —
  training a retail model on November data alone produces
  something that expects Christmas every month.
```

## What to take away

1. Covariate shift, concept drift, label shift and upstream bugs are different
   phenomena with different responses — and the upstream bug is the most likely.
2. A drift alert should trigger an investigation, never an automatic retrain;
   retraining on corrupted data bakes the corruption in.
3. Use effect sizes (PSI, Wasserstein), not p-values — at large sample sizes
   everything is significant and the alerts get ignored.
4. A domain classifier detects multivariate drift and tells you which features are
   responsible.
5. Prediction drift is the best first alarm because it weights input changes by how
   much the model actually uses them.
6. The shape of the performance curve identifies the cause: gradual decay is the
   world moving, a step change is something that broke on a date.

Next: incidents — what to do when the model is the problem.
