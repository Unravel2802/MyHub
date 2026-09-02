---
title: PACELC and the latency trade
minutes: 18
summary: The trade CAP omits — what consistency costs when the network is perfectly healthy.
---

CAP describes a rare event. Daniel Abadi's observation in 2010 was that the trade
engineers actually make every day is a different one, and CAP does not mention
it: even with a perfectly healthy network, stronger consistency costs latency.
PACELC adds that half, and it is the half that shapes most real designs.

## The formulation

```text
  if (P)  then choose  A or C      ← CAP's trade, during a partition
  else    then choose  L or C      ← the everyday trade, when healthy

  PAC / ELC
```

Read aloud: **if there is a Partition, trade Availability against Consistency;
Else, trade Latency against Consistency.**

The second clause is the useful addition. A partition might happen a few times a
year. The latency-versus-consistency trade is paid on **every single request**,
forever, and it is the one that determines what your p99 looks like.

## Why consistency costs latency with no partition

Nothing is broken; the cost is purely the coordination required.

```text
  EVENTUAL / LOCAL READ            LINEARIZABLE READ

  client ──▶ nearest replica       client ──▶ coordinator
         ◀── answer                            │
                                               ├──▶ replica 2
         1 ms                                  ├──▶ replica 3
                                               ◀── quorum agrees
                                        ◀───── answer

                                        1 ms + slowest quorum member
```

Within one data centre the difference is small — perhaps 1 ms versus 3 ms. Across
regions it is decisive:

```text
  replicas in Virginia, Frankfurt, Singapore
  a quorum write from Virginia waits for the 2nd-fastest:

     Virginia (0 ms) ─┐
     Frankfurt (45 ms)├─ quorum of 2 reached at ~90 ms round trip
     Singapore (115 ms)┘

  every write: ~90 ms floor. every read that must be linearizable: the same.
```

And the tail is worse than the mean, for the fan-out reason from the fundamentals
topic: a quorum's latency is an order statistic over several nodes, so the
cluster's tail latency becomes every operation's tail latency.

## Classifying real systems

PACELC gives each system a two-part label:

| System | P → | E → | Notes |
| --- | --- | --- | --- |
| Cassandra | A | L | Tunable per query; defaults favour A and L |
| DynamoDB | A | L | Strongly-consistent reads available, at 2× cost |
| Riak | A | L | The Dynamo lineage |
| MongoDB | C | C | Since 4.x defaults; tunable read/write concerns |
| Spanner | C | C | Pays commit-wait latency to keep C always |
| CockroachDB | C | C | Same philosophy |
| VoltDB | C | C | Single-partition transactions, in memory |
| PostgreSQL (single node) | n/a | C | No partition to tolerate |

The **PA/EL** systems (Cassandra, Dynamo, Riak) are consistent about their
philosophy: prioritise responsiveness always. The **PC/EC** systems (Spanner,
CockroachDB) are equally consistent in the other direction: correctness always,
pay the latency.

There is a rarer and interesting quadrant — **PC/EL**: strongly consistent when
healthy but sacrificing consistency rather than availability during a partition.
Some configurations of MongoDB and of Cosmos DB land here. It is coherent but
harder to reason about, because the guarantee changes depending on network
conditions you cannot observe from the application.

## The everyday version of the trade

Stripped of the acronym, the question at every read path is:

> **How stale is acceptable here, and what will you pay to reduce it?**

```text
  staleness      typical cost         suitable for
  ─────────      ────────────         ────────────
  0 (linearizable)  quorum round trip    balances, locks, uniqueness
  < 100 ms          leader read          "my own" data
  < 1 s             local replica        most reads
  < 1 min           cache with TTL       lists, catalogues, profiles
  < 1 hour          CDN / materialised   analytics, recommendations
  unbounded         batch-computed       reports, dashboards
```

Most reads sit in the middle three rows. The design skill is identifying the top
row's short list correctly and not paying its price for everything else.

## Tunable consistency in practice

Systems that expose the choice per operation let you make this concrete rather
than architectural. Cassandra is the clearest example:

```sql
-- fast, may be stale: one replica answers
SELECT * FROM events WHERE id = ? ;              -- CL = ONE

-- linearizable-ish: quorum read after quorum writes
CONSISTENCY QUORUM;
SELECT balance FROM accounts WHERE id = ? ;

-- true linearizability for a compare-and-set, via Paxos
UPDATE accounts SET balance = 50
  WHERE id = ? IF balance = 100;                 -- lightweight transaction
```

The important operational note: **the lightweight-transaction path is roughly 4×
the cost of a normal write**, because it runs a consensus round. That is the
latency price of the top row of the table, made visible. Systems that hide the
price do not remove it.

DynamoDB is similarly explicit: `ConsistentRead=true` costs twice the read
capacity units of an eventually consistent read. The pricing model is the trade,
expressed in money.

## Designing with the trade rather than against it

Three patterns that get most of the benefit of strong consistency without paying
for it everywhere.

**Write strongly, read weakly.** Writes go through a linearizable path so the
system's state is always correct; the overwhelming majority of reads come from
replicas or caches. Correctness lives in the write path where it is cheap to
enforce, and reads get local latency.

**Strong only where the invariant lives.** Reserve linearizable operations for
the specific fields that carry an invariant — a balance, a seat, a username — and
serve everything around them eventually. A user's profile page can be
eventually consistent while their account balance is not.

**Move the coordination out of the request path.** If a write must be strongly
ordered but the user does not need to wait for it, acknowledge locally and
coordinate asynchronously. The user sees 2 ms; the system reaches agreement in
90 ms in the background. This is what the transactional outbox does, and it works
whenever the user's next action does not depend on the coordinated result.

```text
  SYNCHRONOUS COORDINATION          DEFERRED COORDINATION

  request ──▶ quorum ──▶ ack        request ──▶ local write ──▶ ack
             90 ms                              2 ms
                                                  │
                                                  └─▶ quorum, async
```

The judgement is whether "acknowledged but not yet globally ordered" is a state
the product can tolerate. For a comment, yes. For a seat booking, no.

## What to take away

1. PACELC adds the trade CAP omits: with no partition, you still choose between
   latency and consistency — and that choice is paid on every request.
2. The cost is coordination, not failure: a quorum operation waits for the
   second-fastest replica, which across regions is bounded by the speed of light.
3. Systems classify as PA/EL (Cassandra, Dynamo) or PC/EC (Spanner, CockroachDB),
   and both are internally coherent philosophies.
4. The everyday question is "how stale is acceptable here, and what will you pay
   to reduce it" — and most reads belong in the middle of that table.
5. Cassandra's lightweight transactions and DynamoDB's consistent reads make the
   price explicit; systems that hide the price do not remove it.
6. Write strongly and read weakly, scope strong consistency to the fields
   carrying invariants, and move coordination off the request path where the user
   does not need to wait for it.

Next: putting it together — specifying and verifying the guarantees your own
system offers.
