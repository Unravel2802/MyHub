---
title: Technical debt in ML systems
minutes: 19
summary: The debt forms that are specific to ML, and why they are harder to pay down than ordinary debt.
---

Google's *Hidden Technical Debt in Machine Learning Systems* (2015) is the most
useful paper in this track, and its central claim is that ML systems accumulate
debt in forms ordinary software does not — forms that are invisible at the code
level, so they do not show up in review, in linting, or in anyone's refactoring
plan.

## CACE: Changing Anything Changes Everything

```text
  CACE — Changing Anything Changes Everything

  a model has no modular boundaries internally. change one input
  feature and EVERY weight shifts, so every output may change.
```

```text
  you remove feature #17 because it is expensive to compute.
  accuracy overall: unchanged.
  accuracy on a subgroup: down 12%.
  nothing in the code review could have shown this.
```

There is no ML equivalent of "this change is local to this module". The
implications:

- **Every change needs full re-evaluation**, including slices — you cannot reason
  that a change is safe.
- **Feature removal is as risky as feature addition.** Both are global changes.
- **Model composition is dangerous.** Feeding one model's output into another
  means the second is coupled to every retraining of the first.

The mitigation is not to eliminate CACE — it is inherent — but to make its
consequences visible: comprehensive slice-level evaluation as a gate, and
treating any change to inputs as a change to the whole model.

## Entanglement and undeclared consumers

```text
  ENTANGLEMENT
    features interact. a change to the distribution of one
    changes the useful weights of all the others.

  UNDECLARED CONSUMERS (visibility debt)
    ┌─────────┐
    │ model A │──▶ predictions written to a table
    └─────────┘         │
                        ├──▶ team B reads it (you know)
                        ├──▶ team C reads it (you don't)
                        └──▶ a dashboard, a batch job, another
                             model... (nobody knows)

    → you cannot change the model's output distribution without
      breaking systems you have never heard of
```

Undeclared consumers are the ML version of an undocumented public API, and worse
because the "interface" is a *distribution*, not a schema. A retrain that shifts
scores from a mean of 0.3 to 0.5 breaks every downstream threshold, while passing
every schema check.

The defences are ordinary engineering: access control on prediction outputs so
consumers must be known, versioned prediction outputs, and — the cheapest and
most effective — **publishing the score distribution as part of the contract**,
so a shift is visible and can be announced rather than discovered.

## Data dependency debt

```text
  CODE dependencies          have compilers, linters, dead-code
                             detection, dependency graphs

  DATA dependencies          have almost none of that
```

Two forms:

**Unstable dependencies.** A feature that comes from another system that is itself
changing — another team's model output, a third-party score, a table whose
semantics drift. Your model silently changes behaviour when they ship.

The mitigation is **versioning and snapshotting**: consume a pinned version of an
upstream signal rather than its live value, and upgrade deliberately.

**Underutilised dependencies.** Features that cost something and contribute almost
nothing:

```text
  LEGACY       was useful; a newer feature superseded it
  BUNDLED      added as a group; only some of them matter
  EPSILON      improves the metric by 0.01% and costs a pipeline
  CORRELATED   duplicates another feature; the model arbitrarily
               picks one, and it flips between retrains
```

Every one is a pipeline to maintain, a failure mode, and a dependency on an
upstream system. The tool is **leave-one-out evaluation** run periodically: drop
each feature, retrain, measure. Features that cost more than they contribute get
removed. Almost nobody does this, which is why feature sets only ever grow.

## Configuration debt

```text
  a mature ML system's config:

    which features are enabled          which loss function
    which data ranges                   which learning rate schedule
    which preprocessing per feature     which sampling strategy
    which model architecture            which thresholds per segment
    which version of each upstream      which fallback behaviour

  → often more lines than the model code, and reviewed less
```

Config is where ML systems break, and it is treated as data rather than code:
edited hastily, not reviewed, not tested, not versioned with the model. The
remedy is the one from the distributed track's configuration chapter, applied
here — validate on write, review changes, version alongside the model, and make
the config part of the model's provenance so a model can be rebuilt exactly.

