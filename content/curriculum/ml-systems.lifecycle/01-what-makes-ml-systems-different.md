---
title: What makes ML systems different
minutes: 19
summary: The properties that break every assumption ordinary software engineering rests on.
---

An ML system is a software system, and almost every instinct you have from
software engineering applies to it. The exceptions are few and they are severe:
they concern where behaviour comes from, how correctness is defined, and what
happens when nobody changes anything. Getting those three straight is what stops
an ML project from being an engineering project that mysteriously does not work.

## Behaviour comes from data, not code

```text
  TRADITIONAL SOFTWARE               ML SYSTEM

  behaviour = code                   behaviour = code + data + config
                                                        ▲
  read the code to know               the code is 5% of the answer.
  what it does                        the data decides the rest.

  a bug is in a line                  a "bug" may be in ten million
  you can point at                    rows nobody has looked at
```

The practical consequence is that **the artifacts you must version, review and
test expand well past the source tree**. A code review that examines the training
script and not the dataset it ran on has reviewed the least important half.

It also means the usual debugging loop inverts. When a traditional system
misbehaves you read the code path; when a model misbehaves you look at the
examples it was trained on, and the code path is usually fine.

## Correctness is a distribution, not a predicate

```text
  TRADITIONAL                        ML

  assert f(2) == 4                   accuracy = 0.94
  it passes or it fails              is 0.94 good?
                                       ...compared to what?
                                       ...on which slice?
                                       ...at what cost per error?
```

There is no green checkmark. A model is never *correct*; it is better or worse
than an alternative, on a chosen metric, over a chosen population. Three
consequences follow:

**You need a baseline before you need a model.** "94% accurate" is meaningless
until you know that predicting the majority class gets 91%. A large share of ML
projects ship models that beat nothing.

**Aggregate metrics hide failures.** A model at 94% overall can be at 61% for a
subgroup that matters, and the average will never tell you. Slice-level
evaluation is not an ethics add-on; it is how you find out what your model
actually does.

**The metric is a proxy.** You optimise click-through and get clickbait; you
optimise watch time and get autoplay rabbit holes; you optimise engagement and
get outrage. The gap between the metric and the goal is where ML systems cause
harm, and it is an engineering concern rather than only a policy one.

## Systems degrade with no change to them

The property with no analogue in ordinary software.

```text
  a deployed service, untouched, unchanged code

  traditional:  works the same in a year
  ML:           degrades, because the WORLD moved

    user behaviour changes
    a competitor launches
    a new product category appears
    a pandemic happens
    an upstream schema silently changes units
```

```text
  performance
     │ ────────────╲
     │              ╲╲
     │                ╲╲╲___
     │                       ╲╲╲___
     └──────────────────────────────────▶ time
       no deploys. no code changes. just decay.
```

This is why "monitoring" in an ML system means something different from uptime
and latency, and why the lifecycle is a loop rather than a pipeline. A model that
is not being retrained is a model whose accuracy is an unknown quantity.

## Failure is silent

```text
  a service that is down       → 500s, alerts, everyone knows
  a service that is slow       → latency graphs move
  a MODEL THAT IS WRONG        → returns a confident answer,
                                 200 OK, p50 latency 12 ms

  nothing in your infrastructure monitoring can see it.
```

A model does not throw. It produces a plausible number for input it has never
seen, and the system downstream uses it. This is why ML monitoring has to watch
*inputs and outputs* rather than only availability — a topic in its own right
later in this track.

## Experimentation is the workflow

```text
  SOFTWARE                           ML

  spec → build → test → ship         hypothesis → experiment → measure
  mostly linear                      → mostly FAILS → try again

  a failed build is a problem        a failed experiment is the
                                     normal case and is information
```

Most experiments do not work, and that is not a sign of a bad team. It changes
what the tooling must support: hundreds of runs with different data, features and
hyperparameters, each needing to be comparable, reproducible and attributable
months later. An ML team without experiment tracking is a team that cannot answer
"why did we choose this model", which is the question that arrives during an
incident.

## What stays exactly the same

Worth stating plainly, because ML systems attract more novelty than they deserve:

```text
  ✓  the serving layer is an ordinary service — HTTP, timeouts,
     retries, load balancing, circuit breakers, all of it
  ✓  the data pipelines are ordinary distributed data processing
  ✓  deployment, canaries, rollback, observability: unchanged
  ✓  code review, testing, CI, version control: unchanged
  ✓  the failure modes of the surrounding system dominate the
     failure modes of the model
```

That last line is the most useful in this chapter. **Most ML system outages are
not model problems.** They are a feature pipeline that broke, a schema change
upstream, a serving container that OOMs, a dependency timeout, a config error.
The distributed systems track is more relevant to running an ML system than the
modelling literature is.

## The 5% rule

The observation from Google's *Hidden Technical Debt in Machine Learning
Systems*, and the single most useful picture in this track:

```text
  ┌──────────────────────────────────────────────────────────┐
  │  configuration   data collection   feature extraction    │
  │                                                          │
  │  data verification    ┌────────┐    machine resource     │
  │                       │   ML   │    management            │
  │  analysis tools       │  CODE  │                          │
  │                       └────────┘    serving infrastructure│
  │  process management                                      │
  │                        monitoring                        │
  └──────────────────────────────────────────────────────────┘

  the model training code is the small box.
```

The implication is not that modelling is unimportant — it is that a team
staffed and organised as though the small box were the work will build a model
that cannot be deployed, monitored or retrained. Most of the engineering is
everything around it, which is what this track is about.

## What to take away

1. Behaviour comes from code *plus data plus config*, so the artifacts you must
   version, review and test extend well past the source tree.
2. Correctness is a distribution, not a predicate: you need a baseline, slice-level
   evaluation, and awareness that your metric is a proxy for the goal.
3. ML systems degrade with no change to them, because the world moves — which is
   why the lifecycle is a loop and monitoring is mandatory.
4. Model failure is silent: a 200 OK with a confident wrong answer, invisible to
   every infrastructure metric.
5. Most experiments fail, and that is the normal workflow — which is why
   experiment tracking is infrastructure, not a nicety.
6. The training code is roughly 5% of the system; most ML outages are ordinary
   distributed-systems failures in the other 95%.

Next: the question to ask before any of this — whether the problem should be
solved with ML at all.
