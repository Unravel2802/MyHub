---
title: Point-in-time correctness
minutes: 20
summary: Building a training set that only knows what was knowable, and the leakage that makes a model look brilliant.
---

A model with 99% offline accuracy that fails completely in production is almost
always a leakage story: the training set contained information that would not
have been available at prediction time. The model learned to use the future, and
production does not supply one.

## What leakage looks like

```text
  predicting: will this loan default?

  a feature in the training set: `collections_contact_count`

  → collections only contact you AFTER you default.
  → the model learns "collections contacted them" ⇒ default
  → 99.4% AUC offline.
  → in production the feature is always 0, because the prediction
    happens at APPLICATION time.
  → the model is worthless, and its offline number said otherwise.
```

The tell is a metric that seems too good. **An unexpectedly excellent result
should be treated as a bug report until proven otherwise**, and the first
hypothesis is always leakage.

## The forms

```text
  TARGET LEAKAGE
    a feature is a consequence of the label
    → collections contact, cancellation reason, refund amount

  TEMPORAL LEAKAGE
    a feature uses data from after the prediction moment
    → "total orders" computed today for a prediction made in March

  TRAIN/TEST CONTAMINATION
    the same entity, or a near-duplicate, in both splits
    → the model memorises rather than generalises

  PREPROCESSING LEAKAGE
    a transform fitted on the FULL dataset before splitting
    → the scaler saw the test set's distribution

  GROUP LEAKAGE
    rows from one user split across train and test
    → the model learns the user, not the pattern
```

Preprocessing leakage is worth emphasising because it is so easy to write:

```text
  WRONG                              RIGHT

  X = scaler.fit_transform(X)        X_tr, X_te = split(X)
  train, test = split(X)             scaler.fit(X_tr)
                                     X_tr = scaler.transform(X_tr)
  → the scaler's statistics          X_te = scaler.transform(X_te)
    include the test set
```

The same applies to imputation values, feature selection, target encoding and
vocabulary building. **Any statistic computed from data must be computed from the
training split alone.**

## Point-in-time correctness

The general discipline: every feature value in a training row must be **what was
knowable at that row's prediction timestamp**.

```text
  ┌─────────────────────────────────────────────────────────┐
  │                    prediction time T                     │
  │                          │                               │
  │  ◀──── may use ─────────┤├──── MUST NOT use ────────▶   │
  │      everything before   │      anything after           │
  └─────────────────────────────────────────────────────────┘
```

The naive join breaks this, and it is the standard way leakage enters:

```text
  WRONG — joins the CURRENT feature value to a historical event

    SELECT e.user_id, e.event_time, e.label,
           f.total_orders             ← today's value
      FROM events e
      JOIN user_features f USING (user_id)

  RIGHT — joins the value AS OF the event time

    SELECT e.user_id, e.event_time, e.label,
           f.total_orders
      FROM events e
      JOIN user_features_history f
        ON f.user_id = e.user_id
       AND f.valid_from <= e.event_time
       AND f.valid_to   >  e.event_time
```

This is an **as-of join** (also called a temporal or point-in-time join), and it
requires that features are stored *with history* rather than as a current-value
table. That storage requirement is one of the main reasons feature stores exist.

## Label timing

The second half of the same problem: the label must also respect a timeline.

```text
  predicting 30-day churn, with a prediction made on 1 March

  ✗  label computed on 15 March    — only 14 days elapsed;
                                     "did not churn" is unknown
  ✓  label computed on 31 March    — the full window elapsed
```

```text
  timeline for ONE training row

    ├──── feature window ────┤ T ├──── label window ────┤
    features from before T      wait for the outcome
                                     │
                                     └─ only rows whose label
                                        window has CLOSED are
                                        usable
```

The consequence for evaluation: **your most recent data is unusable**, because
its labels have not matured. A model predicting 90-day outcomes cannot be
evaluated on the last 90 days, which means every offline evaluation is at least
that stale — and that gap is where the online/offline discrepancy from the
lifecycle chapter often lives.

## Splitting a time series

```text
  RANDOM SPLIT — WRONG for temporal data
    ┌──────────────────────────────────────────┐
    │ ▓░▓░░▓░▓▓░▓░░▓▓░▓░░▓░▓░▓▓░▓░░▓░▓░▓░░▓░▓ │  interleaved
    └──────────────────────────────────────────┘
    the model trains on May and tests on April.
    it has seen the future. the metric is inflated.

  TEMPORAL SPLIT — right
    ┌──────────────────────┬───────────┬────────┐
    │       TRAIN          │   VALID   │  TEST  │
    └──────────────────────┴───────────┴────────┘
     Jan ─────────── Aug    Sep ─ Oct    Nov ─ Dec

  WALK-FORWARD — better, for evaluating stability
    train[Jan–Jun] → test[Jul]
    train[Jan–Jul] → test[Aug]
    train[Jan–Aug] → test[Sep]
    → shows whether performance DEGRADES over time
```

**Add a gap between train and test** equal to the label maturation window.
Without it, the end of the training period contains rows whose labels come from
the test period, which is leakage across the boundary.

Walk-forward is worth the extra compute for anything deployed, because it answers
a question a single split cannot: does this model's performance hold up as time
passes, or does it decay in weeks?

## Detecting leakage

```text
  □  SUSPICIOUSLY HIGH METRICS
       AUC > 0.95 on a hard problem is a bug report

  □  FEATURE IMPORTANCE
       one feature dominating overwhelmingly is a leak signature

  □  ABLATION
       drop the suspicious feature; if the metric collapses,
       investigate what it really encodes

  □  READ THE FEATURE'S DEFINITION
       when is this value written? by which process? could it
       be written by something that happens after the event?

  □  TEST ON A LATER TIME PERIOD
       leakage inflates in-period metrics far more than
       out-of-period ones

  □  ASK A DOMAIN EXPERT
       "would you know this at the moment of the decision?"
       is a question the data cannot answer and a person can
```

The last one is the highest-yield and the most neglected. Leakage is a *semantic*
property — it depends on what a field means and when it is written — and no
automated check substitutes for someone who knows the business process.

## Practical rules

```text
  □  every training row carries an explicit PREDICTION TIMESTAMP
  □  every feature is joined AS OF that timestamp
  □  features are stored WITH HISTORY, not as current values
  □  labels are only used once their window has closed
  □  splits are temporal, with a gap of the label window
  □  every transform is fitted on the training split alone
  □  splits group by entity so one user cannot span them
  □  the feature catalogue records, per feature, WHEN the value
     becomes known
```

That last item is the documentation that prevents the whole class. A feature
catalogue that records "available at event time" versus "available 24h later"
versus "only after the outcome" makes leakage a lookup rather than an
investigation.

## What to take away

1. An unexpectedly excellent offline metric is a bug report; leakage is the first
   hypothesis.
2. Leakage takes five forms — target, temporal, contamination, preprocessing and
   group — and preprocessing leakage is the easiest to write by accident.
3. Point-in-time correctness requires an as-of join against feature *history*, not
   a join to current values.
4. A label may only be used once its window has closed, which makes your most
   recent data unusable and every offline evaluation stale by that window.
5. Split temporally with a gap equal to the label window, and use walk-forward to
   see whether performance decays.
6. Leakage is semantic — a domain expert asking "would you know this at decision
   time?" beats any automated check, and a feature catalogue recording when each
   value becomes known prevents the class.

Next: feature stores — the infrastructure that makes both of these problems
structurally impossible.
