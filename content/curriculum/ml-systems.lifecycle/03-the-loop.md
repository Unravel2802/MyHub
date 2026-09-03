---
title: The lifecycle as a loop
minutes: 19
summary: Why the pipeline diagram is wrong, and what each stage owes the next.
---

Almost every diagram of "the ML lifecycle" is drawn as an arrow: data, train,
evaluate, deploy, done. That picture is wrong in a way that shapes how teams
build, because it implies an end. There is no end. A deployed model is an input
to the next iteration, and the systems that work are built as loops from the
start.

## The loop

```text
        ┌───────────────────────────────────────────────────┐
        │                                                   │
        ▼                                                   │
   ┌─────────┐   ┌────────┐   ┌──────────┐   ┌─────────┐   │
   │  FRAME  │──▶│  DATA  │──▶│  TRAIN   │──▶│EVALUATE │───┤
   └─────────┘   └────────┘   └──────────┘   └────┬────┘   │
        ▲                                          │        │
        │                                          ▼        │
        │        ┌──────────┐   ┌─────────┐   ┌─────────┐  │
        └────────│ MONITOR  │◀──│  SERVE  │◀──│ DEPLOY  │◀─┘
                 └──────────┘   └─────────┘   └─────────┘
                       │
                       └──▶ production data becomes TRAINING data
                            for the next iteration
```

The two arrows that make it a loop, and that pipeline diagrams omit:

**Monitoring feeds back into framing.** What you learn in production changes the
problem definition, the features, sometimes the target variable. A model that is
accurate and unhelpful is a framing discovery you can only make in production.

**Serving generates training data.** Predictions and their eventual outcomes are
next iteration's labels — and, as the previous chapter noted, they are biased by
the model that produced them.

## The stages, and what each owes the next

**Frame.** Owes the rest a written definition of the decision, the baseline, the
target and the guardrails. Without it, "is this model good?" has no answer and
every later argument is unresolvable.

**Data.** Owes a dataset that is versioned, validated, and reproducible at a point
in time. Not "the current state of the warehouse" — a specific, identifiable
snapshot, because otherwise nothing downstream can be reproduced.

**Train.** Owes a model artifact plus the complete provenance: data version, code
version, config, environment, metrics. A model file with no provenance is
unmaintainable — nobody can rebuild it, and nobody can explain it.

**Evaluate.** Owes a decision, not a number: ship or do not ship, on stated
criteria, including slices and guardrails. An evaluation that produces a metric
without a threshold has deferred the decision to whoever is loudest.

**Deploy.** Owes a reversible change. Canary, shadow, or staged rollout with a
rollback that works — the traffic-management machinery from the distributed track,
applied unchanged.

**Serve.** Owes predictions within latency, and a log of what it predicted from
what input. That log is the raw material for both monitoring and the next
training set, so a serving layer that does not log its inputs has broken the loop.

**Monitor.** Owes a signal that something changed, before a user tells you.

## Where the loop breaks in practice

```text
  BREAK 1: no path from production back to training
     the model was trained on a CSV someone exported once.
     nobody can retrain it. it decays until it is switched off.

  BREAK 2: predictions are not logged with their inputs
     you cannot compute what the model saw, so you cannot
     debug a bad prediction or build the next training set.

  BREAK 3: no labels arrive from production
     you know what you predicted and never learn what happened.
     accuracy in production is permanently unknown.

  BREAK 4: retraining is manual and painful
     so it happens twice a year, and drift accumulates between.

  BREAK 5: no rollback
     a bad model ships and the fix is a four-hour retrain.
```

**Break 3 is the most common and the most damaging.** A system that predicts and
never observes the outcome is flying blind: every claim about its accuracy comes
from an offline test set that gets staler every day. Closing it usually means a
deliberate engineering effort — joining predictions to outcomes days or months
later — and it is worth more than almost any modelling improvement.

## Retraining: cadence and trigger

```text
  SCHEDULED                          TRIGGERED
  ─────────                          ─────────
  retrain every N days               retrain when a monitored
                                     signal crosses a threshold
  + simple, predictable
  + easy to reason about             + responds to real change
  - retrains when nothing changed    + no wasted retraining
  - misses fast changes              - needs reliable monitoring
                                     - can fire on a data bug and
                                       train on garbage
```

The pragmatic answer is **both**: a schedule as the floor, and triggers for
sudden change — with the important caveat that a trigger must never retrain
automatically on unvalidated data. A drift alert caused by an upstream schema
change will happily train a model on the corrupted feature, and now the bug is
baked into the model.

```text
  every retrain, scheduled or triggered:

    1. validate the data (schema, ranges, volume, nulls)
    2. train
    3. evaluate against the CURRENT PRODUCTION MODEL, on a
       fresh holdout, including slices and guardrails
    4. promote ONLY if it wins
    5. deploy as a canary
    6. promote to full traffic on the online metrics
```

Step 4 is the one to insist on. **Automatic retraining without automatic
evaluation is automatic degradation.** Data changes, the retrain absorbs the
change, and the new model is worse — and it shipped because the pipeline was
green.

## Continuous training, and how far to take it

```text
  LEVEL 0   manual everything. a notebook, a person, a file.
            → fine for a first model, and only that

  LEVEL 1   automated training pipeline; deployment is manual
            → the right place for most teams

  LEVEL 2   automated pipeline + automated evaluation gate +
            automated canary deployment
            → worth it when retraining is frequent or the
              domain moves fast

  LEVEL 3   fully continuous, retraining on a trigger with no
            human in the loop
            → rarely warranted; requires very high confidence
              in the evaluation gate and the data validation
```

**Most teams should target level 1 and stop there for a long time.** The value of
automation is proportional to how often you retrain, and a model retrained
monthly does not justify a continuous-training platform. Building level 3 for a
model that changes quarterly is the ML equivalent of premature optimisation, and
it is extremely common.

## Shadow, canary and the online/offline gap

```text
  offline evaluation says the new model is 3% better.
  it is deployed. online metrics do not move.

  why? almost always one of:
    □  training/serving skew — different features at serve time
    □  the offline test set is not the live distribution
    □  the metric improved but the DECISION did not change
       (better probabilities, same thresholded outcome)
    □  a feedback loop — the old model shaped the test data
```

The only reliable resolution is measuring online. Shadow deployment (run the new
model on real traffic, discard its output, compare) catches skew and
infrastructure problems at zero user risk. A canary with a proper A/B measures
the actual decision impact. Both come straight from the distributed track's
traffic-management chapter, and they apply here without modification.

## What to take away

1. The lifecycle is a loop: monitoring feeds framing, and serving generates the
   next training set — pipeline diagrams omit exactly the arrows that matter.
2. Each stage owes the next something concrete; the most important is a versioned,
   point-in-time-reproducible dataset and complete model provenance.
3. The most common break is that outcomes never come back from production, so
   accuracy there is permanently unknown.
4. Retrain on a schedule as a floor with triggers for sudden change, and never let
   a trigger retrain on unvalidated data.
5. Automatic retraining without an automatic evaluation gate against the current
   production model is automatic degradation.
6. Target automation level 1 and stay there until retraining frequency justifies
   more; and resolve the offline/online gap by measuring online.

Next: the technical debt that accumulates in these systems in ways ordinary
software does not.
