---
title: Training/serving skew
minutes: 20
summary: The defect that makes an excellent offline model useless in production, and the four ways it arises.
---

A model performs beautifully in evaluation and disappointingly in production. The
overwhelmingly most common cause is not overfitting, not distribution shift, and
not a bad metric — it is that **the features the model sees in production are not
the features it was trained on**. This is training/serving skew, and it is the
defining production failure of ML systems.

## The shape of it

```text
  TRAINING                           SERVING
  ────────                           ───────
  batch job over a warehouse         a request handler
  Python, pandas, Spark              Java/Go, a different codebase
  full history available             only what is in the cache
  seconds per row is fine            50 ms for everything
  written by a data scientist        written by an engineer

  → TWO IMPLEMENTATIONS of "the same" feature
  → they differ. they always differ.
```

The model learned a relationship between *the training implementation's outputs*
and the label. Serving a different implementation's outputs breaks that
relationship, and the model has no way to signal it — it produces a confident
number from a feature vector that means something slightly different from what it
was taught.

## The four sources

**1. Two implementations.** The direct case above. Even faithful reimplementation
diverges on edge cases: a different null handling, a different rounding, a
different tokenizer, a locale-dependent date parse.

```text
  training  (pandas):  df["amount"].fillna(df["amount"].mean())
  serving   (Java):    amount == null ? 0.0 : amount
                                        ▲
              trained on the mean, served zeros. the model
              interprets every missing value as an extreme low.
```

**2. Different data sources.** Training reads a warehouse table that has been
cleaned, deduplicated and backfilled. Serving reads a live API that has not.

```text
  warehouse:  currency normalised to USD by a nightly job
  live API:   raw, in local currency
  → the model sees 45,000 (yen) where it learned 300 (dollars)
```

**3. Time skew.** The most subtle, and the subject of the next chapter. Training
computes a feature using data that would not have been available at prediction
time.

**4. Feedback skew.** The model's own predictions change the distribution of what
it later sees, as the framing chapter described.

## A worked failure

```text
  feature: "average order value over the last 30 days"

  TRAINING
    SELECT AVG(amount) FROM orders
     WHERE user_id = ? AND created_at > now() - 30 days

    → over the WAREHOUSE, which includes orders that arrived
      late and were backfilled

  SERVING
    reads a Redis key updated by a streaming job

    → the streaming job drops late-arriving orders
    → and it was down for 40 minutes yesterday

  RESULT
    training values are systematically higher than serving values.
    the model's learned threshold is calibrated to a distribution
    production never produces.
```

Nothing errors. Latency is fine. The model returns 200s. Accuracy is quietly
several points lower than the offline number, and every subsequent investigation
looks at the model.

## Detection

Skew is invisible unless you look for it deliberately. Three techniques, in
increasing strength:

**Log serving features and compare distributions.** The minimum viable check, and
it catches most cases:

```text
  for each feature, compare training vs serving:
    mean, stddev, min, max, null rate, cardinality

  alert when any diverges beyond a threshold
```

```text
  feature: days_since_signup
    training: mean 142.3, nulls 0.2%
    serving:  mean 141.9, nulls 0.2%     ✓

  feature: avg_order_value_30d
    training: mean 84.20, nulls 1.1%
    serving:  mean 71.05, nulls 8.4%     ✗ SKEW
                                            and a null-rate jump
```

**Log-and-replay.** Log the exact feature vector the serving path produced, then
score it offline with the training-path implementation and compare outputs
row by row. This catches per-row differences that distribution comparison misses —
two distributions can match while individual values are wrong.

```text
  serving produced:  [0.4, 12, 1, 0.88]  → 0.71
  training path on
  the same entity:   [0.4, 12, 1, 0.31]  → 0.34
                                  ▲
                         feature 4 differs. found it.
```

**Train on logged serving features.** The strongest version: instead of
recomputing features for training, use the features that were *actually served*.
Skew becomes structurally impossible, because there is only one implementation and
its output is the training input.

```text
  serve ──▶ feature vector ──▶ prediction
              │
              └──▶ LOGGED, and joined to the outcome later
                   → this is the training row
```

The cost is that you can only train on features you were already serving, so
adding a feature means logging it for weeks before you can use it. Many mature
systems accept that and do it anyway, because it removes the entire failure class.

## Prevention

Ordered by how completely each removes the problem:

```text
  1. ONE IMPLEMENTATION, SHARED
     the same code computes features for training and serving.
     → a feature store, or a shared library
     → the strongest structural fix

  2. TRAIN ON LOGGED SERVING FEATURES
     as above. eliminates skew by construction.

  3. SAME DATA SOURCE
     serving reads the same store training reads, or a
     materialised view of it

  4. CONTRACT TESTS
     given this input, both paths must produce the same
     feature vector. run in CI.

  5. MONITORING
     compare distributions continuously. the safety net,
     not the fix.
```

**Contract tests deserve more use than they get.** A test fixture of a hundred
entities, with the expected feature vector, run against both implementations in
CI, catches reimplementation drift the moment it is introduced rather than in
production three weeks later. It is cheap and almost nobody does it.

## The transform-at-training-time trap

A specific and common version worth its own note:

```text
  BAD
    training:  scaler.fit_transform(X_train)   # fits on train data
    serving:   scaler.fit_transform(X_request) # fits on ONE ROW

  → at serving, the scaler normalises a single row against itself.
    every feature becomes 0. the model receives garbage.
```

Any stateful transform — scaling, encoding, imputation, vocabulary building —
must have its **parameters fitted during training and shipped with the model**,
then applied unchanged at serving. This is what a serialised preprocessing
pipeline is for, and treating preprocessing as part of the model artifact rather
than as separate code is the fix.

```text
  the model artifact should contain:
    the weights
    + the preprocessing parameters (scaler stats, vocabularies,
      imputation values, encoding maps)
    + the feature ORDER
```

Feature order is the mundane one that still causes incidents: a model expecting
`[age, income, tenure]` served `[income, age, tenure]` produces confident
nonsense with no error.

## What to take away

1. Training/serving skew is the defining production failure of ML systems: the
   model sees different features than it was trained on, and cannot signal it.
2. It arises from two implementations, different data sources, time skew, and
   feedback — the first is the most common and the most preventable.
3. Detect by comparing feature distributions continuously, and by log-and-replay,
   which catches per-row differences a distribution comparison misses.
4. The strongest fixes are structural: one shared implementation, or training on
   the features that were actually served.
5. Contract tests comparing both paths on fixed inputs are cheap, run in CI, and
   are almost never used.
6. Stateful transforms must be fitted at training and shipped with the model —
   along with the feature order.

Next: time skew specifically — the leakage that makes an offline metric a lie.
