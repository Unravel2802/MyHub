---
title: Experiment tracking
minutes: 18
summary: Turning hundreds of runs into comparable knowledge, and the discipline that makes comparisons honest.
---

An ML project produces hundreds of runs, most of which fail. Without a system,
the knowledge from them lives in a mix of notebooks, filenames, Slack messages
and memory, and evaporates when someone leaves. Experiment tracking is the
infrastructure that makes the failures cumulative rather than wasted.

## What to log

```text
  PER RUN
    □  a unique run id
    □  everything from the reproducibility list
    □  metrics over time (per epoch/step), not just final
    □  the artifacts: model, plots, sample predictions
    □  wall-clock time, hardware used, cost
    □  the HYPOTHESIS — what were you testing?
    □  the OUTCOME — what did you conclude?
```

The last two are the ones tools do not force and that make the difference between
a database of numbers and a record of what the team learned. A run tagged "trying
a lower LR because the loss curve was unstable at 3e-4" is knowledge; the same run
with only its config is a row.

## Metrics over time, not just at the end

```text
  final validation accuracy: 0.913 for BOTH runs

  run A                              run B
  loss                               loss
    │╲                                 │╲
    │ ╲___                             │ ╲    ╱╲
    │     ╲___                         │  ╲__╱  ╲___
    └──────────────▶                   └──────────────▶

  A converged smoothly                 B is unstable and got
  → trustworthy                        lucky at the end
                                       → will not survive a retrain
```

Two runs with identical final metrics can be completely different, and only the
curve tells you. Log per-step or per-epoch, and look at the curves before
accepting a result.

The specific things curves reveal that a final number cannot: divergence recovered
from by luck, overfitting beginning at epoch 12 while the run continued to 40, a
learning rate that was too high for the first half, and a validation curve that
was still improving when the run stopped.

## Organising runs

```text
  EXPERIMENT   a question   "does adding user-history features help?"
    └── RUN    an attempt    one config, one execution
         └── ARTIFACTS       model, plots, predictions

  tag runs with:
    □  the experiment they belong to
    □  the baseline they are compared against
    □  status: exploratory | candidate | shipped | rejected
    □  who ran it
```

The **baseline tag** is the one that makes a tracking system useful rather than
merely full. A metric with nothing to compare against is not information, and six
months later nobody remembers what the comparison was.

## Comparing runs honestly

The discipline that separates a real result from a false one:

```text
  □  CHANGE ONE THING. two changes and an improvement is
     unattributable.

  □  SAME EVALUATION SET, every time. a "better" model measured
     on a different holdout is not better.

  □  MULTIPLE SEEDS. a 0.3% gain from one seed is usually noise.

  □  REPORT THE SPREAD, not just the mean.

  □  COMPARE ON SLICES, not only in aggregate — the lifecycle
     chapter's CACE warning applies to every comparison.

  □  ACCOUNT FOR MULTIPLE COMPARISONS. testing forty
     configurations and picking the best means the best one is
     partly lucky; its held-out performance will be worse than
     its validation performance.
```

That last point is the most-violated rule in applied ML. Selecting the best of
forty runs on a validation set means the validation metric is now optimistically
biased — you have implicitly fitted to it. The defence is a **test set touched
once**, at the end, on the single chosen model.

```text
  TRAIN        fit the parameters
  VALIDATION   choose between models, tune, select
  TEST         touched ONCE, on the final choice
               → if you look at it twice, it is a
                 second validation set and you need a new one
```

## Hyperparameter search

```text
  GRID          exhaustive over a lattice
                → wasteful; most dimensions do not matter

  RANDOM        sample from distributions
                → strictly better than grid for the same budget
                  (Bergstra & Bengio): with 60 random samples you
                  are ~95% likely to land within the top 5% of
                  the space along the dimensions that matter

  BAYESIAN      model the objective, sample where the expected
                improvement is highest
                → best sample efficiency; sequential, so it
                  parallelises less well

  HYPERBAND /   allocate budget adaptively; kill bad runs early
  ASHA          → usually the best wall-clock choice, and
                  combines with Bayesian sampling (BOHB)
```

**Random beats grid, and early-stopping schedulers beat both on wall-clock.** The
reason grid search is bad is worth understanding: it spends the same number of
distinct values on the dimension that matters and the one that does not, so with
a fixed budget it explores the important axis far less than random sampling does.

The practical warnings:

```text
  □  search LOG-scale for learning rates and regularisation
  □  fix the seed during search, then re-verify the winner
     across several seeds
  □  a large search on a small validation set overfits the
     validation set — see the multiple-comparisons point above
  □  record the search space, not only the winner. "we tried
     LR from 1e-5 to 1e-1" is the reusable knowledge.
```

## Tooling

```text
  MLflow      open source, self-hostable, tracking + registry.
              the common default.
  Weights &
  Biases      excellent UI, collaboration, sweeps. hosted (with
              a self-hosted option).
  Neptune,
  Comet       similar; hosted
  DVC         git-centric; strong data/pipeline versioning,
              lighter on the tracking UI
  plain files a directory per run with config.json and
              metrics.json, indexed by a script
```

The last row is not a joke. **A convention plus a directory beats an unused
platform.** The failure mode is not choosing the wrong tool; it is a tool that
some runs go through and others do not, so no comparison is trustworthy.

```text
  the requirement that matters more than the tool:

    EVERY run is tracked. no exceptions, no "quick tests".

  the untracked quick test is always the one that worked.
```

Making tracking automatic — a decorator, a base class, a CI job — is what
achieves this. Relying on people to remember does not.

## Anti-patterns

```text
  ✗  model_final_v2_REAL_fixed.pkl
  ✗  metrics in a spreadsheet, pasted by hand
  ✗  the notebook that produced the shipped model, since edited
  ✗  "I think it was around 0.91"
  ✗  comparing against a number from a different eval set
  ✗  tracking only successful runs — the failures are half the
     knowledge
  ✗  a hyperparameter sweep with no record of the search space
```

The sixth is the subtle one. A tracking system containing only what worked cannot
tell you what has already been tried, so the team repeatedly re-runs the same
failed idea. **Log the failures deliberately**, with the conclusion attached.

## What to take away

1. Log the hypothesis and the conclusion alongside the config — that is what turns
   a database of numbers into knowledge that survives someone leaving.
2. Log metrics over time; two runs with identical final numbers can have
   completely different curves, and only one will survive a retrain.
3. Change one thing, use the same evaluation set, run several seeds, and report
   the spread.
4. Selecting the best of many runs biases the validation metric — keep a test set
   touched exactly once.
5. Random search beats grid for a fixed budget, and adaptive early-stopping beats
   both on wall-clock; record the search space, not just the winner.
6. Track every run automatically, including failures — the untracked quick test is
   always the one that worked.

Next: the model registry — the bridge between an experiment and a deployment.
