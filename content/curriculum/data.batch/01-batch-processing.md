---
title: Batch processing
minutes: 19
summary: Spark's execution model — and skew, the specific failure mode that turns "add more machines" into "watch one machine do all the work."
---

The Batch & Stream Processing chapter already covered the general shape of
distributed batch computation. This chapter is the specific execution model
(Spark, the dominant real-world implementation) and the operational failure
that trips up nearly every large batch job at some point: skew, where the
work isn't actually distributed evenly no matter how many machines you add.

## The execution model: transformations, actions, and lazy evaluation

```text
  df = spark.read.parquet("orders/")
  filtered = df.filter(df.status == "completed")   // LAZY —
                                                        nothing
                                                        actually
                                                        runs yet
  grouped = filtered.groupBy("region").sum("total")  // still
                                                          LAZY
  grouped.show()                                    // ACTION —
                                                        THIS
                                                        triggers
                                                        actual
                                                        execution
```

```text
  → TRANSFORMATIONS (filter, groupBy, join) are LAZY — Spark
    builds up a PLAN (a DAG of operations, the Discrete
    Mathematics chapter's structure, again) without executing
    anything — only an ACTION (show, write, count) triggers
    REAL execution. this matters concretely: Spark can OPTIMIZE
    the entire chain of transformations TOGETHER before running
    any of it (the Languages and Compilers chapter's
    optimization-pass idea, applied to a distributed data
    pipeline instead of a single-machine program) — reordering
    a filter to run BEFORE an expensive join, for instance,
    rather than after, dramatically reducing the data the join
    itself has to process.
```

## Partitions and parallelism: the actual unit of distributed work

```text
  a Spark DataFrame is SPLIT into PARTITIONS — each partition
  processed by ONE TASK, on ONE core, of ONE machine, in the
  cluster.

  → MORE partitions than available cores means some tasks WAIT
    for a core to free up; FEWER partitions than cores means
    some cores sit IDLE the whole job, doing nothing — the
    right partition COUNT is tuned to the actual cluster's
    available parallelism, not chosen arbitrarily or left at
    an unexamined default.
```

## Shuffles: the expensive operation that crosses the network

```text
  df.groupBy("customer_id").sum("total")

  → to GROUP correctly, EVERY row with the SAME customer_id
    must end up on the SAME machine/partition — since the data
    started SCATTERED across many machines' partitions with no
    such guarantee, this REQUIRES a SHUFFLE: physically moving
    data ACROSS THE NETWORK between machines, to co-locate rows
    that share a key.
```

```text
  → a shuffle is BY FAR the most expensive operation in a
    typical Spark job — network I/O (the Computer Networking
    chapter's real, non-negligible cost) plus DISK I/O (spilling
    intermediate shuffle data that doesn't fit in memory) at a
    scale a purely in-memory, single-machine operation never
    pays at all. minimizing UNNECESSARY shuffles (filtering
    data down BEFORE a join or groupBy, rather than after) is
    the single highest-leverage Spark performance optimization
    that exists, precisely because it's usually the actual
    bottleneck.
```

## Skew: when the work isn't actually distributed evenly

```text
  groupBy("customer_id") on data where ONE customer_id (a bulk
  purchasing account, a test account, a data-entry error
  attributing many unrelated rows to one placeholder id) has
  a MASSIVELY disproportionate number of rows compared to
  every other customer_id.

  → EVERY row for that ONE key must go to the SAME partition
    (grouping REQUIRES this) — which means ONE task ends up
    processing FAR more data than every other task, and the
    ENTIRE JOB waits on that one slow, overloaded task to
    finish, while every other machine in the cluster sits idle,
    having long since completed its own, much smaller share of
    the work.
```

```text
  → this is a genuinely common, genuinely frustrating real-world
    failure mode: a job that processes 99% of a dataset's rows
    in 5 minutes and then APPEARS to hang for the next 55
    minutes, entirely because of ONE skewed key's task still
    grinding through a disproportionate share — "add more
    machines" doesn't help AT ALL here, because the problem
    was never insufficient TOTAL capacity, it's that the work
    for one specific key was never actually distributable
    across more than one machine in the first place.
```

```text
  → mitigations: SALTING (artificially splitting one hot key
    into several sub-keys — "customer_42_shard_0" through
    "customer_42_shard_3" — distributing that one key's rows
    across multiple partitions/tasks, then combining the
    partial results afterward) and BROADCAST JOINS (when one
    side of a join is genuinely small enough to fit in memory,
    send a COPY of it to every machine instead of shuffling the
    large side at all — trading a bounded amount of extra
    memory for skipping the expensive shuffle entirely).
```

## Jobs that finish: designing for the failure case, not just the happy path

```text
  → a batch job that runs successfully MOST of the time but
    occasionally fails partway through (a machine failure, a
    transient network issue, exactly the skew scenario above
    hitting an actual timeout) needs to be safely RESTARTABLE
    without either DUPLICATING already-processed output or
    LOSING partial progress — this is the same idempotent-
    write discipline the Queues and Async Jobs chapter covers
    for a message handler, now applied at the scale of an
    entire multi-hour distributed job rather than one message.
```

## What to take away

1. Spark's transformations are lazy and only an action triggers execution,
   which lets the whole chain be optimized together before anything
   actually runs — the same compiler optimization-pass idea, applied to a
   distributed pipeline.
2. A shuffle physically moves data across the network to co-locate rows
   sharing a key, and it's by far the most expensive operation in a typical
   job — minimizing unnecessary shuffles is the single highest-leverage
   performance optimization.
3. Data skew means one key's rows overload a single task while every other
   machine sits idle — "add more machines" doesn't help, because the
   problem was never insufficient total capacity.
4. Salting splits one hot key across multiple sub-keys to distribute its
   rows; a broadcast join sends a small table to every machine instead of
   shuffling the large side — both sidestep the shuffle skew causes.
5. A batch job needs the same idempotent-restart discipline as a message
   handler, applied at the scale of an entire multi-hour distributed job
   rather than one message, since a partial failure is a real, expected
   case to design for.