## Pipeline jungles and glue code

```text
  PIPELINE JUNGLE
    features accreted one at a time, each with its own scrape,
    join and transform, until the data-preparation code is a
    thicket nobody can safely change.

    symptom: adding a feature takes weeks
    symptom: nobody can say where a number came from
    cause:   incremental growth with no consolidation
```

The paper's blunt advice, which is right and unpopular: **pipeline jungles can
only be fixed by redesigning the data collection, not by refactoring the code.**
The tangle is a symptom of the underlying data flow, and rewriting the glue
reproduces it.

```text
  GLUE CODE
    ~95% of the code exists to get data into and out of a
    general-purpose ML library.

    → the library's generality is what costs you: it accepts a
      shape nobody has, so you write conversions in both directions
```

The mitigation is to wrap the library behind an interface shaped like *your*
domain, so the glue lives in one place and the library can be swapped. The
counter-signal: if a team writes its own ML framework to avoid glue code, they
have chosen a much larger debt.

## Correction cascades and dead experimental paths

```text
  CORRECTION CASCADE
    model A solves problem X.
    model B = A + a correction for a slightly different problem.
    model C = B + another correction.
    ...
    → improving A now breaks B and C. the system is frozen.
```

This is the ML analogue of inheritance depth, and it has the same fix: when a
related problem arrives, prefer training a separate model on the right objective
over layering a correction. It costs more up front and does not calcify.

```text
  DEAD EXPERIMENTAL CODEPATHS
    if-statements and flags left from experiments that were never
    cleaned up. eventually the interactions are untestable, and
    nobody dares remove any of them.
```

Knight Capital lost $440M in 45 minutes in 2012 because a dead code path was
reactivated by a config flag. The ML version is the same shape with a model in
it, and the discipline is the same: **experiment flags need an expiry**, exactly
as feature flags do.

## Feedback loops

Specific to ML and worth naming separately:

```text
  DIRECT
    the model influences the data it will be trained on.
    a recommender only sees engagement with what it showed.
    → deliberate exploration is the mitigation

  HIDDEN
    two models influence each other through the world.
    model A changes prices; model B predicts demand from prices;
    B's predictions change A's prices...
    → neither team knows the other exists
```

Hidden feedback loops are genuinely hard: nothing in either system references the
other, and the coupling is through the environment. They are found by
experimentation — holding one model fixed and observing whether the other's
behaviour changes — rather than by reading code.

## Paying it down

```text
  □  slice-level evaluation as a merge gate (CACE)
  □  access control and published distributions for outputs
     (undeclared consumers)
  □  periodic leave-one-out feature evaluation, and DELETE
  □  config reviewed, validated and versioned with the model
  □  a hard expiry on experiment flags
  □  a documented data-dependency graph, refreshed
  □  prefer a new model over a correction layer
  □  budget for it — this debt is not repaid opportunistically,
     because none of it shows up in a code review
```

That last line is the point. Ordinary technical debt is visible to anyone reading
the code. ML debt is visible only in the data flow, the config and the
evaluation, so it accumulates silently until the system cannot be changed —
which is the state most ML systems reach after two or three years.

## What to take away

1. CACE means no change to an ML system is local; every input change requires full
   slice-level re-evaluation.
2. Undeclared consumers of predictions couple you to systems you have never heard
   of — publish the score distribution as part of the contract.
3. Data dependencies have none of the tooling code dependencies do; version
   upstream signals, and run leave-one-out evaluation to delete features that do
   not earn their pipeline.
4. Configuration is often larger than the model code and is reviewed less; it must
   be versioned as part of the model's provenance.
5. Pipeline jungles are fixed by redesigning data collection, not by refactoring
   glue; correction cascades freeze a system and are avoided by training a new
   model instead.
6. This debt is invisible in code review, so paying it down must be budgeted
   deliberately rather than done opportunistically.

Next: the people and roles, and the handoffs where ML projects actually stall.
