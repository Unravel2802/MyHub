---
title: Paxos and the family
minutes: 21
summary: The original algorithm, why it has its reputation, and what the variants actually buy.
---

Paxos is the algorithm every consensus system is measured against, the one with a
reputation for being incomprehensible, and the one running underneath more
infrastructure than any other. Its core is genuinely simple — two phases and one
rule. What is hard is everything between the algorithm and a working system,
which is precisely what Raft set out to address.

## Single-decree Paxos

The base algorithm agrees on **one** value. Three roles, usually all played by the
same processes:

```text
  PROPOSER   suggests values
  ACCEPTOR   votes; a majority of acceptors decides
  LEARNER    finds out what was decided
```

Every proposal carries a globally unique, increasing **proposal number** —
typically `(counter, node_id)` so two nodes never generate the same one. That
number is a Lamport-style logical clock, and it is what orders competing
proposals.

### Phase 1: Prepare

```text
  proposer ──▶ "PREPARE n"  ──▶ acceptors

  each acceptor:
     if n > any prepare it has seen:
        - PROMISE never to accept a proposal numbered < n
        - reply with the highest-numbered proposal it has ALREADY
          accepted, if any
     else:
        - ignore (or reply with a rejection)
```

### Phase 2: Accept

```text
  proposer, on hearing from a MAJORITY:

     if any acceptor reported a previously accepted value:
        ──▶ it MUST propose the value with the HIGHEST proposal number
            among those reported.       ← the whole safety rule
     else:
        ──▶ it may propose its own value.

  proposer ──▶ "ACCEPT n, v" ──▶ acceptors

  each acceptor accepts unless it has promised to a higher number.
  a majority accepting means v is CHOSEN.
```

**That single "must propose the highest reported value" rule is the entire safety
argument.** If a value was already chosen, it was accepted by a majority; any
later Phase 1 talks to a majority; the two majorities intersect; so the proposer
learns about it and is forced to re-propose it. Once a value is chosen, no
different value can ever be chosen.

```text
  proposer A         acceptors 1  2  3         proposer B
     │                                             │
     ├── PREPARE 5 ──────▶ ✓  ✓  ✓                 │
     ◀── promise, nothing accepted ──              │
     ├── ACCEPT 5,"x" ───▶ ✓  ✓                    │  (3 is slow)
     │      "x" is now CHOSEN (majority)           │
     │                                             │
     │                     ◀────────  PREPARE 9 ───┤
     │        acceptor 1: "I accepted (5,'x')"     │
     │        acceptor 3: "nothing"                │
     │                                             │
     │        B MUST now propose "x", not its own value.
     │                     ◀──── ACCEPT 9,"x" ─────┤
```

Note what Paxos does *not* do: it never overwrites, and it has no leader in the
base algorithm. Any proposer may act at any time, and safety holds regardless.

## Why it has its reputation

Two reasons, and they are different.

**Liveness is genuinely fragile.** Two proposers can livelock indefinitely:

```text
  A: PREPARE 1  → promised
  B: PREPARE 2  → promised (A's ACCEPT 1 now rejected)
  A: PREPARE 3  → promised (B's ACCEPT 2 now rejected)
  B: PREPARE 4  → ...

  safety never violated. progress never made.
```

This is FLP in concrete form. The fix is to elect a distinguished proposer — at
which point you have a leader, and you have arrived at Multi-Paxos.

**The gap between paper and system is enormous.** The paper describes agreement
on one value. A real system needs a *sequence* of decisions, leader election, log
compaction, membership changes, batching, pipelining and recovery. None of that
is specified, and Google's engineers wrote a famous paper about it —
*Paxos Made Live* — reporting that turning the algorithm into working code
required substantial invention, and that their implementation contained bugs
found only by aggressive fault injection.

That gap is the honest reason Raft exists. Raft is not a better algorithm; it is
a **fully specified system** with the surrounding parts included in the paper,
so two independent implementations behave the same way.

## Multi-Paxos

Running full Paxos per log entry means two round trips per decision. Multi-Paxos
observes that Phase 1 is about *leadership*, not about the value:

```text
  SINGLE-DECREE, per entry            MULTI-PAXOS
  ────────────────────────            ───────────
  PREPARE  → 1 round trip             (once, at leader election)
  ACCEPT   → 1 round trip             ACCEPT → 1 round trip per entry

  2 RTT per decision                  1 RTT per decision, steady state
```

Run Phase 1 once for a whole *range* of future log positions, and then a stable
leader only runs Phase 2 per entry. Phase 1 recurs only when leadership changes.

