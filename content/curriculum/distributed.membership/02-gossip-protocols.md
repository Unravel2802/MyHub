---
title: Gossip protocols
minutes: 19
summary: Spreading information epidemically, why it converges in log(n) rounds, and what it costs.
---

A cluster of a thousand nodes cannot have every node heartbeat every other node —
that is a million messages per interval. Gossip solves this by having each node
talk to a few random peers and letting information spread the way a rumour does:
exponentially, robustly, and with no coordinator.

## The mechanism

```text
  every T seconds, each node:
    1. picks k random peers (k is small — often 1 to 3)
    2. exchanges state with them
    3. merges what it learns

  that is the entire protocol.
```

The convergence property is the striking part:

```text
  round 0:  1 node knows
  round 1:  2 nodes know
  round 2:  4 nodes know
  round 3:  8 nodes know
  ...
  round r:  2^r nodes know

  → all n nodes know in O(log n) rounds
```

```text
  cluster size    rounds to converge
      10               ~4
     100               ~7
   1,000              ~10
  10,000              ~14
```

A ten-thousand-node cluster converges in roughly fourteen rounds. With a
one-second interval, that is fourteen seconds for information to reach everyone,
with each node sending a handful of messages per second regardless of cluster
size.

## Why it is robust

```text
  □  NO COORDINATOR      nothing to fail, no election, no leader
  □  NO SINGLE PATH      information reaches a node by many routes,
                         so losing links or nodes barely matters
  □  MESSAGE LOSS is FINE the next round tries different peers
  □  SCALES FLAT         per-node load is O(k), independent of n
  □  SELF-HEALING        a partitioned group reconverges automatically
```

That combination is unusual. Most distributed algorithms degrade sharply at the
edges; gossip degrades gracefully, which is why it is used for exactly the
information that must survive everything else being broken — membership.

## The three interaction styles

```text
  PUSH        "here is what I know"
              fast early (exponential), wasteful late
              (most recipients already know)

  PULL        "what do you know that I don't?"
              slow to start, very efficient at the end

  PUSH-PULL   exchange both ways
              best of both. what real implementations use.
```

The reason to know this: convergence is exponential in the *early* phase and
becomes a coupon-collector problem in the *late* phase, where the last few
uninformed nodes are hard to reach by pushing at random. Pull fixes the tail.

## Anti-entropy versus rumour-mongering

Two purposes, often combined:

```text
  ANTI-ENTROPY (state-based)
    exchange full state (or a digest), reconcile differences
    + eventually converges NO MATTER WHAT was missed
    - more data per exchange
    → the safety net

  RUMOUR-MONGERING (event-based)
    spread a specific update, stop after k rounds of hearing
    it is old news
    + very low overhead
    - an update can die out before reaching everyone
    → the fast path
```

Real systems run both: rumour-mongering propagates changes in seconds, and
periodic anti-entropy guarantees convergence for anything the rumours missed.
This is the same pairing as read repair plus Merkle-tree anti-entropy in the
leaderless replication chapter, and it is the same reasoning — a fast path that
usually works, plus a slow path that always does.

**Merkle trees** are what make anti-entropy affordable at scale, exactly as
before: compare hash trees top-down and transfer only the differing branches
rather than the whole state.

## SWIM

The protocol most modern membership systems are based on (Hashicorp's Serf and
Consul, and others). It combines the failure detection of the previous chapter
with gossip dissemination.

```text
  every protocol period, node A:

  1. picks a random node B, sends PING
       ├── ACK received  ──▶ B is alive. done.
       │
       └── no ACK ──▶ 2. INDIRECT PROBE
                        ask k random nodes to ping B on A's behalf
                          ├── any of them gets an ACK ──▶ B is alive
                          │                             (A's path was
                          │                              the problem)
                          └── none ──▶ 3. mark B SUSPECT
                                          and gossip that suspicion

  4. B, on hearing it is suspected, REFUTES with a higher
     incarnation number — and the refutation spreads

  5. if unrefuted after a timeout, B is declared DEAD
```

