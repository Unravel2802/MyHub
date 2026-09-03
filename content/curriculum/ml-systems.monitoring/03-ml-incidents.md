---
title: ML incidents
minutes: 17
summary: Debugging a production model problem, and the response options that are not "retrain".
---

An ML incident looks different from a service incident: nothing is down, latency
is fine, error rates are normal, and the output is wrong. The diagnostic path is
different too, and the fastest mitigation is almost never retraining.

## The signals that start one

```text
  □  a monitoring alert (drift, performance, null rate)
  □  a business metric moving
  □  user complaints or support tickets
  □  a downstream system behaving oddly
  □  someone noticing something strange
```

The last two are how a surprising share of ML incidents are found, which is itself
a finding: it means the monitoring did not catch it, and that gap belongs in the
postmortem.

## The triage order

```text
  1. IS IT THE MODEL AT ALL?
       check the boring things first:
         □  is the service healthy?
         □  did a deploy ship recently — of ANYTHING?
         □  did a feature pipeline fail?
         □  did an upstream schema change?
         □  is a dependency degraded?

       → most "model problems" are pipeline problems

  2. WHAT CHANGED, AND WHEN?
       a STEP change → find the deploy or the data change
                       on that timestamp
       GRADUAL       → drift; not an incident, a retraining
                       decision

  3. WHICH REQUESTS?
       all of them, or a slice?
       → a slice points at a segment-specific data problem

  4. INPUTS OR MODEL?
       replay a bad request through the CURRENT model and
       through the PREVIOUS one
         same bad output from both  → the INPUT is wrong
         different                  → the MODEL changed
```

**Step 4 is the decisive experiment**, and it takes minutes if you logged the
input vector. If you did not log it, this step is impossible — which is the
concrete reason the serving chapter insisted on logging inputs.

## Mitigation before diagnosis

The resilience-topic principle applies here too: stop the harm first.

```text
  ordered by speed

  1. ROLL BACK the model version          seconds
  2. Disable the feature / kill switch    seconds
  3. Fall back to the previous baseline
     or a rules engine                    seconds
  4. Adjust the DECISION THRESHOLD        minutes
     ← under-used, and often exactly right
  5. Route affected traffic to a
     fallback path                        minutes
  6. Fix the feature pipeline and
     backfill                             hours
  7. RETRAIN                              hours to days
     ← almost never the right FIRST move
```

Threshold adjustment deserves the emphasis. A model whose scores have shifted
upward is flagging too much; moving the threshold restores the operating point
immediately, while a retrain takes a day. It is a dial you should have exposed as
runtime configuration precisely so it is available during an incident.

## The failure catalogue

```text
  SYMPTOM                          LIKELY CAUSE
  ───────                          ────────────
  predictions suddenly constant    a feature became constant
                                   (null → imputed default)

  scores shifted, ranking intact   calibration change; a
                                   retrain shifted the
                                   distribution → fix the
                                   threshold

  one segment much worse           a segment-specific feature
                                   broke, or that segment was
                                   under-represented in the
                                   retrain

  gradual decline                  concept drift → retrain

  a step decline on a date         a deploy, schema change, or
                                   upstream change on that date

  good offline, bad online         training/serving SKEW —
                                   the first hypothesis

  worse after a retrain            the training data was
                                   corrupted, or the evaluation
                                   gate was too weak

  intermittently wrong             a race in feature fetching,
                                   a partially-failed cache, or
                                   stale features on some path
```

**"Worse after a retrain" is a specific and common incident**, and it is the case
the lifecycle chapter warned about: an automated pipeline that retrains without an
evaluation gate against the current production model will eventually promote a
worse one, and the pipeline will be green throughout.

## What makes an ML incident debuggable

Decided long before the incident:

```text
  □  every prediction logged with its INPUT VECTOR and MODEL
     VERSION
  □  feature values logged as SERVED, not recomputed
  □  the ability to replay a request through any model version
  □  input and prediction distribution history, retained
  □  model provenance: which data, code, config produced it
  □  a per-model runbook
```

The replay capability is the one that most changes an incident's duration. Being
able to take a specific bad prediction, run it through three model versions, and
see where the output diverges turns speculation into a five-minute answer.

## The postmortem

The ML-specific questions to add to an ordinary postmortem:

```text
  □  what did the monitoring see, and when?
  □  what SHOULD have caught this, and why did it not?
  □  was there a slice-level signal that was not being watched?
  □  would an evaluation gate have blocked this?
  □  was the fallback path exercised, and did it work?
  □  how long from onset to detection? from detection to
     mitigation?
  □  is the root cause in the model, the data, or the
     surrounding system?
```

That last question, asked honestly across many incidents, usually produces the
same answer: **the surrounding system.** Teams that track it stop staffing their
ML work as if the model were the risk.

## Prevention

```text
  □  an evaluation gate that compares against the CURRENT
     production model, on slices
  □  shadow deployment before every canary
  □  data validation that BLOCKS on structural violations
  □  the decision threshold as runtime config, not a constant
  □  a tested fallback path
  □  alert on null rate, variance collapse and prediction
     distribution — the fast signals
  □  a permanent holdout, so "is it working" is measurable
  □  rollback that is a version change, tested
```

## What to take away

1. Most "model problems" are pipeline problems; check deploys, feature pipelines
   and upstream schema before suspecting the model.
2. Replaying a bad request through the current and previous model versions is the
   decisive experiment, and it requires having logged the input vector.
3. Mitigate before diagnosing: roll back, kill-switch, fall back, or adjust the
   threshold — retraining is almost never the right first move.
4. Expose the decision threshold as runtime configuration so it is available
   during an incident.
5. Constant predictions mean a feature went constant; shifted scores with intact
   ranking mean recalibration; worse-after-retrain means a weak evaluation gate.
6. Ask in every postmortem whether the cause was the model, the data or the
   surrounding system — the honest answer is usually the third.

That completes ML monitoring. Next in the track: **evaluation and online
testing** — measuring whether a model actually helps.
