---
title: Linearizability
minutes: 21
summary: The strongest single-object guarantee, why it is not the same as serializability, and what it costs.
---

Linearizability is the guarantee that makes a distributed system behave like a
single machine. It is the strongest model on the spectrum, it is what people
usually mean by "strong consistency", and it is expensive in a way that is
bounded by physics rather than by engineering effort.

## The definition

> A system is **linearizable** if every operation appears to take effect
> **atomically at a single instant** between its invocation and its response,
> and that instant order is consistent with **real time**.

The real-time clause is what distinguishes it from weaker models. If operation A
completes before operation B begins — in wall-clock terms, as an outside observer
would see — then every observer must agree that A came first.

```text
  client 1:  ├─── write(x, 1) ───┤
  client 2:                          ├─── read(x) ───┤   MUST return 1
                                     ▲
                        begins after the write completed

  client 3:  ├───────── read(x) ─────────┤
             overlaps the write → MAY return 0 or 1, either is legal
```

Concurrent operations may be ordered either way. Non-overlapping ones may not.

## An illustrative violation

```text
  time ──────────────────────────────────────────────▶

  Alice  ├── read(score) ──┤ 1–0
                                          ├── read(score) ──┤ 2–0
  Bob                ├── read(score) ──┤ 1–0
                                                  ├── read ──┤ 1–0
                                                              ▲
                                                     NOT LINEARIZABLE

  Bob's later read returned an OLDER value than Alice's earlier read
  had already revealed. Bob learns the score went 2–0 and then
  un-went. Alice told him the score; his page disagrees.
```

The picture makes clear why this matters in products, not just in theory: the
moment two users can communicate outside the system, a non-linearizable system
produces observable nonsense.

## Where it is genuinely required

The list is shorter than instinct suggests, and each item has a reason.

**Uniqueness constraints.** Two concurrent registrations of the same username
must not both succeed. That requires a single point that sees both.

**Locks and leader election.** The entire purpose is that exactly one holder
exists. A non-linearizable lock is not a lock.

**Compare-and-set.** "Set to 5 only if it is currently 4" is meaningless if
"currently" is ambiguous.

**Cross-channel communication.** The canonical example: a user uploads an image,
the app enqueues a resize job, and the worker reads the image from a replica that
does not have it yet.

```text
  web ──▶ store image (leader)
      ──▶ enqueue "resize image 42"     ← a SECOND channel
                                  │
                                  ▼
                            worker ──▶ read image 42 from a replica
                                        ✗ not there yet → job fails
```

The queue is a communication channel outside the storage system, and it moved
faster than replication did. Any time information can travel by two paths, the
faster path can arrive first — and linearizability of the slower one is what
prevents it. (The cheaper alternative here is to put the image *in* the message,
or to have the worker read from the leader.)

**Ledgers and balances**, where an invariant like "never negative" must hold
across concurrent operations.

Notably absent: reading a profile, listing products, counting likes, showing a
feed. The overwhelming majority of reads in most products do not need this.

## Linearizability is not serializability

The most common confusion in the area, and they are genuinely different
properties.

```text
  LINEARIZABILITY               SERIALIZABILITY
  ───────────────               ───────────────
  about ONE object              about MULTIPLE objects
  single operations             whole transactions
  recency guarantee             isolation guarantee
  real-time ordering            SOME serial order, not necessarily
                                the real-time one
```

Serializability says a set of concurrent transactions produces the same result as
*some* serial execution. It does not say which one, and in particular it does not
require that order to match real time — a transaction that committed an hour ago
may be ordered after one that started now.

```text
  serializable but NOT linearizable:

    T1 commits at 10:00
    T2 begins at 10:01, and is serialized BEFORE T1

    valid serializability: the outcome equals T2-then-T1.
    invalid linearizability: T1 finished before T2 started.
```

Snapshot isolation is the case people meet in practice: it is not serializable
(it permits write skew) and not linearizable (a snapshot is by definition stale).
Postgres's `REPEATABLE READ` is snapshot isolation, and a long-running read
transaction sees a consistent view that is minutes old.

**Strict serializability** is both together — serializable *and* respecting real
time. Spanner offers it, and it is the strongest practical guarantee available;
this is what its commit-wait is buying.

## What it costs

**Every read must reach a quorum, or the leader.** You cannot serve a
linearizable read from an arbitrary replica, because that replica may be stale.
So the cheapest thing a replicated system does — serve a read locally — is off
the table.

Even a leader cannot answer from local state without care, because it may have
been deposed without knowing it. The standard fixes: a **read index** (confirm
with a quorum that you are still leader before answering) or a **leader lease**
(hold a time-bounded lease so you can answer locally until it expires, which
reintroduces a dependence on bounded clock skew).

**Every write costs a round trip to a quorum**, which for a geographically spread
system is bounded by the speed of light.

**Availability is lost under partition.** A minority partition cannot reach a
quorum, so it must refuse to serve — which is exactly the CAP result, covered
next.

**Latency is set by the slowest node in the quorum**, not the fastest, so tail
latency of the cluster becomes tail latency of every operation.

## Testing for it

You cannot prove linearizability by inspection, and the bugs are concurrency
bugs that appear rarely. The practical technique is **history checking**:

```text
  1. run many concurrent clients against the system
  2. record every operation's INVOCATION time, RESPONSE time and result
  3. inject faults — partitions, clock skew, process pauses, node kills
  4. search for a valid linearization of the recorded history
     → if none exists, you have a concrete counterexample
```

This is what Jepsen does, and its results are the reason a great many databases'
consistency claims were quietly corrected over the past decade. Two things are
worth taking from it:

- **Vendor claims are frequently wrong**, not through dishonesty but because
  these properties are hard and the failure modes only appear under fault
  injection.
- **The checking problem is NP-hard in general**, which is why checkers work on
  small histories with clever search. You do not need to implement one; you do
  need to know that "we tested it" without fault injection means very little.

## Reading the guarantee a system offers

Practical translation, because the marketing vocabulary is inconsistent:

| Claim | Usually means |
| --- | --- |
| "Strong consistency" | Linearizable, *for single-key operations* |
| "Strongly consistent reads" | This read goes to the leader or a quorum |
| "Serializable" | Transaction isolation; says nothing about recency |
| "Strict serializability" | Both — the strongest |
| "Read committed" | Weak isolation; not a recency guarantee at all |
| "Eventual consistency" | No recency guarantee whatsoever |
| "Causal consistency" | Causally related operations are ordered; concurrent ones are not |

The question that cuts through it: **"if I write and then, after receiving the
acknowledgement, read from a different connection, am I guaranteed to see my
write?"** A yes means something close to linearizable for that operation. A
qualified answer tells you exactly where the qualification is.

## What to take away

1. Linearizability means every operation appears atomic at an instant, and the
   order respects real time — if A completed before B began, everyone agrees A
   came first.
2. It is required for uniqueness, locks, compare-and-set, cross-channel
   communication and invariant-bearing balances — and by very little else.
3. It is not serializability: one is about single-object recency, the other about
   multi-object transaction isolation. Strict serializability is both.
4. It costs a quorum on every read and write, makes latency the slowest quorum
   member's, and forfeits availability in a minority partition.
5. Even a leader must confirm it is still leader — via a read index or a lease —
   before answering from local state.
6. Test by recording histories under fault injection and searching for a valid
   linearization; claims not tested that way mean little.

Next: the weaker models, and what each one buys back.
