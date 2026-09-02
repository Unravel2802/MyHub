---
title: Hot keys and skew
minutes: 19
summary: The failure that hashing cannot fix, and the six techniques that can.
---

Consistent hashing distributes *keys* evenly. It does nothing about *traffic*,
and traffic is never uniform. One celebrity account, one enormous tenant, one
trending product — and a single partition receives a hundred times its share
while the rest of the cluster idles.

```text
  hash-partitioned by user_id, 4 partitions

  ┌──────────┬──────────┬──────────┬──────────┐
  │  25%     │  25%     │  25%     │  25%     │   ← DATA: perfectly even
  ├──────────┼──────────┼──────────┼──────────┤
  │   2%     │   1%     │  95% ████│   2%     │   ← TRAFFIC: one celebrity
  └──────────┴──────────┴──────────┴──────────┘
```

No hash function fixes this, because all the requests are for **the same key**.
This is the limit of the partitioning ideas so far, and it needs different tools.

## Two different skews

Worth separating, because the responses differ:

**Data skew** — one partition holds much more data. Causes: low-cardinality
partition key, a tenant with 1,000× the rows, a range-partitioned key with an
uneven distribution. Symptoms: disk pressure, slow scans, long rebalance times.

**Traffic skew** — one partition receives much more load. Causes: a viral item, a
celebrity user, a whale tenant, a poorly cached hot lookup. Symptoms: latency on
one node, timeouts for a subset of users, a saturated node beside idle ones.

They can occur independently. A partition holding 1% of data can take 90% of
traffic.

## Detection

You cannot fix what you cannot see, and per-node metrics are not enough — a node
at 90% CPU tells you nothing about *which key* is responsible.

```text
  what to measure

  per PARTITION:  request rate, bytes, p99 latency, storage
  per KEY:        top-N by request rate  ← the one people lack
```

Top-N key tracking at request rates of hundreds of thousands per second cannot
keep an exact count per key. The standard answers are **sketch** data structures:

- **Count-Min Sketch** — fixed-size, gives approximate counts with a bounded
  over-estimate, in a few kilobytes regardless of key cardinality.
- **Heavy hitters / Space-Saving** — maintains an approximate top-K directly.

A few kilobytes of counters that tell you "key `user:88213` is 40% of traffic" is
worth far more than another dashboard of per-node CPU. Redis's `--hotkeys` and
DynamoDB's CloudWatch Contributor Insights both exist for exactly this.

## The six techniques

### 1. Cache the hot key

The cheapest fix, and the right first move for read-heavy skew. A hot key is by
definition read often, which is the ideal cache profile — one entry serves 95% of
the traffic.

```text
  request ──▶ local in-process cache (hot keys only)
                  │ miss
                  ▼
              shared cache
                  │ miss
                  ▼
              partition
```

A small **in-process** cache in front of the shared cache is especially effective
here: the hot key is served from local memory with no network hop at all, and the
cache only needs to hold a handful of entries to absorb most of the skew.

Watch for the stampede when it expires — this is precisely the case where
stale-while-revalidate or single-flight matters, because a hot key's expiry
releases the full 95% at once.

### 2. Split the key

Add a random suffix so one logical key becomes several physical ones.

```text
  writes:  key = f"post:{id}:like_count:{random.randint(0, 15)}"
           → 16 partitions share the write load

  reads:   sum of all 16 shards
           → 16 reads instead of 1, but they parallelise
```

Excellent for **write**-heavy skew on aggregatable data: counters, likes, view
counts, metrics. The read becomes a scatter-gather of fixed, small width — which
is a bounded cost, not a fan-out over the whole cluster.

It does not work when the value is not aggregatable. You cannot split "the
current status of order 7" across 16 shards.

### 3. Isolate the whale

Give the large entity its own partition, or its own cluster.

```text
  ┌──────────────────────────────────────┐
  │  shared partitions: 9,000 tenants    │
  ├──────────────────────────────────────┤
  │  dedicated: mega-corp                │  ← its own resources
  ├──────────────────────────────────────┤
  │  dedicated: big-bank                 │
  └──────────────────────────────────────┘
```

