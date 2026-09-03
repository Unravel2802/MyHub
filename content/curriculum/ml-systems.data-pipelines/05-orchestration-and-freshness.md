---
title: Orchestration and freshness
minutes: 18
summary: Running the pipelines that feed a model, and the staleness nobody notices until accuracy drops.
---

ML pipelines are ordinary data pipelines with two additional properties: a
failure is often silent, and the thing that suffers is a model's accuracy rather
than a dashboard's contents. Everything from the data-engineering track applies;
this chapter is what is different.

## The pipeline graph

```text
  raw events ──▶ cleaning ──▶ feature computation ──┬──▶ online store
       │                            │                └──▶ offline store
       │                            │
  labels ────────────────────────▶ training set ──▶ training ──▶ registry
                                                                    │
                                                                    ▼
                                                             deployment
```

The dependency that makes this different from a reporting pipeline: **the
training set depends on labels that mature later than the features**. A pipeline
that builds a training set for yesterday's events is building it from labels that
do not exist yet, and the standard bug is a training set silently shrinking
because most of its rows had no mature label.

```text
  □  every training-set job must state which label window it
     requires, and REFUSE to build rows whose window is open
  □  the row count of the training set is a monitored metric —
     a drop means the label join broke, and it is otherwise
     invisible
```

## Freshness as an SLO

Every feature has a freshness requirement that comes from the *decision*, not from
what the pipeline happens to deliver:

```text
  feature                          required freshness
  ────────                         ──────────────────
  fraud: transactions in 5 min     seconds
  session: pages viewed            seconds
  ranking: item popularity today   minutes to an hour
  churn: orders in 90 days         a day
  demographics                     weeks
```

**A stale feature is a silent accuracy loss.** The model receives a plausible
value that describes the world as it was, produces a confident answer, and
nothing errors. This is the ML-specific version of gray failure from the
resilience topic, and the defence is the same: measure the thing that matters
(freshness) rather than the thing that is easy (did the job exit zero).

```text
  MONITOR PER FEATURE
    now() − max(feature.event_timestamp)

  ALERT when it exceeds the declared requirement, not when
  the job fails — a job that succeeds while producing stale
  output is the case you are trying to catch.
```

## Backfills

The operation that goes wrong most often, because it interacts with everything
else in this topic.

```text
  reasons to backfill
    □  a new feature must be computed for historical rows
    □  a bug corrupted a range of data
    □  upstream data arrived late
    □  the definition changed
```

The rules:

```text
  1. BACKFILL MUST BE POINT-IN-TIME CORRECT
     recomputing "orders in the last 30 days" for March using
     TODAY's orders table includes orders placed in April.
     → the backfill has just injected leakage into the
       training set

  2. BACKFILL AND STREAMING MUST AGREE
     a feature computed by a batch backfill and by a streaming
     job will differ unless they share the definition —
     the same skew problem, one level down

  3. BACKFILL IS EXPENSIVE
     recomputing two years of features over billions of rows
     is a large job. rate-limit it so it does not starve the
     production pipelines it shares a cluster with.

  4. BACKFILLS MUST BE IDEMPOTENT
     they will be re-run. partial completion must not
     double-count.
```

Rule 1 is the one that quietly ruins datasets. A backfill that uses current-state
tables to reconstruct history is the most efficient way to introduce temporal
leakage into a system that had none.

## Late-arriving data

```text
  an event with timestamp 14:03 arrives at 16:40

  the 14:00 partition was closed at 15:00 and the feature
  computed from it is now wrong.
```

Three responses, and the choice should be explicit per feature:

```text
  IGNORE       accept the small error. correct for high-volume,
               low-stakes aggregates.
  REPROCESS    recompute the affected windows when late data
               arrives. correct, and expensive.
  WATERMARK    wait a defined period before considering a
               window final — the streaming topic's mechanism,
               applied to feature computation.
```

The important part is that **training and serving must make the same choice**. If
the offline pipeline reprocesses late data and the online one does not, training
values are systematically more complete than serving values — which is exactly the
worked example from the skew chapter.

## Orchestration requirements

```text
  □  DEPENDENCIES     do not compute features before the data
                      they depend on has landed
  □  IDEMPOTENCE      every task safe to re-run
  □  RETRIES          with backoff, and a cap
  □  PARTIAL FAILURE  one failed partition must not silently
                      produce an incomplete dataset
  □  BACKFILL         re-running a historical date range must be
                      a first-class operation, not a hack
  □  DATA-AWARE
     TRIGGERING       "run when the upstream table has today's
                      partition" beats "run at 02:00 and hope"
```

The last is worth insisting on. **Time-based triggering assumes upstream
punctuality**, and upstream is late eventually. A pipeline that runs at 02:00
regardless produces an empty or partial output, and the downstream training job
trains on it. Data-aware triggering — wait for the dependency to be *ready*, with
a timeout that alerts rather than proceeds — removes the class.

## The silent failures to watch for

```text
  □  a job succeeds and writes ZERO rows
       → assert on row count, not on exit code

  □  a join silently drops rows
       → assert input count ≈ output count, within a tolerance

  □  a feature is always its default value
       → an upstream column was renamed; the lookup returns null;
         imputation fills a constant. the model sees no signal
         and nothing errors.

  □  the training set shrinks gradually
       → a label join is degrading

  □  a partition is written twice
       → duplicates inflate a count-based feature
```

The third is the most insidious in this list. A feature that becomes constant
does not break anything: the pipeline is green, the model trains, the evaluation
passes (the feature is constant in both splits), and the model has silently lost
one input. **Alert on per-feature variance collapsing to zero** — it costs one
metric and catches an entire failure class.

## The cost dimension

```text
  feature pipelines are usually the largest ML compute cost,
  ahead of training for most organisations.

  □  recomputing everything nightly when 5% changed
  □  materialising features no model reads
  □  a streaming job for a feature that needs daily freshness
  □  backfilling more history than any model uses
```

The audit worth running quarterly: **for each materialised feature, which models
read it, and what freshness do they need?** Features with no readers get deleted;
features over-provisioned for freshness get moved to a cheaper cadence. Both are
usually available and neither happens without someone deliberately looking.

## What to take away

1. Training-set jobs depend on labels that mature later than features; monitor the
   training-set row count, because a degrading label join is otherwise invisible.
2. Freshness is an SLO per feature derived from the decision, and a stale feature
   is a silent accuracy loss — alert on freshness, not on job success.
3. Backfills must be point-in-time correct; recomputing history from current-state
   tables injects leakage into a clean dataset.
4. Late-arriving data must be handled the same way in training and serving, or you
   have reintroduced skew.
5. Use data-aware triggering rather than time-based, and assert on row counts and
   per-feature variance — a feature that goes constant breaks nothing and destroys
   signal.
6. Feature pipelines are usually the largest ML compute cost; audit readers and
   required freshness per feature.

That completes ML data pipelines. Next in the track: **experiments and
reproducibility** — being able to rebuild and explain any model you have shipped.
