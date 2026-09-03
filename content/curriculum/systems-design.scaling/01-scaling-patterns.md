---
title: Scaling patterns
minutes: 19
summary: The moves available when one machine is not enough, in the order you should try them.
---

Scaling is a sequence of moves, each with a cost, and the discipline is taking
them in order. Most systems that are painful to operate took an expensive move
early when a cheap one would have sufficed for years.

## The ladder

```text
  1. DO LESS WORK          indexes, better queries, fewer
                           round trips
  2. CACHE                 the highest leverage in read-heavy
                           systems
  3. SCALE VERTICALLY      a bigger machine
  4. SCALE READS           replicas
  5. OFFLOAD               queues, CDN, object storage
  6. PARTITION             the point of no return
  7. SPECIALISE            a different engine per workload
```

```text
  1–5 are REVERSIBLE and cheap.
  6 is a permanent complexity tax.

  → the ordering is the whole lesson
```

## Do less work

The step people skip, and the one with the best return:

```text
  □  a missing INDEX is behind an enormous share of "we need
     to scale the database"
  □  N+1 queries — the over-the-network version from the
     fundamentals topic
  □  SELECT * moving columns nobody reads
  □  unbounded result sets
  □  work on the request path that belongs in a background
     job
```

```text
  a query going from a sequential scan to an index scan is
  frequently a 100–1000× improvement, for one DDL statement.
```

## Caching

```text
  the layers, cheapest first

    browser         free; you control it with headers
    CDN             absorbs static and media entirely
    application     in-process; nanoseconds, per-instance
    shared cache    Redis; one view all instances agree on
    database        buffer pool; already there
```

```text
  the arithmetic that makes it decisive

    read:write 10:1, cache hit rate 90%
    → the database sees 10% of reads plus all writes
    → roughly a 5× reduction in database load, from one
      component
```

```text
  and the discipline from the caching topic
    □  name what staleness you are accepting
    □  TTL plus explicit invalidation, with jitter
    □  single-flight or stale-while-revalidate against
       stampedes
    □  a cache in front of a missing index hides a bug and
       fails hardest when cold
```

## Vertical scaling

```text
  a modern server: 192 cores, 2 TB RAM, 100 TB NVMe.

  doubling it is a maintenance window.
  sharding is a quarter of engineering time and a permanent
  tax.
```

**Buy the bigger machine.** It ends eventually, and it ends much later than most
designs assume — and the year it buys is a year spent on the product.

## Scaling reads

```text
  primary ──▶ replica ──▶ reads
          ──▶ replica ──▶ reads

  ✓ near-linear read scaling
  ✗ does NOT scale writes — every replica applies every write
  ✗ replication lag, and the three anomalies from the
    replication chapter
```

```text
  → so: route reads that tolerate staleness to replicas, and
    reads that follow a user's own write to the primary
    (or use a position token)
```

## Offloading

```text
  ASYNC PROCESSING
    take work off the request path: emails, thumbnails,
    indexing, analytics, webhooks
    → the request returns in 20 ms instead of 2 s
    → and the work becomes retryable

  CDN
    static assets and media, served from the edge
    → removes the largest bandwidth item entirely

  OBJECT STORAGE
    files do not belong in a database
    → and signed URLs let clients upload and download
      directly, bypassing your servers
```

The direct-upload pattern is worth naming: issuing a signed URL so the client
sends a 50 MB file straight to object storage removes that bandwidth, that memory
and that latency from your application entirely.

## Partitioning

```text
  the only thing that scales WRITES.

  and it costs, per the partitioning topic:
    cross-partition queries become fan-out
    transactions across partitions need 2PC or a saga
    joins across differing keys are expensive
    global uniqueness is hard
    rebalancing is an operational project
```

```text
  □  choose the key from access patterns, cardinality, even
     distribution of BOTH data and traffic, and transaction
     boundaries
  □  a hot key defeats any hashing scheme
  □  and the composite key — hash the entity, sort within it
     — gives locality and range queries together
```

## Specialising

```text
  once partitioned, different workloads want different
  engines:

    writes           the operational store
    search           an index, fed by CDC
    analytics        a columnar warehouse, fed by CDC
    caching          Redis
    media            object storage + CDN
```

```text
  every derived store is a SYNC PROBLEM, permanently.
  → CDC from the operational store's log, not dual writes
```

## The write-path patterns

```text
  WRITE-BEHIND      acknowledge, persist asynchronously
                    → fastest; can lose acknowledged data
  BATCHING          accumulate and write in groups
                    → far higher throughput, slight latency
  APPEND-ONLY       never update in place
                    → sequential writes are the fastest thing
                      storage does
  CQRS              separate write and read models
                    → each optimised; eventual consistency
                      between them
```

## Statelessness

```text
  a stateless application server can be scaled by adding
  instances and killed without consequence.

  → push state OUT: sessions to Redis, files to object
    storage, state to the database
  → then autoscaling, rolling deploys and failure recovery
    all become trivial
```

This is the precondition for most of the other moves, and it is worth doing early
because retrofitting it into a stateful service is painful.

## Knowing when to stop

```text
  every step adds operational surface.

  □  are you actually at the limit, or guessing?
  □  what does the profile say — CPU, IO, network, lock
     contention?
  □  is the bottleneck one query, or the architecture?
  □  what is the growth rate, and how long does this buy?
```

```text
  the failure mode: designing for 100× current load and
  paying that complexity every day for the year before it
  arrives — if it arrives.
```

**Design for 10×, not 1000×.** A system that handles ten times current load buys
you the time to learn what the next constraint actually is, which is better
information than any amount of anticipation.

## What to take away

1. The ladder is: do less work, cache, scale up, scale reads, offload, partition,
   specialise — and the first five are reversible while partitioning is not.
2. A missing index is behind an enormous share of scaling problems, and a query
   going from scan to index is frequently 100–1000×.
3. Caching is decisive in read-heavy systems: 90% hit rate at a 10:1 read ratio is
   roughly a 5× database load reduction.
4. Buy the bigger machine — vertical scaling ends much later than designs assume.
5. Replicas scale reads only; partitioning is the only thing that scales writes,
   and it costs cross-partition queries, transactions and joins.
6. Make servers stateless early, and design for 10× rather than 1000×.

Next: the API contracts that hold as all this changes underneath.