This is directory-based partitioning from the earlier chapter, applied to the
skew problem, and it is what most successful multi-tenant SaaS platforms
converge on. It also solves the blast-radius problem — a whale's traffic spike
cannot affect the shared tier — and it aligns neatly with pricing, since the
customers who need dedicated capacity are usually the ones paying for it.

### 4. Add replicas for the hot partition

If the skew is read-heavy and the key cannot be cached (it changes constantly),
add replicas of just that partition and spread reads across them.

```text
  partition 3 (hot):  leader + 5 read replicas
  partitions 1,2,4:   leader + 1 read replica each
```

Asymmetric replication factors are supported by fewer systems than you would
like, and it is the reason "adaptive replication" appears in some designs. Where
supported it is a precise fix.

### 5. Change the partition key

The correct fix, and the expensive one. If the skew is structural — the key
simply does not distribute — no amount of tactical work will hold.

The signal that you are here: you have applied two or three of the techniques
above and skew keeps reappearing in new places. That means the key is wrong, not
that this particular whale is unusual.

Doing it requires a migration — dual-write to both schemes, backfill, verify,
cut over, remove the old — which is the expand/contract pattern applied to a
whole dataset.

### 6. Shed or throttle the hot key

Sometimes the right answer is a limit. Per-key rate limiting protects everyone
else from one key's traffic, and turns a cluster-wide latency incident into a
degraded experience for one entity.

```text
  without throttling:  hot key saturates partition 3
                       → all users on partition 3 see timeouts

  with throttling:     hot key is limited to its quota
                       → the hot entity is degraded
                       → everyone else on partition 3 is fine
```

This is a product decision as much as a technical one, and it is worth making
deliberately rather than discovering it as an outage.

## Choosing between them

```text
  Is the skew READ or WRITE?
   │
   ├─ READ ── Is the value cacheable (changes slowly)?
   │           ├─ YES ──▶ (1) cache it. usually enough.
   │           └─ NO  ──▶ (4) more replicas for that partition
   │
   └─ WRITE ─ Is the value aggregatable (counter, set, log)?
               ├─ YES ──▶ (2) split the key into shards
               └─ NO  ──▶ (3) isolate it, or (6) throttle it

  Recurring in new places, repeatedly?
       ──────▶ (5) the partition key is wrong. migrate.
```

## The whale problem in multi-tenant systems

Worth its own note because it is so common. Tenant sizes follow a power law: the
largest customer is routinely 100–1,000× the median. Partitioning by `tenant_id`
therefore *guarantees* skew — it is not a risk, it is arithmetic.

The design that works:

```text
  1. partition by tenant_id (keeps a tenant's data together —
     which is what makes queries and transactions work)
  2. maintain an explicit tenant → shard directory
  3. monitor per-tenant load continuously
  4. move a tenant to a dedicated shard when it exceeds a threshold
  5. make that move a routine, automated, tested operation
```

Step 5 is the one that separates systems that handle growth from systems that
have an incident every time a customer succeeds. Tenant migration should be a
button, exercised regularly, not a heroic manual project.

## What to take away

1. Hashing distributes keys, not traffic. A single hot key defeats every hashing
   scheme, because every request is for the same key.
2. Data skew and traffic skew are different problems with different fixes and can
   occur independently.
3. Detect with per-key top-N tracking using sketches, not per-node CPU — a few
   kilobytes of counters beats another node dashboard.
4. Read skew: cache it, or replicate that partition more. Write skew on
   aggregatable data: split the key into a bounded number of shards.
5. Isolating whales onto dedicated partitions solves skew and blast radius at
   once, and aligns with how they are priced.
6. Multi-tenant skew is arithmetic, not bad luck — build automated tenant
   migration before you need it.

Next: rebalancing and routing — moving partitions between nodes while serving
traffic, and how a request finds the right one.
