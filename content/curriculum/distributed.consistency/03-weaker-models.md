---
title: The weaker models
minutes: 20
summary: Sequential, causal and the session guarantees — buying back specific properties without paying for linearizability.
---

Between linearizable and eventual there is a rich middle, and it is where most
well-designed systems actually sit. Each model buys back a specific property that
users notice, at a specific cost. Knowing them by name lets you specify what you
need instead of over-buying.

## Sequential consistency

> All operations appear in **some** total order, and each process's operations
> appear in that order in the order it issued them.

The difference from linearizability is one clause: there is **no real-time
requirement**. Everyone agrees on an order; that order need not match when things
actually happened.

```text
  LINEARIZABLE                       SEQUENTIAL
  ────────────                       ──────────
  A ├─write(1)─┤                     A ├─write(1)─┤
  B              ├─read─┤ MUST be 1  B              ├─read─┤ may be 0

  order must respect real time       any total order all agree on,
                                     as long as each process's own
                                     operations keep their order
```

Sequential consistency is what a CPU's memory model gives you within a machine,
and it is genuinely useful — everyone sees the same movie, just possibly delayed.
It is rarely offered as a distributed database's headline guarantee, because if
you are paying for a total order you may as well pay a little more for the
real-time clause.

## Causal consistency

> Operations that are **causally related** are seen by everyone in the same
> order. Concurrent operations may be seen in different orders.

This is the most important model in the middle, because it is exactly the
happens-before relation from the clocks topic, turned into a storage guarantee.

```text
  Alice: "Is the deploy done?"     ─┐ causally related
  Bob:   "Yes, ten minutes ago."   ─┘ (Bob read Alice's message first)

  causal consistency GUARANTEES nobody sees Bob's reply before Alice's
  question.

  Alice (London): "Coffee?"        ─┐ concurrent — no relationship
  Chen  (Tokyo):  "Deploying."     ─┘

  either order is fine, and no coordination is needed to decide.
```

The reason this matters so much: **causal consistency is the strongest model that
can be achieved while remaining available under a network partition.** That is a
theorem (Mahajan, Alvisi and Dahlin), and it makes causal consistency the natural
target for any system that must keep serving during a partition.

What it costs: tracking dependencies. Each write carries metadata saying what it
depended on — a vector clock, or a set of dependency identifiers — and a replica
holds a write until its dependencies have arrived. That metadata is the price,
and it is why fully causal stores are rarer in production than the theory
suggests: the bookkeeping grows with the number of participants and must be
garbage collected.

What it does *not* give you: any recency guarantee at all. A causally consistent
read may return arbitrarily old data, as long as it does not violate causality.
And it does not help with the constraint problems — two concurrent writes that
together break an invariant are still concurrent.

## The session guarantees

The practical middle ground, and where most real systems live. These are four
properties scoped to a single client session, and they are cheap because they
require no global coordination.

```text
  READ YOUR WRITES        you see your own writes
                          → sticky to leader, or a position token

  MONOTONIC READS         you never see time go backwards
                          → sticky routing to one replica

  MONOTONIC WRITES        your writes are applied in the order you issued
                          → route a session's writes through one path

  WRITES FOLLOW READS     if you read X and then write Y, everyone who
                          sees Y also sees X
                          → this is causality, per session
                            (a reply is never visible before its parent)
```

The insight worth carrying: **together, these four give the user an experience
almost indistinguishable from strong consistency, at a fraction of the cost.**
Users do not perceive global state; they perceive their own session. A system
that is eventually consistent globally but honours all four session guarantees
feels correct to the person using it.

That is why the practical recommendation for most products is not "pick
linearizable" or "pick eventual", but "be eventually consistent globally and
rigorously honour the session guarantees".

## Eventual consistency

> If writes stop, all replicas eventually converge to the same value.

Note what is absent: any statement about what you may read before convergence,
and any bound on how long convergence takes. As established in the first chapter,
this is a liveness promise with no safety content.

