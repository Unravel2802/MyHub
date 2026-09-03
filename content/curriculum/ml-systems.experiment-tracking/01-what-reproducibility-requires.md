---
title: What reproducibility requires
minutes: 18
summary: The full list of inputs that determine a model, and which ones you can actually pin.
---

"Can you rebuild the model we shipped in March?" is a question that arrives during
an incident, a regulatory review, or an attempt to improve on it — and for most
teams the answer is no. Reproducibility is not a virtue exercise; it is what makes
a model debuggable, defensible and improvable.

## The three levels

Worth separating, because teams aim at the wrong one:

```text
  1. RE-RUNNABLE      the pipeline executes again without
                      manual steps
                      → the minimum. most teams do not have it.

  2. REPRODUCIBLE     re-running produces a model with the SAME
                      METRICS, within noise
                      → what you actually need

  3. BIT-IDENTICAL    the same weights, byte for byte
                      → expensive, and rarely necessary
```

**Aim for level 2.** Level 3 requires fighting GPU non-determinism for a benefit
almost nobody needs. What matters is that a rebuilt model behaves the same, not
that its floats match.

The exception is regulated domains, where "we can demonstrate exactly how this
decision was produced" may be a legal requirement — and there level 3 becomes the
target, with the cost that implies.

## Everything that determines a model

```text
  DATA
    □  which rows        dataset version / snapshot id
    □  which filters     the query, verbatim
    □  which sampling    the method AND the seed
    □  which split       the split logic and its seed

  FEATURES
    □  feature definitions, versioned
    □  preprocessing parameters (fitted, not just described)
    □  feature ORDER

  CODE
    □  git commit of the training repo
    □  git state — clean, or the diff of uncommitted changes

  CONFIG
    □  every hyperparameter, in full, resolved
    □  the architecture definition

  ENVIRONMENT
    □  library versions — the full lock, not the top level
    □  the container image DIGEST, not its tag
    □  CUDA / cuDNN / driver versions

  HARDWARE
    □  GPU model, and how many
    □  the number of workers (it changes batch composition)

  RANDOMNESS
    □  every seed: framework, numpy, python, dataloader
    □  determinism flags
```

The ones people omit, and what each costs:

**The image digest rather than the tag.** `pytorch:2.4-cuda12` is a moving
pointer. Two runs a month apart against the same tag ran different code, and the
metric difference is unattributable.

**The full dependency lock.** A transitive minor-version bump changes a default
somewhere and the run is not comparable.

**Hardware.** Different GPU generations produce different numerics, and different
worker counts change how examples are batched — which changes batch-norm
statistics and gradient noise.

**Uncommitted changes.** The most common reproducibility failure in practice: the
experiment that worked was run from a dirty working tree, and the change was never
committed. Recording the diff, or refusing to log a run from a dirty tree, both
solve it.

## Sources of non-determinism

```text
  EASY TO CONTROL                    HARD TO CONTROL
  ───────────────                    ───────────────
  weight initialisation              GPU floating-point reduction
    → set a seed                       order (atomics complete in
  data shuffling                       arbitrary order)
    → set a seed                     non-deterministic cuDNN kernels
  dropout                              (selected by autotuning)
    → set a seed                     multi-worker data loading order
  train/test split                   distributed all-reduce order
    → set a seed                     thread scheduling in the loader
```

Frameworks expose flags to force the deterministic path:

```text
  torch.use_deterministic_algorithms(True)
  torch.backends.cudnn.benchmark = False       # stop autotuning
  CUBLAS_WORKSPACE_CONFIG=:4096:8

  cost: typically 10–30% slower, and some operations have no
        deterministic implementation and will raise
```

**Turn determinism on for debugging and off for production training.** Chasing a
"why did this run differ" question is much easier when the only variable is the
one you changed; paying 20% on every production run to get bit-identical weights
you will never compare is waste.

## Seeding correctly

```text
  # not enough — each library has its own generator
  random.seed(42)

  def seed_everything(seed: int):
      random.seed(seed)
      np.random.seed(seed)
      torch.manual_seed(seed)
      torch.cuda.manual_seed_all(seed)
      os.environ["PYTHONHASHSEED"] = str(seed)
      # dataloader workers each need their own derived seed,
      # or every worker produces the SAME augmentations
```

That last comment is a real and subtle bug: multi-worker data loaders fork after
seeding, so without a per-worker seed derived from the base, every worker applies
identical random augmentations and the effective augmentation diversity collapses
to 1/N.

**One further warning: a single seed is one sample.** Reporting a result from one
seed and treating a 0.3% improvement as real is a common error — the seed-to-seed
variance on many tasks exceeds that. Run three to five seeds and report the mean
and spread for anything you intend to act on.

## Reproducing the environment

```text
  WEAKEST                            STRONGEST
  ───────                            ─────────
  requirements.txt with ranges       a container image DIGEST
  a lockfile                         + the exact base image
  a conda environment export         + system libraries pinned
                                     + hardware recorded
```

The practical recommendation: **train inside a container, and record its digest**.
It captures the Python environment, the system libraries, CUDA and the entry
point in one identifier, and it is the only mechanism that reproduces
system-level dependencies at all.

## What "reproducible" is worth

The cost is real, so it is worth being clear about the return:

```text
  □  DEBUGGING — "the model got worse" is answerable only if you
     can diff two runs' inputs
  □  IMPROVEMENT — a baseline you cannot rebuild is a baseline you
     cannot beat with confidence
  □  INCIDENTS — "what did the model that made this decision
     actually see?"
  □  COMPLIANCE — in regulated domains, non-negotiable
  □  ONBOARDING — a new engineer can rebuild and verify rather
     than trusting a number in a slide
  □  ATTRIBUTION — knowing whether an improvement came from the
     data, the features or the architecture
```

The last is the one that changes how a team works. Without provenance, every
improvement is attributed to whatever the person was working on, and the team
learns nothing generalisable about where the gains actually come from.

## The minimum viable practice

If a platform is out of reach, this much is achievable in an afternoon:

```text
  □  training runs inside a container, digest recorded
  □  the run refuses to start from a dirty git tree
     (or records the diff)
  □  a single config file holds every hyperparameter, and is
     logged with the run
  □  the dataset snapshot id is logged
  □  seeds are set and logged
  □  metrics, the config and the model artifact land in one
     place keyed by a run id
  □  the model artifact embeds its own run id
```

That last item is worth the small effort: a model file that carries the id of the
run that produced it means a production model can always be traced back, even
when the deployment record is lost.

## What to take away

1. Aim for reproducible (same metrics within noise), not bit-identical — level 3
   costs a great deal for a benefit only regulated domains need.
2. A model is determined by data, features, code, config, environment, hardware
   and seeds; the commonly omitted ones are image digest, full lock, hardware and
   uncommitted changes.
3. Multi-worker data loaders need per-worker derived seeds, or every worker
   applies identical augmentations.
4. One seed is one sample — run several before believing a small improvement.
5. Enable framework determinism for debugging and disable it for production
   training; it costs 10–30%.
6. Train in a container and record its digest — it is the only mechanism that
   captures system-level dependencies.

Next: experiment tracking — turning hundreds of runs into knowledge rather than a
directory of checkpoints.
