---
title: When you need coordination
minutes: 18
summary: Coordination is the most expensive thing a distributed system does, and most requirements for it can be designed away.
---

Coordination — nodes agreeing before acting — is the operation that costs a
round trip, forfeits availability under partition, and cannot be made faster by
adding machines. Every design decision in this topic should therefore start with
the same question: can this requirement be removed instead of satisfied?

## The cost, stated plainly

```text
  UNCOORDINATED                     COORDINATED

  node acts on local state          node asks a quorum first
  ~microseconds                     ~milliseconds (or ~100 ms cross-region)
  available under partition         unavailable in a minority partition
  scales with node count            gets SLOWER with node count
```

That last line is the one that reframes things. Adding nodes to a coordinated
path makes it worse. So a system's scalability ceiling is usually set by however
much coordination sits on its hot path, and the highest-leverage architectural
work is removing coordination rather than optimising it.

## The CALM theorem

A genuinely useful result (Hellerstein and Alvaro): **a program has a
coordination-free distributed implementation if and only if it is monotonic.**

```text
  MONOTONIC       new information only ADDS to the conclusion;
                  nothing already concluded is retracted

    ✓ "has this set ever contained X?"       adding elements only
                                             makes more things true
    ✓ counting up
    ✓ "has any node reported an error?"

  NON-MONOTONIC   a later fact can INVALIDATE an earlier conclusion

    ✗ "is this set empty?"          one more element flips it
    ✗ "is X the maximum?"           a larger value flips it
    ✗ "is this username free?"      one more registration flips it
    ✗ any aggregate over a set that is still changing
```

The practical use is as a design lens. When you find yourself needing
coordination, look at what makes the operation non-monotonic — it is almost
always a *negative* question ("is it absent?", "is it still free?", "is nothing
else true?") — and ask whether the requirement can be restated positively.

```text
  non-monotonic:  "assign the next sequential invoice number"
                  requires knowing nobody else took it

  monotonic:      "assign a unique id"  (UUIDv7)
                  no coordination at all

  → if the sequential number is a legal requirement, keep the
    coordination. if it was for convenience, you just removed it.
```

## The four ways to avoid coordination

**1. Partition ownership.** Give each item exactly one owner, and route all
operations for it there. Within one owner it is a local operation with no
coordination at all.

```text
  every user_id maps to exactly one shard
  → all writes for that user are serialised locally
  → no distributed lock is needed to prevent concurrent modification
```

This is by far the most valuable technique in this list, and it is what
partitioning gives you as a side effect. Most "we need a distributed lock"
requirements are "we did not decide who owns this".

**2. Idempotence.** If executing twice is harmless, you no longer need to prevent
it. The lock existed to guarantee single execution; idempotence makes single
execution unnecessary.

**3. Commutativity.** If order does not matter, you do not need to agree on
order. `balance += 50` composes with concurrent changes; `balance = 150` does
not. This is the CRDT insight applied by hand, and it is available far more often
than people use it.

**4. Optimistic concurrency.** Do not coordinate before acting — act, and detect
the conflict at commit.

```sql
UPDATE orders SET status = 'shipped', version = version + 1
 WHERE id = 7 AND version = 3;
-- 0 rows means someone else got there first: re-read and retry
```

No lock is held, nothing blocks, and the database's own atomicity does the work.
Under low contention this is dramatically cheaper than locking, and it degrades
gracefully — under high contention retries rise, which is a signal rather than a
deadlock.

## When you genuinely need it

The list is short, and each item is a **negative** invariant — something that must
*not* happen:

```text
  □  exactly one leader / one holder of a resource
  □  a global uniqueness constraint
  □  a bounded resource (seats, inventory, a rate limit)
  □  an ordering that must be total, not just per entity
  □  a decision every participant must observe identically
     (configuration, schema version, cluster membership)
```

Everything else is usually a partitioning or idempotence problem wearing a lock's
clothing.

## Where the coordination lives

Three placements, with very different costs:

```text
  IN A DATABASE ROW              a unique constraint, a conditional
                                 update, SELECT ... FOR UPDATE
    + no new infrastructure      + transactional with your data
    - scoped to one database

  IN A CONSENSUS STORE           etcd, ZooKeeper, Consul
    + purpose-built, linearizable, leases and watches
    - a new critical dependency for everything that uses it

  IN A SINGLE-THREADED OWNER     one process/actor/partition owns the
                                 resource; all requests queue to it
    + no distributed algorithm at all
    - that owner is a bottleneck and a failure domain
```

**The first is under-used.** If the thing being protected already lives in a
database, a unique index or a conditional update is stronger, simpler and
transactional with the data — where a separate lock service is a second system
that can disagree with the first. Reach for etcd when the coordination is *about*
infrastructure (who is leader, what is the config, which nodes exist), not when it
is about a row you already have.

## The dependency you are taking on

A coordination service becomes a hard dependency of everything that uses it:

```text
  etcd unavailable
      ├─ no leader elections → failovers stall
      ├─ no lock acquisition → jobs cannot start
      ├─ no config reads     → new pods cannot boot
      └─ service discovery stale → routing degrades

  → an outage in a small cluster becomes an outage everywhere
```

Two mitigations that matter:

- **Cache aggressively and degrade to the cache.** A service that has already
  read the config should keep running on it when the store is unreachable, rather
  than failing. Coordination is needed to *change* state, not usually to continue
  operating on it.
- **Do not put coordination on the request path.** Acquire leadership once and
  hold it; read config on a watch and cache it. A design where every user request
  touches etcd has made etcd's latency and availability into the product's.

## The decision procedure

```text
  1. Can one owner be designated for this item?     ──▶ partition. done.
  2. Is executing twice harmful?
        no  ──▶ make it idempotent. done.
  3. Does the order matter?
        no  ──▶ make operations commutative. done.
  4. Is contention low?
        yes ──▶ optimistic concurrency. done.
  5. Is the resource already in a database?
        yes ──▶ unique constraint or conditional update. done.
  6. Otherwise                                      ──▶ consensus store.
```

Most requirements are answered before step 5, and each step avoided is a round
trip and a failure mode removed.

## What to take away

1. Coordination costs a round trip, forfeits availability under partition, and
   gets slower as the cluster grows — removing it is higher leverage than
   optimising it.
2. CALM: coordination-free implementation is possible exactly when the operation
   is monotonic; the requirement is usually a negative question in disguise.
3. Partition ownership, idempotence, commutativity and optimistic concurrency
   remove most coordination requirements.
4. Genuine needs are all negative invariants: one leader, uniqueness, a bounded
   resource, a total order, a decision everyone must see identically.
5. If the resource is already in a database, a unique constraint or conditional
   update beats a separate lock service, which is a second system that can
   disagree.
6. Keep coordination off the request path, and degrade to a cached value when the
   store is unreachable.

Next: locks and leases — the primitive, and the well-known argument about whether
a popular implementation of it is safe.