The three ideas that make SWIM good:

**Constant load per node.** Each node sends one ping plus occasional indirect
probes per period, regardless of cluster size. Traditional all-to-all heartbeating
is O(n) per node; SWIM is O(1).

**Indirect probing before suspicion**, which removes the single-observer false
positive as described in the previous chapter.

**Incarnation numbers for refutation.** Each node has a counter it increments
when it needs to refute a suspicion. Because the refutation carries a higher
number, it wins over the stale suspicion everywhere it reaches — a Lamport clock
applied to membership claims, so nodes cannot be wrongly evicted by an old rumour.

**Piggybacking** is the fourth: membership updates ride along on the ping and ack
messages rather than being sent separately, so dissemination is nearly free.

## What gossip is good for, and what it is not

```text
  GOOD FOR                          BAD FOR
  ────────                          ───────
  membership and liveness           anything needing a single decision
  configuration that tolerates      leader election requiring uniqueness
    brief divergence                distributed locks
  approximate aggregates            transactions
    (cluster size, load averages)   ordering guarantees
  replica anti-entropy
  failure detection
```

The line: **gossip gives eventual, probabilistic agreement.** It never gives you
"exactly one node holds this". Systems that need both run gossip for membership
and consensus for decisions — Cassandra gossips membership and uses Paxos for
lightweight transactions; Consul gossips with SWIM and uses Raft for the KV
store. That pairing is the standard architecture, and it is worth recognising:
**gossip for what everyone should eventually know, consensus for what everyone
must agree on now.**

## Configuration

```text
  interval        how often each node gossips
                  → convergence time ≈ interval × log(n)
                  → 200 ms–1 s typical

  fanout (k)      peers per round
                  → 3 is a common default; higher converges faster
                    and costs bandwidth linearly

  probe timeout   from the RTT distribution, per the previous chapter

  suspicion
  multiplier      how long to wait for a refutation
                  → scaled by log(n), because refutations take
                    longer to spread in a bigger cluster
```

That last line matters and is easy to get wrong: a suspicion timeout tuned for a
10-node cluster is too short for a 1,000-node one, because the refutation itself
needs more rounds to propagate. Implementations scale it automatically; hand-rolled
ones usually do not.

## The failure modes

**Partition creates two converged worlds.** Each side gossips internally and
converges on a view where the other side is dead. On healing, incarnation numbers
resolve the conflict — but any *action* taken on the wrong view during the
partition has already happened.

**Gossip storms.** A rapidly flapping node generates a stream of alive/suspect
updates that spread cluster-wide. Rate-limit membership changes per node, and
apply hysteresis to flapping.

**Slow convergence at very large scale.** Beyond tens of thousands of nodes,
log(n) rounds becomes noticeable. Hierarchical gossip — gossip within a rack,
then between racks — restores it.

**Clock-free but not order-free.** Gossip carries no ordering by itself, so
version or incarnation numbers are mandatory on every piece of state, or an old
value overwrites a new one on merge.

## What to take away

1. Each node gossiping with a few random peers converges in O(log n) rounds while
   keeping per-node load constant.
2. Push spreads fast early and pull finishes the tail; real systems use push-pull.
3. Pair rumour-mongering (fast, may die out) with periodic anti-entropy
   (guaranteed convergence) — the same fast-path/safety-net structure as read
   repair plus Merkle trees.
4. SWIM adds indirect probing before suspicion and incarnation numbers for
   refutation, so a node cannot be evicted by a stale rumour or one bad link.
5. Gossip gives eventual probabilistic agreement and never uniqueness — pair it
   with consensus for decisions that must be singular.
6. Suspicion timeouts must scale with log(n), and every gossiped value needs a
   version number or merges will regress it.

Next: what membership *means* — strong versus weak views, and the operations that
depend on the difference.
