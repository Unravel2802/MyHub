---
title: Quorums
minutes: 18
summary: Why a majority is the magic number, and the variations that trade one property for another.
---

Every consensus protocol rests on a single geometric fact: **any two majorities
of a set must share at least one member.** That intersection is what carries
information from one decision to the next, and understanding it makes Raft and
Paxos feel inevitable rather than clever.

## The intersection property

```text
  5 nodes:  A  B  C  D  E

  majority = 3

  quorum 1: {A, B, C}
  quorum 2: {C, D, E}
                ▲
        they MUST overlap — there are only 5 nodes and
        3 + 3 = 6 > 5, so at least one is in both
```

Formally: two subsets of size ⌈(n+1)/2⌉ from a set of n cannot be disjoint,
because their sizes sum to more than n.

That shared node is the entire mechanism. If a value was accepted by a majority,
then **any future majority contains at least one node that knows about it** —
so a new leader that reads from a majority cannot miss a committed decision.

```text
  term 1: value X accepted by {A, B, C}
  A and B crash.
  term 2: new leader reads from a majority {C, D, E}
                                            ▲
                                   C knows about X.
                                   the new leader learns X and must honour it.
```

Without the intersection, a new leader could read from {D, E, ...} and see
nothing, then decide a different value — and two different values would have been
"agreed", which is exactly the agreement violation the protocol exists to
prevent.

## Why 2f + 1

To tolerate `f` failures you need `2f + 1` nodes:

```text
  n = 2f + 1
  quorum = f + 1

  worst case: f nodes are dead
  remaining:  f + 1 nodes  ← exactly a quorum. progress continues.

  and any two quorums of size f+1 from 2f+1 nodes intersect:
     (f+1) + (f+1) = 2f + 2 > 2f + 1   ✓
```

| Nodes | Quorum | Tolerates | Notes |
| --- | --- | --- | --- |
| 1 | 1 | 0 | Not fault tolerant |
| 2 | 2 | **0** | Worse than 1 — see below |
| 3 | 2 | 1 | Minimum useful cluster |
| 4 | 3 | **1** | Same tolerance as 3, more latency |
| 5 | 3 | 2 | The other common choice |
| 6 | 4 | **2** | Same tolerance as 5 |
| 7 | 4 | 3 | Rare; latency cost is real |

## Even numbers are strictly worse

The table's bolded rows make the point that catches people out:

```text
  4 nodes, quorum 3:  tolerates 1 failure   (3 remain = quorum ✓)
                      2 failures → 2 remain < 3 → STALLED

  3 nodes, quorum 2:  tolerates 1 failure   (2 remain = quorum ✓)

  → 4 nodes tolerate exactly as many failures as 3,
    while requiring one more acknowledgement per write.
```

Adding the fourth node made the system **slower with no gain in fault
tolerance**, and gave it one more machine that can fail. Always use an odd
number.

The two-node case is worse still. With 2 nodes and a quorum of 2, *either*
failure stalls the cluster — so a two-node cluster is less available than a
single node, because it has twice the surface area for the failure that stops it.
This is why "let's add a standby for safety" without changing the quorum rule
makes things worse.

## Split votes and why elections need randomness

The intersection property guarantees safety. It does not guarantee anyone wins an
election:

```text
  5 nodes, all time out simultaneously and become candidates

  A votes for A     B votes for B     C votes for C
  D votes for D     E votes for E

  nobody reaches 3 votes. the term ends with no leader.
  they time out again — simultaneously — and repeat.
```

This is the FLP liveness problem in miniature: safety intact, progress absent.
The fix is **randomised election timeouts**:

```text
  each node picks its timeout uniformly from, say, [150 ms, 300 ms]

  → one node almost always times out clearly first
  → it requests votes before the others have woken up
  → it wins before a competing candidate exists
```

