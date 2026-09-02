---
title: Batch processing and the dataflow model
minutes: 20
summary: MapReduce's idea, what replaced it, and why the execution graph is the thing to understand.
---

Batch processing is computing over a bounded dataset: read it all, transform it,
write the result. The engineering problem is not the transformation — it is doing
it across hundreds of machines where some will fail, and doing it in a way where
a failure does not mean starting over.

## MapReduce, and the idea that mattered

```text
  INPUT ──▶ MAP ──▶ SHUFFLE ──▶ REDUCE ──▶ OUTPUT

  map:     (k1, v1) → list of (k2, v2)      independent, parallel
  shuffle: group all values by k2            THE EXPENSIVE PART
  reduce:  (k2, list of v2) → result         parallel per key
```

Word count, the canonical example:

```text
  map("doc1", "the cat sat")   → [("the",1), ("cat",1), ("sat",1)]
  map("doc2", "the dog sat")   → [("the",1), ("dog",1), ("sat",1)]

  shuffle: "the" → [1,1]   "cat" → [1]   "sat" → [1,1]   "dog" → [1]

  reduce("the", [1,1]) → ("the", 2)
```

The important contribution was never the API. It was:

**A fault-tolerance model that does not restart the job.** Map and reduce tasks
are deterministic functions of their input, so a failed task is simply re-run on
another machine. In a thousand-machine job where failures are routine, this is
the difference between a job that finishes and one that never does.

**Moving computation to data.** Send the code to the machine holding the block
rather than shipping terabytes across the network — because in 2004 the network
was the scarce resource.

**A programming model that hid distribution.** You wrote two functions; the
framework handled partitioning, scheduling, retries and stragglers.

## Why it was replaced

```text
  MULTI-STAGE JOB IN MAPREDUCE

  job 1: map ──▶ reduce ──▶ WRITE TO HDFS
                                │  full replicated write, then read back
  job 2: map ──▶ reduce ──▶ WRITE TO HDFS
                                │
  job 3: map ──▶ reduce ──▶ result

  every stage boundary is a full materialisation to disk,
  replicated 3×. an iterative algorithm doing 20 passes
  writes the dataset 20 times.
```

Machine learning and graph algorithms are iterative by nature, and MapReduce made
them absurdly expensive. Two things also changed underneath it: **memory got
cheap** (so intermediate data can stay in RAM) and **networks got fast** (so
"move computation to data" stopped being the dominant concern).

## The dataflow model

Modern engines — Spark, Flink, Dask, and the query engines inside every warehouse
— represent the whole job as a **DAG of operations** and optimise across it.

```text
  read ──▶ filter ──▶ map ──▶ join ──▶ aggregate ──▶ write
     └──────────── one graph the engine can rewrite ─────┘
```

That representation enables everything MapReduce could not do:

**Pipelining.** Chained narrow operations run in one pass without materialising
between them.

**Whole-graph optimisation.** The engine reorders and rewrites:

```text
  written:    read(1 TB) ──▶ join ──▶ filter(country='UK') ──▶ count
  executed:   read(1 TB) ──▶ filter ──▶ join ──▶ count
                             ▲
              predicate pushdown: filter BEFORE the join, so the
              join sees 30 GB rather than 1 TB
```

Predicate and projection pushdown often change runtime by an order of magnitude,
and go further when the storage format cooperates: a columnar file lets the
engine read only the needed columns and skip whole row groups by their min/max
statistics.

**Lazy evaluation.** Nothing runs until a result is demanded, so the engine sees
the complete graph before choosing a plan.

## Narrow and wide dependencies

The distinction that predicts a job's cost.

```text
  NARROW                            WIDE (shuffle)

  partition 1 ──▶ partition 1       p1 ──┐
  partition 2 ──▶ partition 2       p2 ──┼──▶ redistributed by key
  partition 3 ──▶ partition 3       p3 ──┘        │
                                                  ├──▶ p1'
  map, filter, union                              ├──▶ p2'
                                                  └──▶ p3'
  → no data movement
  → pipelined together              groupBy, join, distinct, sort
  → a lost partition is             → ALL-TO-ALL network transfer
    recomputed from ONE parent      → a stage boundary
                                    → a lost partition may need
                                      recomputing from everything
```

