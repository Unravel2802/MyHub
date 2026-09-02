---
title: Atomic commit across machines
minutes: 19
summary: Why "both or neither" stops being free the moment there are two systems.
---

A single-node transaction gives you atomicity for nothing: the database writes a
commit record, and either that record is on disk or it is not. There is one
decision point and one durable place to record it. Split the work across two
machines and you need them to agree on a single outcome — which is the consensus
problem, with all its costs, applied to every transaction.

## What atomicity means, precisely

```text
  ATOMIC COMMIT

  every participant either COMMITS or ABORTS,
  and they all make the SAME choice.

  not "usually the same". not "eventually the same".
  the SAME, or the invariant the transaction protects is broken.
```

This is different from the other ACID properties in an important way. Isolation
and consistency are about concurrent transactions; atomicity is about a single
transaction's outcome being all-or-nothing across everything it touched.

And it is *harder* than consensus in one respect: consensus needs a majority to
decide, while atomic commit needs **unanimity to commit**. Any single participant
voting no means abort. That asymmetry is what makes 2PC block, as the next
chapter shows.

## The single-node case, for contrast

```text
  BEGIN
    UPDATE accounts SET balance = balance - 50 WHERE id = 1;
    UPDATE accounts SET balance = balance + 50 WHERE id = 2;
  COMMIT
```

The database writes both changes to its write-ahead log, then writes a commit
record. Recovery on restart is mechanical:

```text
  WAL: [begin T7][update acct 1][update acct 2][COMMIT T7]
                                                    ▲
       commit record present → replay both updates

  WAL: [begin T7][update acct 1][update acct 2]
                                                ▲
       no commit record → undo both
```

One log, one record, one decision. **The existence of a single durable decision
point is what makes it easy**, and it is exactly what disappears when the work
spans machines.

## Where the requirement actually arises

Three distinct shapes, and they want different solutions:

**1. Across shards of one database.** A transfer between accounts on different
shards. The participants are homogeneous, trusted, and operated together — the
best case, and the one where 2PC (or a system with it built in) is appropriate.

**2. Across services.** Order service, payment service, inventory service. Each
owns its own data and deploys independently. This is where 2PC is usually the
*wrong* answer and sagas are right.

**3. Across a database and a message broker.** Write a row and publish an event.
This is the most common case of all, and it has its own clean answer — the outbox
— which is neither 2PC nor a saga.

Recognising which one you are in determines the whole design, and conflating them
is how teams end up running 2PC across HTTP services.

## The two-writes problem

The smallest version of the problem, and the one you meet weekly:

```text
  db.save(order)                    # ✓ committed
  # ← crash here
  queue.publish("order.created")    # ✗ never happened

  → the order exists and nothing downstream knows
```

Swapping the order does not help:

```text
  queue.publish("order.created")    # ✓ published
  # ← crash here
  db.save(order)                    # ✗ never happened

  → downstream processes an order that does not exist
```

There is **no ordering of two independent writes that is atomic.** This is worth
internalising as a hard fact, because a great deal of buggy code is written by
people trying to find the safe ordering. There isn't one. The only escapes are:

- Make them one write to one system (the outbox).
- Accept the gap and reconcile.
- Coordinate explicitly (2PC), and pay for it.

## Why 2PC is not the default answer

The instinct is to reach for a protocol that makes the two writes atomic. Before
doing so, price it:

```text
  latency        2 round trips minimum, plus fsync at each participant

  locks held     from prepare until commit — across a NETWORK round trip
                 → contention scales with participants and latency

  blocking       if the coordinator dies after prepare, participants
                 hold locks and CANNOT decide (next chapter)

  availability   the transaction needs EVERY participant up.
                 5 participants at 99.9% → 99.5% for the transaction
```

That last line is the killer for the cross-service case. A 2PC transaction spans
the availability of everything it touches, multiplied — so adding a participant
makes every transaction less likely to succeed. Sagas, by contrast, let each step
retry independently.

## The alternatives, and what each gives up

```text
  ┌──────────────────────────────────────────────────────────────┐
  │ 2PC          atomic, synchronous, blocking, all-up-required  │
  │              → across shards of one system                   │
  ├──────────────────────────────────────────────────────────────┤
  │ SAGA         eventually consistent, non-blocking,            │
  │              no isolation, needs compensations               │
  │              → across services                               │
  ├──────────────────────────────────────────────────────────────┤
  │ OUTBOX       atomic for (state change + event), at-least-once│
  │              delivery, needs idempotent consumers            │
  │              → database plus message broker                  │
  ├──────────────────────────────────────────────────────────────┤
  │ AVOID        put the data that must be atomic in ONE place   │
  │              → the best answer whenever it is available      │
  └──────────────────────────────────────────────────────────────┘
```

The last row deserves more weight than it usually gets. A great many distributed
transaction requirements are self-inflicted — a service boundary drawn between
two things that must change together. If `Order` and `OrderLine` are in different
services, someone drew the boundary wrong.

**The design heuristic: a transaction boundary is a strong hint about a service
boundary.** Things that must change atomically should live together. When you
find yourself designing a distributed transaction, first check whether you are
being told that two services should be one.

## Isolation, which quietly disappears

Atomicity gets the attention; isolation is what silently degrades.

```text
  saga step 1: reserve inventory   ✓ COMMITTED and VISIBLE
  saga step 2: charge card         ... in progress ...
  saga step 3: create shipment

  between steps, ANOTHER transaction can read the reserved inventory
  and make decisions based on a state that may be rolled back.
```

Single-node transactions hide intermediate states. Sagas cannot — each step
commits locally, so its effects are visible immediately. That produces three
anomalies with standard names:

```text
  LOST UPDATE     another transaction overwrites a saga's write
  DIRTY READ      another transaction reads a state that later
                  gets compensated away
  FUZZY READ      a saga reads a value twice and gets different
                  answers because someone else changed it mid-saga
```

The countermeasures (from Garcia-Molina and Salem's original saga work, and
elaborated since):

- **Semantic lock** — mark the record with a pending state (`status =
  'reserving'`) so other transactions know to wait or skip it.
- **Commutative updates** — design operations so order does not matter
  (`balance += x` rather than `balance = y`).
- **Re-read and verify** — before a consequential step, re-read the values the
  decision depended on.
- **By value** — route high-value transactions through 2PC and low-value ones
  through a saga. A $5 order and a $5M order can legitimately take different
  paths.

That last one is a genuinely good pattern and under-used: the correct isolation
level can be a function of the *stakes*, not just of the operation.

## What to take away

1. Atomic commit needs every participant to make the same decision, and unlike
   consensus it needs **unanimity to commit** — which is why it blocks.
2. A single-node transaction is easy because there is one durable decision point;
   distribution removes it.
3. There is no ordering of two independent writes that is atomic. The escapes are
   making them one write, accepting the gap and reconciling, or coordinating
   explicitly.
4. 2PC spans the availability of every participant multiplied together, which is
   why it is wrong across independently deployed services.
5. A transaction boundary is a strong hint about a service boundary — a
   distributed transaction requirement often means two services should be one.
6. Sagas give up isolation, not just atomicity; semantic locks, commutative
   updates and re-reads are the countermeasures, and routing by value is a
   legitimate design.

Next: two-phase commit in detail, and the blocking problem that defines it.