Raft's paper recommends a randomisation range roughly an order of magnitude
larger than the broadcast time, so the first candidate has time to collect votes
before a second one starts. This is the same idea as jitter on retries, applied
to elections, and for the same reason — desynchronising actors that would
otherwise collide.

## Witness and observer nodes

Two useful variations that show up in real deployments.

**Witness (or arbiter) nodes** participate in voting but store no data:

```text
  DC-1              DC-2              DC-3 (cheap)
  ┌─────────┐       ┌─────────┐       ┌─────────┐
  │ full    │       │ full    │       │ WITNESS │
  │ replica │       │ replica │       │ vote only│
  └─────────┘       └─────────┘       └─────────┘

  → 3 voters, so a majority exists and either DC can fail
  → only 2 copies of the data to store and pay for
```

This solves the "we only have two data centres" problem cleanly: put a tiny
witness in a third location so a majority is always well-defined. MongoDB's
arbiters and Raft's non-voting configurations serve this purpose.

**Observer (or learner) nodes** receive the log but do not vote:

```text
  → they can serve reads
  → they do not slow down the write quorum
  → they can be added freely for read scaling or geographic locality
```

The distinction matters: **voters affect latency and fault tolerance; observers
affect neither.** Adding read capacity should always be observers, never voters.
This is also how new members are added safely — join as an observer, catch up on
the log, then promote to voter once current.

## Quorum variations

**Flexible Paxos** is a genuinely useful result (Howard et al., 2016): the
protocol only requires that the *leader election* quorum and the *replication*
quorum intersect — not that each is a majority.

```text
  5 nodes:  Q1 (election) = 4,   Q2 (replication) = 2
            4 + 2 = 6 > 5  ✓  they still intersect

  → writes need only 2 acknowledgements — faster steady state
  → elections need 4 — rarer, so paying more there is a good trade
```

Since elections are rare and writes are constant, shifting cost onto elections is
usually right. Several production systems exploit this.

**Grid quorums** arrange nodes in a grid, taking a full row for reads and a full
column for writes, so they intersect at one cell. Quorum sizes grow as √n rather
than n/2, which matters at large n but rarely at the 3–7 nodes of a practical
consensus group.

**Hierarchical quorums** compose majorities of majorities — a majority of data
centres, each contributing a majority of its nodes — to encode failure-domain
structure directly.

## Cross-region quorums and the latency floor

Once voters span regions, the quorum's latency is set by the geography:

```text
  voters in Virginia, Frankfurt, Singapore
  leader in Virginia

  Virginia   → itself       0 ms
  Frankfurt  → round trip  ~90 ms   ← quorum of 2 reached here
  Singapore  → round trip ~230 ms

  every write: ~90 ms, forever
```

Two mitigations worth knowing:

- **Place voters to shorten the second-fastest round trip.** Three regions on one
  continent give a far lower floor than three spread worldwide. Virginia/Ohio/
  Oregon is a very different latency profile from Virginia/Frankfurt/Singapore,
  with only slightly less independence.
- **Put the leader where the writes are**, since the leader's own vote is free.
  A leader in the region generating most writes removes one leg of the trip.

And the structural answer, again: partition, and run a separate small group per
partition with its leader placed near that partition's users.

## What to take away

1. Any two majorities intersect, and that shared member is what carries a
   committed decision forward into the next term — it is the whole mechanism.
2. Tolerating `f` failures needs `2f + 1` nodes and a quorum of `f + 1`.
3. Even cluster sizes tolerate the same number of failures as the odd size below
   them while costing an extra acknowledgement; a two-node cluster is less
   available than one node.
4. Quorums give safety, not liveness — randomised election timeouts are what
   prevent perpetual split votes.
5. Witness nodes vote without storing data (solving the two-data-centre problem);
   observers store without voting (read scaling, and safe member addition).
6. Flexible Paxos lets you shrink the replication quorum by growing the election
   quorum — a good trade, since elections are rare.

Next: Raft, which turns all of this into an algorithm designed to be understood.