**Every performance question about a batch job is a question about its
shuffles.** They are the network cost, the disk spill cost, the stage boundaries,
and the place where skew appears. Reading a query plan means finding the wide
dependencies and asking whether each is necessary.

## Fault tolerance: lineage versus checkpoints

```text
  LINEAGE (recompute)               CHECKPOINTING (persist)

  remember HOW each partition       write intermediate results
  was derived; on loss, re-run      to durable storage; on loss,
  the derivation                    reload

  + no write cost in the happy path + recovery is fast and bounded
  - recovery cost grows with the    - a write cost on every
    length of the chain               checkpoint
  - a wide dependency may require
    recomputing many parents
```

Spark uses lineage by default and offers explicit checkpointing to truncate it.
The rule that follows: **checkpoint after expensive wide operations and in long
iterative chains**, or a failure late in a 40-iteration job recomputes from
iteration 1.

## Stragglers

In a job with 10,000 tasks, the slowest determines completion. Tasks are slow for
reasons unrelated to correctness: a degraded disk, a noisy neighbour, an uneven
partition.

**Speculative execution** is the standard answer: when a task is much slower than
its peers, launch a duplicate elsewhere and take whichever finishes first.

```text
  task 7,412 is at 20% while the median task is done
     → launch a second copy on another node
     → take the first to finish, kill the other
```

This costs a few percent of extra capacity and can cut tail completion time
substantially — the same hedged-request idea from the fundamentals topic, applied
to batch tasks. The requirement is the same too: **tasks must be idempotent and
side-effect-free**, or running two copies corrupts the output. A task that writes
directly to a destination breaks this; one that writes to a temporary location
and commits atomically does not.

## The output commit problem

Which raises the question the framework has to answer: how does a distributed job
produce output atomically, when tasks fail and are retried?

```text
  BAD:  each task appends directly to the destination
        → a retried task duplicates its output
        → a partial job leaves partial results readable

  GOOD: each task writes to a unique temporary location.
        when ALL tasks succeed, the job atomically commits by
        renaming/moving the files into place.
```

This is why object-store commit protocols are a recurring source of subtlety:
rename is atomic on HDFS and *not* on S3, where it is a copy. Modern table
formats (Iceberg, Delta) solve it properly by committing a new metadata pointer
atomically, which is the same "one atomic single-row write is the decision" trick
as Percolator.

## Reading a query plan

The practical skill, and it is worth doing before optimising anything:

```text
  □  Where are the SHUFFLES? Each is a stage boundary and a network cost.
  □  Is the filter pushed down, or applied after a join?
  □  Are all columns being read, or only the needed ones?
  □  Are joins BROADCAST (small side sent everywhere, no shuffle)
     or SORT-MERGE (both sides shuffled)?
  □  How many partitions per stage? Too few = no parallelism.
     Too many = scheduling overhead dominates.
  □  Is the same intermediate result computed twice? Cache it.
```

The single highest-yield item is the broadcast join. If one side of a join fits
in memory, broadcasting it eliminates a shuffle entirely, and engines will do this
automatically only when they can estimate the size — which they often cannot after
a few transformations. Telling the engine explicitly is frequently the largest
single speedup available.

## What to take away

1. MapReduce's contribution was a fault-tolerance model where deterministic tasks
   can simply be re-run, not the API.
2. It was replaced because every stage boundary materialised to replicated disk,
   which made iterative algorithms absurdly expensive.
3. The dataflow model represents the whole job as a DAG, enabling pipelining,
   predicate pushdown and lazy planning.
4. Narrow dependencies are free; wide dependencies (shuffles) are the network
   cost, the stage boundaries and the source of skew — every performance question
   is about them.
5. Lineage avoids write cost but makes recovery unbounded; checkpoint after
   expensive shuffles and in long iterative chains.
6. Speculative execution fixes stragglers and requires idempotent, side-effect-free
   tasks with an atomic output commit.

Next: shuffles, skew and joins — where batch jobs actually spend their time.
