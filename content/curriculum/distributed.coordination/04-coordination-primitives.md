---
title: Barriers, semaphores and counters
minutes: 18
summary: The coordination primitives past locks, and the approximate versions that scale.
---

Beyond mutual exclusion, distributed systems need a handful of other coordination
primitives: waiting for a group to arrive, limiting concurrency, enforcing a
rate, and counting. Each has an exact implementation that coordinates and an
approximate one that does not, and knowing where the approximation is acceptable
is most of the skill.

## Barriers

Wait until N participants arrive before anyone proceeds.

```text
  worker 1 ──arrive──▶ │
  worker 2 ──arrive──▶ │ BARRIER (n=4)
  worker 3 ──arrive──▶ │
  worker 4 ──arrive──▶ │ ──── all released together ────▶
```

Used for staged batch jobs (all mappers finish before any reducer starts), for
coordinated rollouts, and for test harnesses.

```python
def barrier(name, n, my_id):
    etcd.put(f"/barriers/{name}/{my_id}", "", lease=etcd.lease(300))
    for event in etcd.watch_prefix(f"/barriers/{name}/"):
        if etcd.count_prefix(f"/barriers/{name}/") >= n:
            return
```

The failure mode is the obvious one: **if a participant never arrives, everyone
waits forever.** Barriers therefore need a timeout and an explicit decision about
what happens on timeout — proceed with fewer, abort, or escalate. A barrier
without a timeout is a distributed hang waiting to happen.

The **double barrier** — wait for everyone to arrive, then wait for everyone to
leave — is what you need when the resource being coordinated is reused, and its
implementation is fiddly enough that it is worth using a library rather than
writing it.

## Semaphores: bounded concurrency

At most N holders at once.

```text
  limit = 3

  ┌───┬───┬───┐
  │ A │ B │ C │  held        D and E wait
  └───┴───┴───┘
```

The naive implementation — read the count, increment if under the limit — is a
check-then-act race. The correct approaches:

```text
  1. N NAMED SLOTS: try to acquire slot-0, slot-1 ... slot-N-1
     each is a plain lock. simple, and slots must be freed.

  2. ATOMIC COUNTER with a conditional increment:
       INCR only if the result stays <= N
     Redis Lua, or a database CHECK constraint.

  3. LEASE-BACKED ENTRIES: each holder writes a key with a TTL;
     count keys. crashed holders release automatically.
```

Option 3 is the robust one, because it survives holders crashing without
releasing. Options 1 and 2 need a cleanup path for the holder that dies mid-work.

**But before implementing any of them:** most bounded-concurrency requirements are
better served *locally*. A limit of "at most 20 concurrent calls to the payment
provider" is usually best expressed as a connection pool of 20 per instance
multiplied by instance count, with no distributed coordination at all. Reach for
a distributed semaphore only when the bound is genuinely global and the instance
count varies.

## Distributed rate limiting

The exact version coordinates on every request, which is expensive on the hot
path. Three designs, in increasing order of practicality.

**Centralised counter.** Every request increments a shared counter.

```text
  accurate, and every request pays a round trip.
  the counter is a bottleneck and a failure domain.
```

**Local buckets with a global budget.** Split the limit across instances:

```text
  global limit 1000/s, 10 instances → 100/s each

  + no coordination on the request path
  - unfair when traffic is unevenly distributed:
    one instance rejects at 100 while another sits at 20
  - the effective limit drops as instances become unbalanced
```

**Periodic redistribution — the practical answer.** Instances hold local budgets
and periodically report usage to a coordinator, which reallocates.

```text
  every second:
     instance reports "I used 95 of my 100"
     coordinator sees total 620 of 1000
     coordinator hands the busy instance 180 for the next window

  → coordination once per second, not per request
  → converges to fair sharing under uneven load
```

This is how production rate limiters are built. The accuracy is approximate at
window boundaries and exact enough over any meaningful period, and the
coordination cost is decoupled from request volume — which is the whole point.

**Choosing the algorithm** matters as much as the distribution:

```text
  FIXED WINDOW     simple; allows 2× the limit at a window boundary
                   (100 at 0:59, 100 at 1:00)
  SLIDING LOG      exact; stores a timestamp per request — expensive
  SLIDING WINDOW   weighted average of the last two windows.
                   ~exact, O(1) memory. the usual right answer.
  TOKEN BUCKET     allows bursts up to the bucket size, then a
                   steady rate. best when bursts are legitimate.
```

## Counting at scale

Exact distributed counting requires coordination on every increment, which
becomes the bottleneck for anything popular. The escapes:

**Sharded counters.** The key-splitting technique from the partitioning topic:

```text
  writes:  INCR counter:post-88:{random 0..15}
  reads:   SUM of all 16 shards

  → 16× the write throughput
  → reads are a bounded scatter-gather
```

**Approximate counting.** When you need the magnitude, not the number:

```text
  HyperLogLog     distinct count, ~2% error, ~12 KB for BILLIONS
                  of distinct items. mergeable across nodes.

  Count-Min       approximate frequency per key, fixed memory,
  Sketch          over-estimates only. the hot-key detector.

  Bloom filter    membership: "definitely not" or "probably yes"
```

The trade these make is worth internalising: **giving up exactness buys constant
memory and coordination-free merging.** A HyperLogLog computed on ten machines
can be merged into one answer with no coordination at all, because the union
operation is commutative and idempotent — a CRDT, in the language of the next
topic.

For a "unique visitors this month" figure, 2% error is invisible and the
alternative is storing every visitor id. This is almost always the right trade
for analytics, and almost never the right trade for anything billed.

## Idempotent registries and one-time work

A recurring pattern worth naming: guaranteeing a piece of work happens exactly
once, without a lock.

```sql
-- whoever inserts the row does the work; everyone else backs off
INSERT INTO job_runs (job_name, scheduled_for, node_id)
VALUES ('daily-report', '2026-09-02', :node_id)
ON CONFLICT (job_name, scheduled_for) DO NOTHING
RETURNING id;
-- a row returned → you own this run
-- no row         → someone else does
```

No lease, no renewal, no fencing, no coordination service — the unique constraint
provides mutual exclusion and the database provides durability. Add a `status`
column and a sweeper for runs that started and never finished, and this handles
the large majority of "only one instance should do X" requirements.

## What to take away

1. A barrier without a timeout is a distributed hang; decide explicitly what
   happens when a participant never arrives.
2. Implement semaphores with lease-backed entries so crashed holders release
   automatically — and check first whether a local connection pool would do.
3. Distributed rate limiting should coordinate periodically, not per request;
   instances hold local budgets that a coordinator redistributes each window.
4. Sliding-window counting is the usual right rate-limit algorithm; fixed windows
   allow 2× the limit at a boundary.
5. Shard hot counters, and use HyperLogLog or Count-Min when magnitude is enough —
   approximate structures merge without coordination.
6. `INSERT ... ON CONFLICT DO NOTHING` on (job, scheduled_time) handles most
   "exactly one instance" requirements with no lock at all.

Next: configuration and service discovery — the coordination that is about the
system itself.