That does not make it useless — it makes it *insufficient on its own*. Eventual
consistency plus a defined conflict-resolution rule plus the session guarantees
is a real, usable contract. Eventual consistency alone is closer to a disclaimer.

Where it is genuinely right: DNS, view counters, like counts, presence, search
indexes, analytics, CDN content, recommendation caches. The common thread is that
being briefly wrong costs nothing anyone can measure.

## Two models worth knowing by name

**Read-committed and snapshot isolation** are *transaction isolation* levels
rather than consistency models, but they show up in the same conversations and
mixing them up causes real errors. The key point from the previous chapter
applies: snapshot isolation gives you a consistent *view*, but a stale one, and
it permits write skew:

```text
  invariant: at least one doctor must be on call

  T1: reads "Alice and Bob are on call"  → Alice takes herself off
  T2: reads "Alice and Bob are on call"  → Bob takes himself off

  both snapshots were consistent. both writes touched different rows.
  no conflict is detected. the invariant is now violated.
```

This is not a distributed-systems problem — it happens on a single Postgres node
at `REPEATABLE READ`. The fixes are `SERIALIZABLE` isolation, or materialising
the conflict by having both transactions write to a common row.

**Bounded staleness** — "you may be behind, but by at most 5 seconds or 100
versions" — is a genuinely useful commercial middle ground, offered by Cosmos DB
among others. It converts "eventual" from an unbounded promise into a number you
can reason about and put in an SLA, which is often exactly what a product needs.

## The full spectrum, with costs

| Model | Guarantees | Available under partition | Typical cost |
| --- | --- | --- | --- |
| Strict serializable | Real-time + multi-object | ❌ | Highest |
| Linearizable | Real-time, single object | ❌ | Quorum per operation |
| Sequential | Agreed total order | ❌ | Total order |
| **Causal** | Happens-before respected | ✅ | Dependency metadata |
| **Session guarantees** | Per-client sanity | ✅ | Routing discipline |
| Bounded staleness | Lag ≤ a stated bound | ⚠️ partial | Monitoring + fallback |
| Eventual | Convergence, someday | ✅ | Cheapest |

The two bolded rows are where most well-designed systems should be, and the
combination of the two — causal where relationships matter, session guarantees
everywhere — covers the overwhelming majority of what users notice.

## Choosing per operation

The mistake to avoid is picking one level for a whole system. Consistency is a
per-operation decision:

```text
  register a username        ──▶ linearizable (uniqueness)
  transfer money             ──▶ strict serializable
  update your own profile    ──▶ read-your-writes
  read someone's profile     ──▶ eventual
  post a comment             ──▶ causal (replies after parents)
  like count                 ──▶ eventual
  acquire a job lock         ──▶ linearizable + fencing token
  search results             ──▶ eventual, bounded staleness
```

A system that offers exactly one level either overcharges for the eventual cases
or under-delivers on the linearizable ones. The good ones let you ask per
request — DynamoDB's `ConsistentRead`, Cassandra's per-query consistency level,
Cosmos DB's five named levels — and the discipline is to use that expressiveness
rather than setting a global default and forgetting.

## What to take away

1. Sequential consistency drops linearizability's real-time clause: everyone
   agrees on an order, but it need not match when things happened.
2. Causal consistency orders causally related operations and is the strongest
   model that stays available under a partition — that is a theorem, and it makes
   it the natural target for partition-tolerant designs.
3. The four session guarantees — read-your-writes, monotonic reads, monotonic
   writes, writes-follow-reads — make a system *feel* strongly consistent to each
   user at a fraction of the cost.
4. Eventual consistency alone promises convergence with no bound and no statement
   about what you may read meanwhile; it needs a conflict rule and session
   guarantees to be a usable contract.
5. Snapshot isolation is neither serializable nor linearizable, and permits write
   skew on a single node.
6. Choose a level per operation, not per system, and use the per-request
   expressiveness your store offers.

Next: CAP — what the theorem actually says, and the three ways it is
misquoted.
