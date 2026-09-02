---
title: The consensus problem
minutes: 21
summary: What agreement requires, why it is provably impossible, and how every real system gets it anyway.
---

Consensus is the problem of getting a group of nodes to agree on one value when
some of them may crash and the network may lose messages. It sounds narrow. It
is the foundation under every strongly consistent system you have met so far —
leader election, distributed locks, configuration, atomic commit and ordered logs
are all the same problem wearing different clothes — and it is provably
unsolvable in the general case.

## What agreement requires

A consensus protocol must satisfy three properties:

```text
  AGREEMENT     no two correct nodes decide different values
                → SAFETY. violating this corrupts the system.

  VALIDITY      the decided value was proposed by some node
                → SAFETY. rules out "always decide 0", which would
                  otherwise satisfy agreement trivially.

  TERMINATION   every correct node eventually decides
                → LIVENESS. violating this hangs the system.
```

The safety/liveness split from the consistency topic is doing real work here.
Agreement and validity forbid outcomes; termination promises progress. The
impossibility result below says you cannot guarantee all three at once — and
which one real systems give up is the single most important design fact in this
topic.

## Where it is needed

Recognising the shape matters more than the name, because consensus appears
under many labels:

```text
  LEADER ELECTION     agree on which node is leader
  DISTRIBUTED LOCK    agree on who holds it
  CONFIGURATION       agree on the current cluster membership or settings
  ATOMIC COMMIT       agree on whether a transaction commits
  ORDERED LOG         agree on the sequence of entries
                      ← this one is the most useful framing
```

