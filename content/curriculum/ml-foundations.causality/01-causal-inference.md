---
title: Causal inference and experimentation
minutes: 19
summary: Why prediction is not enough, and how to measure an effect rather than an association.
---

Most ML answers "what will happen?" Most decisions need "what will happen *if I
do this*?" Those are different questions, and a model that answers the first can
be actively misleading about the second.

## The distinction

```text
  PREDICTIVE   P(churn | features)
               → who is likely to leave

  CAUSAL       P(churn | do(discount)) − P(churn | do(nothing))
               → whose behaviour would CHANGE if we intervened
```

```text
  the classic illustration

    a model predicts churn well. it identifies the customers
    most likely to leave.

    the intervention targets them. many still leave.

    why? the strongest churn predictors identify people who
    have ALREADY decided — the ones least responsive to any
    offer.

  → the model answered the question asked, and the question
    was wrong.
```

**The decision needs the causal quantity**, and a great many deployed models
answer the predictive one — the point the framing chapter made, now with the
machinery attached.

## Confounding

```text
      confounder
       ╱      ╲
      ▼        ▼
  treatment → outcome

  ice cream sales and drownings correlate.
  the confounder is TEMPERATURE.
```

```text
  □  observational data is full of confounders
  □  some are unmeasured, which no statistical method fixes
  □  RANDOMISATION breaks the link from confounder to
    treatment, which is why it is the gold standard
```

## Randomised experiments

```text
  randomly assign treatment → the groups differ ONLY in the
  treatment, in expectation → the difference in outcomes IS
  the causal effect.
```

```text
  the requirements, and the failures

  □  RANDOMISE at the right unit — usually the user
  □  CHECK THE SPLIT: a sample ratio mismatch invalidates
     everything
  □  POWER the test before running it
  □  fix the horizon, or use a sequential method — peeking
     inflates the false-positive rate
  □  ONE primary metric, decided in advance
  □  watch for SPILLOVER between units (marketplaces, social)
     → cluster randomisation
```

These are the online-testing chapter's rules; they appear here because
randomisation is the only clean route to a causal answer, and getting the
experiment wrong means you have neither prediction nor causation.

## When you cannot randomise

```text
  DIFFERENCE-IN-DIFFERENCES
    compare the CHANGE in a treated group with the change in
    an untreated one
    → assumes PARALLEL TRENDS absent treatment — check it on
      pre-period data

  REGRESSION DISCONTINUITY
    treatment is assigned by a threshold; compare just above
    and just below
    → strong, and only valid NEAR the threshold

  INSTRUMENTAL VARIABLES
    find something affecting treatment but not the outcome
    directly
    → powerful and fragile; good instruments are rare

  PROPENSITY SCORE MATCHING
    match treated and untreated units on observed covariates
    → only handles OBSERVED confounders, which is its
      fundamental limit

  SYNTHETIC CONTROL
    build a weighted combination of untreated units that
    matches the treated unit's pre-period
    → good for a single treated entity (a region, a market)
```

```text
  every one of these rests on an ASSUMPTION that cannot be
  verified from the data.

  → state the assumption explicitly, and test whatever
    implication of it you can.
```

## Uplift modelling

The technique that directly answers the intervention question:

```text
  predict the DIFFERENCE in outcome between treating and not
  treating — per individual.

  four groups
    PERSUADABLE   respond only if treated       ← TARGET THESE
    SURE THING    respond either way            → wasted spend
    LOST CAUSE    respond neither way           → wasted spend
    SLEEPING DOG  respond WORSE if treated      → actively harmful
```

```text
  the sleeping-dog group is the one prediction cannot find:

    a retention email that REMINDS a dormant customer they
    have a subscription, prompting cancellation.

  a churn-prediction model targets them enthusiastically.
```

```text
  how to train it
    □  requires data from a RANDOMISED experiment
    □  two-model (treated vs control), or a single model with
       treatment as a feature and an uplift objective
    □  evaluate with a QINI / uplift curve, not accuracy
```

Uplift modelling is under-used relative to how directly it matches the business
question, and the reason is its precondition: it needs randomised data, which
means running an experiment before building the model.

## Practical guidance

```text
  □  ask whether the decision needs a PREDICTION or an EFFECT
  □  randomise wherever you can — it is worth real cost
  □  when you cannot, state the identifying assumption
  □  hold out a permanent CONTROL group for anything running
     continuously
  □  beware: a predictive model's most confident cases are
     often the least influenceable
  □  correlation in observational data is a hypothesis, not a
     finding
```

The permanent control group is the same recommendation as the monitoring
chapter's holdout, arriving from the causal direction: without it, the effect of a
continuously-running intervention is unmeasurable, and it will be defended on
prediction accuracy rather than on impact.

## What to take away

1. Prediction and causation are different questions, and a model that answers the
   first can be misleading about the second.
2. Confounding is the reason observational association is not effect, and
   unmeasured confounders cannot be fixed statistically.
3. Randomisation is the only clean route to a causal answer; the experiment's
   validity rules matter as much as the model.
4. Quasi-experimental methods each rest on an unverifiable assumption — state it
   and test what implications you can.
5. Uplift modelling targets the persuadable and avoids sleeping dogs, which
   prediction cannot distinguish — but it requires randomised training data.
6. Keep a permanent control group, or a continuously-running intervention's effect
   is unmeasurable.

Next: time series.
