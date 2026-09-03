---
title: What to monitor in an ML system
minutes: 19
summary: Four layers of signal, and why the ones that matter arrive last.
---

Infrastructure monitoring tells you the service is up. It cannot tell you the
model is wrong, because a wrong model returns a confident number with a 200 status
in twelve milliseconds. ML monitoring exists to detect the failure that all your
other monitoring is blind to.

## The four layers

```text
  1. INFRASTRUCTURE     latency, errors, saturation, memory
                        → immediate, and blind to model quality

  2. DATA               input distributions, nulls, ranges,
                        freshness
                        → immediate, and the earliest ML signal

  3. PREDICTIONS        output distribution, confidence,
                        class balance
                        → immediate

  4. PERFORMANCE        accuracy, precision, business metrics
                        → DELAYED by the label window, and the
                          only layer that measures what you care
                          about
```

```text
  detection speed vs directness

    layer 1  ████████████  instant, indirect
    layer 2  ███████████   near-instant, indirect
    layer 3  ██████████    instant, indirect
    layer 4  ██            delayed by hours to months, DIRECT
```

**The tension defines the discipline.** The signal you care about — is the model
right? — arrives last, sometimes months late. Layers 2 and 3 are proxies you can
observe now, and the whole game is using them to catch problems before layer 4
confirms them.

## Layer 2: input monitoring

```text
  PER FEATURE
    □  mean, stddev, percentiles
    □  NULL / missing rate           ← the highest-yield alarm
    □  cardinality for categoricals
    □  unseen categories
    □  range violations
    □  variance — a collapse to zero means a broken pipeline

  ACROSS FEATURES
    □  correlation structure changes
    □  row/request volume
    □  feature FRESHNESS
```

The null-rate alarm deserves its place at the top. Most upstream breakages —
a renamed column, a failed join, a schema change, a permissions error — surface
first as a jump in the null or default rate for one feature, and they surface
*immediately*, long before any accuracy metric could move.

```text
  the silent version, from the data-pipelines topic:

    an upstream column is renamed
    → the lookup returns null
    → imputation fills the mean
    → the feature is now CONSTANT
    → the model has silently lost an input
    → nothing errors; null rate looks fine (it was imputed)

  → which is why VARIANCE COLLAPSE is a separate alarm
```

## Layer 3: prediction monitoring

```text
  □  the output distribution — mean, spread, histogram
  □  the predicted class balance
  □  confidence distribution
  □  the rate of predictions crossing your decision threshold
  □  outputs at the extremes (all 0.0 or all 1.0 is a bug)
```

```text
  prediction distribution is the FASTEST honest signal.

    input drift → the model's outputs shift → measurable
    IMMEDIATELY, with no labels required

  a fraud model whose flagged rate jumps from 0.8% to 6%
  overnight has a problem, whatever the cause — and you know
  within minutes rather than after the chargeback window.
```

It is also the signal that protects downstream consumers: as the ML-debt chapter
noted, thresholds set on an old score distribution silently break when the
distribution moves.

## Layer 4: performance monitoring

```text
  when labels arrive:
    □  accuracy, precision, recall, AUC — versus the offline
       expectation
    □  SLICED: by segment, geography, device, tenant, time
    □  calibration: do predicted probabilities match observed
       frequencies?
    □  the BUSINESS metric the model exists to move
```

The slice requirement is not optional. Aggregate accuracy holding steady while one
segment collapses is the normal shape of ML degradation, and only slicing reveals
it.

**Calibration deserves specific attention** because it degrades independently of
accuracy:

```text
  of the cases predicted at 0.7, do ~70% turn out positive?

  a model can rank correctly (good AUC) while its
  probabilities are systematically wrong — and every
  threshold-based decision downstream depends on the
  probabilities, not the ranking.
```

## The label delay problem

```text
  fraud chargeback     60–90 days
  loan default         1–5 years
  churn                30–90 days
  ad click             seconds
  content moderation   hours (human review)
```

```text
  a 90-day label delay means:

    a model that broke today is confirmed broken in 90 days.
    → layers 2 and 3 are not "nice to have". they are the
      only signal you will get in time.
```

The mitigations that buy earlier signal:

```text
  PROXY LABELS      a fast, imperfect signal correlated with
                    the real one
  HUMAN REVIEW      label a small sample immediately
  DELAYED
  BACKFILL          compute true performance retrospectively
                    and compare with what the proxies said
  SEGMENT BY
  MATURITY          report accuracy only over rows whose label
                    window has closed, and say so
```

That last item prevents a specific and common reporting error: computing accuracy
over all recent predictions, most of whose labels have not matured, and
concluding that the model has improved because the immature rows default to
"negative".

## Business metrics

```text
  □  the metric the model was built to move
  □  guardrail metrics that must not get worse
  □  a HOLDOUT — a fraction of traffic that never sees the model
```

**The permanent holdout is the most valuable and least common practice here.**
Without it, "the model is working" is an assertion; with it, it is a measurement
that stays valid as the world changes.

```text
  99% of traffic → the model
   1% of traffic → no model (or the previous baseline)

  → the difference between them is the model's real,
    continuous, current contribution.
```

It costs 1% of the model's benefit and answers a question nothing else can — in
particular, whether a model that has been running for two years still beats doing
nothing, which is a question that goes unasked in most organisations.

## Alerting

```text
  PAGE ON                            TICKET ON
  ───────                            ─────────
  the service is down                a slow distribution drift
  a feature pipeline failed          a small accuracy decline
  the null rate jumped >X%           a new categorical value
  the prediction distribution        a slice slightly worse
    shifted sharply
  a fallback is being used heavily
  performance dropped below the SLO
```

The failure mode to avoid is the same as everywhere: **an alert on every
distribution change trains people to ignore all of them.** Drift alerts must be
tuned so that firing means something, and the way to do that is to measure
baseline drift over a few weeks before setting the threshold.

## The reference window

```text
  drift is measured AGAINST something. choose deliberately.

  TRAINING DATA      "has the world moved since training?"
                     → the right reference for retraining
                       decisions

  A RECENT WINDOW    "did something change TODAY?"
                     → the right reference for incident
                       detection

  THE SAME PERIOD
  LAST YEAR          → for seasonal data, the only sensible
                       comparison
```

Using a recent rolling window as the reference for a slow drift hides it entirely
— each day looks like yesterday while the year looks nothing like the training
data. **Monitor against both**: the training distribution for gradual decay, a
recent window for sudden breaks.

## What to take away

1. Infrastructure monitoring is blind to model failure, which returns a confident
   wrong answer with a 200 status.
2. The four layers trade speed against directness: performance is the signal you
   care about and it arrives last.
3. Null-rate jumps and variance collapse are the highest-yield input alarms, and
   they fire immediately.
4. Prediction distribution is the fastest honest signal and requires no labels; it
   also protects downstream thresholds.
5. Slice everything, and monitor calibration separately from accuracy — thresholds
   depend on probabilities, not ranking.
6. Keep a permanent holdout: it is the only way to know whether a two-year-old
   model still beats doing nothing.

Next: drift — what it is, how to measure it, and what to do about each kind.