The last is the important reframing. **Agreeing on an ordered log gives you
everything else**: to elect a leader, append "node A is leader for term 5" and
whoever's entry commits first wins; to acquire a lock, append "A holds L until
T"; to change configuration, append the new configuration. This is why real
systems (Raft, Multi-Paxos, ZooKeeper's Zab) implement *replicated log*
consensus rather than one-shot agreement — one mechanism, all the use cases.

And it connects back to earlier topics: a replicated log that every node applies
in order, to a deterministic state machine, gives every node the same state.
That is **state machine replication**, and it is how a linearizable distributed
database is built.

```text
  clients ──▶ ┌──────────────────────────────────────┐
              │  CONSENSUS: agree on the log order   │
              │  [set x=1][set y=2][del x][set y=5]  │
              └──────────────┬───────────────────────┘
                             │ every node applies the SAME entries
                             │ in the SAME order
             ┌───────────────┼───────────────┐
             ▼               ▼               ▼
        ┌─────────┐    ┌─────────┐     ┌─────────┐
        │ state   │    │ state   │     │ state   │   identical,
        │ machine │    │ machine │     │ machine │   because the
        └─────────┘    └─────────┘     └─────────┘   input was
```

The state machine must be **deterministic** — no `now()`, no `random()`, no
map-iteration order dependence. Non-determinism in the state machine silently
diverges replicas that agreed perfectly on the log, and it is a genuinely nasty
bug because consensus reports success throughout.

## The FLP impossibility result

Fischer, Lynch and Paterson, 1985 — one of the most important results in the
field:

> In an **asynchronous** system where even **one** process may fail by crashing,
> there is no **deterministic** protocol that solves consensus.

Every word is load-bearing:

**Asynchronous** — no bound on message delay or processing time. This is the
hard part. Without a bound, you can never distinguish "crashed" from "slow", and
that is the whole difficulty.

**One crash failure** — not Byzantine, not many. Even the mildest failure model
breaks it.

**Deterministic** — randomised protocols escape (see below).

**Solves consensus** — meaning all three properties, always. In particular
termination is the one that fails.

The intuition for the proof: there must exist a *bivalent* configuration — one
from which both outcomes are still reachable. The proof shows an adversarial
scheduler can always delay exactly the right message to keep the system in a
bivalent state, forever. It never *violates* agreement; it just prevents
deciding.

```text
  configuration where both 0 and 1 are still possible
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   deliver msg A           deliver msg B
   → still bivalent        → still bivalent
        │                       │
        └───────────┬───────────┘
                    ▼
             the scheduler can always find such a step.
             no decision is ever forced.
```

## How real systems escape it

FLP does not say consensus is impossible in practice. It says no protocol
guarantees termination in a fully asynchronous model. Four escapes, and real
systems use the first:

**1. Partial synchrony (the practical one).** Assume the network is *eventually*
well-behaved: after some unknown point, message delays are bounded. Then:

```text
  SAFETY      guaranteed ALWAYS — even during total asynchrony
  LIVENESS    guaranteed only during periods of synchrony
```

That asymmetry is the design principle of every production consensus system.
Raft, Paxos, Zab and Viewstamped Replication all **never violate agreement**, no
matter how badly the network behaves; they simply stop making progress until it
recovers. A Raft cluster in a bad partition does not corrupt data — it stalls.

Timeouts are the mechanism: a failure detector built from a timeout is what
converts an asynchronous system into an eventually-synchronous one, and its
inaccuracy costs liveness (spurious elections) rather than safety.

**2. Randomisation.** Ben-Or's algorithm and modern Byzantine protocols use
coin flips to escape bivalence, terminating with probability 1. Termination is
probabilistic rather than guaranteed, which sidesteps FLP's determinism clause.

**3. Failure detectors.** Chandra and Toueg showed consensus is solvable with a
`◇S` failure detector — one that eventually stops suspecting correct processes.
This is the theoretical formalisation of "use timeouts".

**4. Weaken the problem.** Do not require agreement on a total order at all.
CRDTs and eventual consistency take this route, which is why they remain
available during partitions.

## Crash faults versus Byzantine faults

Two failure models, with very different costs:

```text
  CRASH-STOP (fail-stop)
    a node stops. it does not send wrong messages.
    → tolerate f failures with 2f + 1 nodes

  BYZANTINE
    a node may send arbitrary, contradictory, malicious messages.
    → tolerate f failures with 3f + 1 nodes, and message signing
```

| Tolerate | Crash-fault nodes | Byzantine nodes |
| --- | --- | --- |
| 1 failure | 3 | 4 |
| 2 failures | 5 | 7 |
| 3 failures | 7 | 10 |

Byzantine tolerance also costs far more messages — PBFT is O(n²) per decision
versus Raft's O(n) — which is why it is confined to settings where participants
genuinely do not trust each other: blockchains, and some financial
infrastructure.

**Inside your own data centre, crash-fault tolerance is the right model.** Your
nodes are not adversaries. The failure to worry about is a node crashing,
pausing, or being partitioned — not one lying about what it saw. Choosing
Byzantine tolerance for an internal system buys you a large cost against a threat
you do not have.

One caveat worth knowing: crash-fault protocols assume **stable storage survives
a crash**. A node that loses its persistent state and rejoins with amnesia can
violate safety — it may vote twice for different values in the same term.
Real implementations therefore `fsync` their term and vote before responding,
and losing a node's disk means rebuilding it with a fresh identity, not
restarting it with the old one.

## Why agreement is expensive

The cost is structural, not implementational:

```text
  every decision requires a MAJORITY to acknowledge

  → at least one round trip to the median-latency node
  → the SLOWEST member of the quorum sets the latency
  → throughput is bounded by the leader, which must talk to everyone
  → adding nodes makes it SLOWER, not faster
```

That last line surprises people. A 3-node Raft cluster is faster than a 7-node
one: the leader sends more messages and waits for a larger quorum. More nodes
buys fault tolerance, not throughput or speed.

```text
  cluster size  tolerates  quorum  relative write latency
      3             1         2          fastest
      5             2         3          slower
      7             3         4          slower still
```

This is why the standard advice is **3 or 5 nodes**, and why 7 is unusual. It is
also why systems that need to scale put consensus underneath a *partitioned*
layer — each partition runs its own small Raft group — rather than running one
enormous consensus group. CockroachDB, Spanner and TiKV all do this: thousands
of independent 3-node or 5-node Raft groups, not one 1,000-node group.

## What to take away

1. Consensus requires agreement and validity (safety) plus termination
   (liveness); the useful form is agreeing on an ordered log, which yields leader
   election, locks, configuration and atomic commit.
2. State machine replication needs the state machine to be deterministic — `now()`
   or `random()` inside it diverges replicas that agreed perfectly.
3. FLP proves no deterministic protocol guarantees consensus in a fully
   asynchronous system with even one crash failure.
4. Real systems escape via partial synchrony and give up *liveness*, never
   safety: a Raft cluster in a bad partition stalls rather than corrupts.
5. Crash faults need 2f+1 nodes, Byzantine faults 3f+1 plus O(n²) messages —
   inside your own data centre, crash-fault tolerance is the right model.
6. Consensus gets slower as the cluster grows; use 3 or 5 nodes and scale by
   running many independent groups.

Next: quorums — the one piece of arithmetic that makes all of this work.