At this point Multi-Paxos and Raft are structurally the same thing: a stable
leader, one round trip per entry, re-establishment on failure. The differences
are in specification and in the constraints Raft adds — Raft forbids log gaps and
requires the leader's log to be authoritative, where Paxos permits gaps and any
node to fill them.

| | Multi-Paxos | Raft |
| --- | --- | --- |
| Steady-state round trips | 1 | 1 |
| Log gaps | permitted | forbidden |
| Leader's log | not necessarily authoritative | always authoritative |
| Any node may propose | yes | no, leader only |
| Fully specified in the paper | no | yes |
| Understandability | poor | the explicit design goal |

## The variants worth knowing

**Fast Paxos.** Lets clients send directly to acceptors, skipping the leader —
one round trip instead of two in the best case. The cost is a larger quorum
(roughly 3n/4) and a slower recovery path when two clients collide. Good when
conflicts are rare.

**EPaxos (Egalitarian Paxos).** No leader at all. Commands that do not *interfere*
— they touch different keys — commit in one round trip, in parallel, at whichever
replica the client contacted. Interfering commands need dependency tracking and a
second round.

```text
  set x=1  and  set y=2   → independent, both commit in 1 RTT
  set x=1  and  set x=2   → interfering, ordered explicitly

  → no leader bottleneck, and clients talk to their nearest replica
  → the win is largest in geo-distributed deployments
```

The idea is elegant and the implementations are complex; it is influential more
than widely deployed.

**Flexible Paxos.** Covered in the quorum chapter: only the election and
replication quorums must intersect, not each being a majority. Lets you shrink
the write quorum by growing the election quorum.

**Zab** (ZooKeeper Atomic Broadcast) and **Viewstamped Replication** are
leader-based protocols in the same family. VR actually predates Paxos's
publication in a practical sense, and is closer in spirit to Raft.

## Byzantine protocols

When nodes may lie rather than merely crash:

**PBFT** (1999) — three phases, `3f + 1` nodes, O(n²) messages per decision. The
first practical Byzantine protocol.

**Modern BFT** — HotStuff (used by several blockchain systems) achieves linear
message complexity with a leader rotation, and Tendermint is widely deployed.

**Nakamoto consensus** (Bitcoin) is a different animal: probabilistic rather than
final, with agreement becoming exponentially more likely as blocks accumulate
rather than being decided at an instant. It tolerates a much larger and unknown
participant set at the cost of finality and throughput.

Restating the point from the first chapter: **for systems inside your own trust
boundary, Byzantine tolerance is a large cost against a threat you do not have.**

## Which to use

For essentially all application work, the answer is: **do not implement
consensus.** Use a library or a service that has been tested by more people than
you can afford.

```text
  need a consensus SERVICE      etcd, ZooKeeper, Consul
    (config, locks, leader election, service discovery)

  need consensus INSIDE your system    a Raft library
    (Rust: openraft · Go: hashicorp/raft, dragonboat
     Java: Apache Ratis · C++: braft)

  need a database with it built in    CockroachDB, TiDB, YugabyteDB,
                                      Spanner, FoundationDB

  need Byzantine tolerance      you are building a blockchain, and
                                that is a different discipline
```

The reason to be blunt about this: consensus implementations fail in ways that
appear only under specific interleavings of crashes, partitions and clock skew.
The bugs are not found by unit tests or by staging traffic. They are found by
formal verification and by aggressive fault injection over long runs, and both
etcd and the major Raft libraries have had years of that. A homegrown
implementation has had none, and its bugs will surface as data loss during your
first real incident.

If you do implement one, the minimum bar: model-check the protocol (TLA+ is what
the Raft and Paxos authors used), and run a Jepsen-style history checker under
injected partitions, clock skew and SIGSTOP pauses.

## What to take away

1. Paxos's safety rests on one rule: a proposer that learns of a previously
   accepted value must re-propose the highest-numbered one, which quorum
   intersection guarantees it will learn about.
2. Its liveness is fragile — duelling proposers livelock — and the fix is a
   distinguished leader, which is Multi-Paxos.
3. Multi-Paxos runs Phase 1 once per leadership term, giving one round trip per
   entry — structurally the same as Raft.
4. Raft's contribution is specification, not speed: the paper covers the whole
   system, so implementations agree.
5. EPaxos removes the leader bottleneck for non-interfering commands; Fast Paxos
   trades a larger quorum for a shorter path.
6. Do not implement consensus. Use etcd, ZooKeeper, a mature Raft library, or a
   database with it built in — the bugs only appear under fault injection nobody
   runs on homegrown code.

Next: what you build on top of consensus, and what it costs to operate.
