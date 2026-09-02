---
title: Membership views
minutes: 18
summary: Strong versus weak membership, and the operations that cannot use the cheap one.
---

Gossip gives every node an eventually-consistent picture of who is in the
cluster. That is enough for routing and for load balancing, and it is *not*
enough for anything that depends on counting a majority. Knowing which operations
need which is the difference between a system that works and one that
occasionally has two leaders.

## Two kinds of view

```text
  WEAK / EVENTUAL MEMBERSHIP        STRONG / CONSISTENT MEMBERSHIP

  each node has its own view;       all nodes agree on an ordered
  they converge eventually          sequence of membership VIEWS

  gossip, SWIM                      consensus (Raft/Paxos) over a
                                    membership log

  cheap, scales to thousands        expensive, practical to ~tens
  available under partition         unavailable in a minority partition
  views may DISAGREE at any moment  views are identical and ordered

  → routing, load balancing,        → quorums, leader election,
    failure detection, service        sharding assignments, anything
    discovery                         that counts a majority
```

## Why quorums need the strong version

The failure that motivates all of this:

```text
  a 5-node cluster partitions 3 | 2

  side A's view: {1,2,3}      "we are 3 of 3 — a majority!"
  side B's view: {4,5}        "we are 2 of 2 — a majority!"

  both sides elect a leader. both accept writes.
  → SPLIT BRAIN
```

The bug is not in the quorum arithmetic — each side computed a majority
correctly. It is that they disagreed about **what the denominator was**. A quorum
is only meaningful relative to an agreed membership, so membership itself has to
be agreed before a quorum over it means anything.

Hence the design used by every serious system: **membership changes go through
consensus**, and the current view is a committed entry in the replicated log —
which is exactly what the Raft membership-change chapter described. Ordinary
liveness may be gossiped; *who is a voter* may not.

## Views and view changes

Strong membership is a sequence of numbered views:

```text
  view 1: {A, B, C}          quorum = 2
  view 2: {A, B, C, D}       quorum = 3    ← D added
  view 3: {A, C, D}          quorum = 2    ← B removed
```

Two rules make view changes safe, and both were established in the consensus
topic:

**Change one member at a time**, so consecutive views' majorities necessarily
overlap and two disjoint majorities cannot exist.

**Every message carries its view number.** A message from an older view is
rejected — the same fencing-token idea, applied to cluster membership. Without
it, a node that missed a view change acts on a stale denominator.

## Liveness is not membership

A distinction worth being precise about, because conflating them causes real
problems:

```text
  MEMBERSHIP   "is this node part of the cluster?"
               changes rarely, deliberately, via an operator or
               an autoscaler
               → needs strong agreement

  LIVENESS     "is this member currently reachable?"
               changes constantly, automatically
               → gossip is fine
```

```text
  member, alive      ──▶ serve traffic, count toward quorum
  member, unreachable──▶ still counts toward the DENOMINATOR;
                         just cannot vote right now
  not a member       ──▶ ignored entirely
```

The middle row is the important one. A temporarily unreachable node **does not
reduce the quorum size** — a 5-node cluster with 2 unreachable nodes still needs
3 votes, and correctly stalls if it cannot get them. A system that automatically
shrinks membership when nodes look dead has automated its own split brain: two
partitions each shrink to their own side and each becomes a "full" cluster.

**Automatic removal from membership is dangerous.** Automatic marking as
unreachable is fine and necessary. The distinction is worth enforcing in code,
because the convenient thing to build is the dangerous one.

## Joining a cluster

```text
  1. the new node is told a few SEED addresses (config, DNS, a
     cloud API — not gossip, since it knows nobody yet)
  2. it contacts a seed and learns the current view
  3. it is added as a NON-VOTING learner
  4. it catches up: state transfer, log replay, cache warm-up
  5. only when current is it PROMOTED to a voting member
```

Step 3 is the one that gets skipped, and skipping it degrades the cluster
immediately: a brand-new node counted as a voter raises the quorum size while
being unable to contribute, so every decision waits for a node with no data. Join
as a learner, promote when caught up.

**Seeds are a bootstrap dependency worth thinking about.** Hardcoded seed
addresses become stale; DNS-based seeds inherit DNS's caching problems; a cloud
API is another dependency at the worst moment. The usual answer is several seeds
of different kinds, and the requirement that a node only needs *one* of them to
reach the cluster.

## Leaving, and the two ways

```text
  GRACEFUL LEAVE                    CRASH

  announce intent                   silence
  transfer state / leadership       detected by the failure detector
  wait for acknowledgement          state must be re-replicated
  update the view                   the view is updated only after
  exit                              a deliberate decision
```

Graceful leave should be the normal path for a scale-down or a rolling restart,
and it is worth building even though crashes are the case you must handle: it
turns a routine operation from "trigger the failure path" into "hand over
cleanly", which removes the failover cost and the data-loss risk from every
planned change.

## Rejoining, and the amnesia problem

The most dangerous membership operation, and it was flagged in the consensus
topic:

```text
  a node that lost its persistent state must NOT rejoin under its
  old identity.

  it would:
    - vote again in a term it already voted in
    - claim to hold data it no longer has
    - be counted as an up-to-date replica when it is empty
```

```text
  rule: a node whose durable state is gone rejoins as a NEW MEMBER
        with a new identity, and the old one is removed.
```

The same rule covers the case from the leaderless-replication chapter: a node
that has been down longer than the tombstone grace period must be wiped and
rebuilt rather than restarted, or it resurrects deleted data.

Both are the same underlying principle — **a node's identity carries claims about
what it knows, so an identity must not outlive the knowledge.**

## Reconciling gossip with consensus

The standard architecture, restated because it is the practical conclusion:

```text
  ┌──────────────────────────────────────────────────────┐
  │  GOSSIP LAYER (SWIM)                                 │
  │    liveness, reachability, node metadata             │
  │    thousands of nodes, always available              │
  └────────────────────┬─────────────────────────────────┘
                       │  informs, does not decide
  ┌────────────────────▼─────────────────────────────────┐
  │  CONSENSUS LAYER (Raft)                              │
  │    the authoritative member list, shard assignments  │
  │    3–5 voters, strongly consistent                   │
  └──────────────────────────────────────────────────────┘
```

Gossip observes and reports; consensus decides. A node being gossiped as
unreachable is *evidence*; removing it from membership is a *decision*, and
decisions go through the log. Consul, Cassandra and most large systems are built
this way, and the separation is what keeps membership from being decided by
whichever nodes happened to see each other.

## What to take away

1. Weak membership converges eventually and is right for routing, discovery and
   failure detection; strong membership is ordered and agreed and is required for
   anything counting a majority.
2. Split brain from disagreed membership is not a quorum bug — both sides computed
   a majority correctly over different denominators.
3. Membership changes must go through consensus, one member at a time, with a view
   number on every message.
4. Liveness and membership are different: an unreachable member still counts in
   the denominator, and automatically shrinking membership automates split brain.
5. Join as a non-voting learner and promote when caught up, or a new node raises
   the quorum without being able to help.
6. A node that lost its durable state must rejoin as a new identity — identity
   carries claims about knowledge, and must not outlive it.

Next: the node lifecycle in operation, and the sequences that go wrong.
