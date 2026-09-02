---
title: Shuffles, skew and joins
minutes: 20
summary: Where batch jobs spend their time, and the one partition that makes a job take ten hours.
---

A batch job's runtime is usually dominated by two things: how much data crosses
the network during shuffles, and whether the work is evenly divided. The second
is the more common cause of a job that "used to take twenty minutes" taking
seven hours.

## What a shuffle actually does

```text
  MAP SIDE                          REDUCE SIDE

  each task partitions its output   each task fetches ITS partition
  by hash(key), sorts, and writes   from EVERY map task's output
  to local disk

  ┌────────┐                        ┌────────┐
  │ task 1 │──▶ [p0][p1][p2]        │ task 1 │◀── p0 from all tasks
  │ task 2 │──▶ [p0][p1][p2]   ──▶  │ task 2 │◀── p1 from all tasks
  │ task 3 │──▶ [p0][p1][p2]        │ task 3 │◀── p2 from all tasks
  └────────┘                        └────────┘

  M map tasks × R reduce tasks = M×R network fetches
```

The costs, in order of how often each dominates:

```text
  1. NETWORK      the whole dataset crosses the network
  2. DISK         map output is written to disk and read back
  3. SERIALISATION every record is encoded and decoded
  4. SORTING       usually required to group by key
  5. MEMORY        buffers on both sides; exceeding them SPILLS
```

**Reducing the data before the shuffle is worth far more than optimising the
shuffle.** Filter early, project only needed columns, and pre-aggregate — a
combiner that partially aggregates on the map side can cut shuffle volume by
orders of magnitude for a `groupBy` with few distinct keys.

## Data skew

The dominant practical problem. Partitions should be roughly equal; real key
distributions are not.

```text
  after shuffling by user_id:

  p0: ██ 200 MB
  p1: ██ 180 MB
  p2: ████████████████████████████ 40 GB   ← one whale, or NULL
  p3: ██ 210 MB

  the job takes as long as p2. the cluster idles waiting for it.
```

```text
  symptoms
    □  one task runs for hours while thousands finish in seconds
    □  that task runs out of memory, or spills heavily
    □  the stage's median duration and max duration differ by 100×
    □  speculative execution does not help — the duplicate is
       ALSO processing 40 GB
```

That last point is diagnostic. Speculative execution fixes a *slow machine*; it
does nothing for a *large partition*, because both copies do the same work.

### Where skew comes from

```text
  □  NULL / sentinel values      millions of rows with key = NULL
                                 all hashing to one partition
  □  power-law entities          one customer 1,000× the median
  □  a default value             "unknown", 0, ""
  □  low-cardinality keys        fewer distinct keys than partitions
  □  time-based keys with a burst
```

**Nulls are the single most common cause**, and they are almost always a bug: you
are grouping or joining on a key that should have been filtered first. Check for
them before anything cleverer.

### The fixes

**1. Filter the skew out**, when it is not needed:

```sql
WHERE user_id IS NOT NULL
```

Trivial, and it fixes the majority of real cases.

**2. Salt the key** — the technique from the partitioning topic:

```python
# spread the heavy key across N partitions
df.withColumn("salted", concat(col("user_id"), lit("#"),
                               (rand() * 16).cast("int")))
  .groupBy("salted").agg(...)          # partial aggregates
  .withColumn("user_id", split(col("salted"), "#")[0])
  .groupBy("user_id").agg(...)         # combine the 16 partials
```

Two-stage aggregation: partial results per salt bucket, then combined. Works for
any *associative* aggregation (sum, count, min, max) and not for ones that need
all values at once (exact median, exact distinct).

**3. Separate the heavy keys.** Process the top-N keys as their own job with a
different strategy, and everything else normally. Uglier, and sometimes the only
thing that works.

**4. Let the engine handle it.** Spark's adaptive query execution detects skewed
partitions at runtime and splits them automatically. Enable it — it removes the
most common cases without any code change.

## Join strategies

The choice determines whether a shuffle happens at all.

```text
  BROADCAST (map-side) JOIN
    small side sent to every node; join happens locally

    ┌──────────┐
    │ small    │──── broadcast to all ────▶ joined locally
    │ (100 MB) │
    └──────────┘
    ✓ NO SHUFFLE of the large side
    ✗ small side must fit in each executor's memory


  SORT-MERGE JOIN
    both sides shuffled by key, sorted, merged

    ✓ works for any size
    ✗ shuffles BOTH sides — the expensive default


  BUCKETED JOIN
    both tables pre-partitioned by the join key at WRITE time

    ✓ no shuffle at query time, ever
    ✗ requires planning at write time, and both tables to agree
```

**Broadcasting is the largest single win available in most jobs.** Engines
auto-broadcast below a size threshold, but their size estimate is often wrong
after a few transformations, so they fall back to sort-merge unnecessarily. An
explicit broadcast hint is frequently a 10× improvement:

```python
large.join(broadcast(small), "key")
```

**Bucketing** is worth knowing for tables joined repeatedly on the same key. Pay
the partitioning cost once at write time and every subsequent join is
shuffle-free — the same idea as co-partitioning in the partitioning topic.

## Partition sizing

```text
  TOO FEW partitions           TOO MANY partitions
  ─────────────────            ───────────────────
  poor parallelism             scheduling overhead per task
  large partitions spill       many tiny files on write
  OOM risk                     driver memory pressure tracking them

  rule of thumb: target 100–200 MB per partition,
                 and at least 2–3 partitions per core
```

**The small-files problem** is the write-side version and it bites later: a job
writing 10,000 partitions produces 10,000 files, and the *next* job reading them
spends all its time on file listing and open calls. Coalesce before writing.

## The diagnostic order

```text
  1. Look at the stage with the longest duration.
  2. Compare its median task time to its max task time.
       ratio > 10  ──▶ SKEW. find the heavy key.
       ratio ≈ 1   ──▶ genuinely a lot of work, or too few partitions
  3. Check spill metrics. Spilling means partitions are too large.
  4. Check shuffle read/write volume. Can it be reduced by filtering
     earlier, projecting fewer columns, or pre-aggregating?
  5. Check join strategies. Is anything sort-merging that could
     broadcast?
  6. Only then consider more machines.
```

Step 6 is deliberately last. Adding machines to a skewed job does nothing — the
one enormous partition still runs on one core — and it is the most common
response to a slow job.

## What to take away

1. A shuffle moves the whole dataset across the network with a disk write and
   read on each side; reducing data *before* it beats optimising it.
2. Skew is the dominant practical problem, and one oversized partition determines
   the whole job's runtime.
3. Speculative execution does not fix skew — both copies process the same large
   partition, which is how you tell the two apart.
4. Nulls are the most common skew cause and usually indicate a missing filter.
5. Salting with two-stage aggregation fixes skew for associative aggregations;
   adaptive query execution handles common cases automatically.
6. Broadcasting the small side of a join eliminates the shuffle and is often a
   10× win the engine misses; bucketing removes it permanently for repeated joins.

Next: stream processing, where the dataset never ends.
