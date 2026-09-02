---
title: Raft — election and log replication
minutes: 23
summary: The algorithm designed to be understandable, and the two mechanisms it is built from.
---

Raft was published in 2014 with an unusual stated goal: not to be faster or more
general than Paxos, but to be **understandable**. That goal shaped the design —
it decomposes consensus into three nearly independent pieces and adds constraints
that reduce the number of states you must reason about. It worked. Raft is now
the default choice for new systems, and it is the one worth learning first.

## Three roles and one term counter

Every node is in exactly one of three states:

```text
                    times out,
                    starts election
     ┌──────────┐  ─────────────▶  ┌───────────┐
     │ FOLLOWER │                  │ CANDIDATE │
     └──────────┘  ◀─────────────  └───────────┘
          ▲         discovers a           │
          │         current leader        │ wins majority
          │         or a higher term      ▼
          │                          ┌────────┐
          └──────────────────────────│ LEADER │
             discovers a higher term └────────┘
```

**Terms** are a logical clock — an integer that increases with each election
attempt.

```text
  term 1        term 2        term 3        term 4
  ├──────────┤  ├──┤          ├──────────┤  ├──────────────┤
   election      split          election       election
   + normal      vote,          + normal       + normal
   operation     no leader      operation      operation
```

Every message carries a term. The rule that makes everything else work:

> **If a node receives a message with a term higher than its own, it updates its
> term and immediately becomes a follower.**

A leader that has been superseded discovers it the instant it hears from anyone
in a newer term, and steps down without needing to be told. This single rule
removes an enormous amount of the state space that makes Paxos hard to reason
about.

## Leader election

A follower that hears nothing from a leader for its **election timeout** —
randomised in [150 ms, 300 ms] in the paper — assumes the leader is gone:

```text
  1. increment currentTerm
  2. become CANDIDATE, vote for yourself
  3. send RequestVote to everyone in parallel
  4. one of three things happens:
       a) majority of votes  → become LEADER, send heartbeats immediately
       b) hear from a leader in a term >= yours → become FOLLOWER
       c) timeout with no majority → increment term, try again
```

The voting rule is one vote per node per term, **persisted to disk before
replying**. That `fsync` is not optional: a node that votes, crashes, restarts
without the record, and votes again for a different candidate in the same term
can produce two leaders. This is the amnesia problem from the previous chapter,
and it is the most commonly botched part of a homegrown implementation.

Case (c) is the split vote from the quorum chapter, and randomised timeouts make
it rare and self-correcting.

## Log replication

Once elected, the leader is the sole entry point for writes.

```text
  client ──▶ LEADER
               │  1. append to own log (uncommitted)
               │
               ├──▶ follower 1  AppendEntries
               ├──▶ follower 2  AppendEntries
               ├──▶ follower 3  AppendEntries
               │
               │  2. majority acknowledges → entry is COMMITTED
               │  3. apply to own state machine
               ◀──  4. reply to client
                     5. tell followers the new commit index
                        (piggybacked on the next AppendEntries)
```

A log entry holds a command and the term in which it was created:

```text
  index:   1      2      3      4      5      6
         ┌────┬──────┬──────┬──────┬──────┬──────┐
  leader │x=1 │ y=2  │ x=3  │ z=9  │ y=7  │ x=0  │
         │ t1 │  t1  │  t2  │  t2  │  t3  │  t3  │
         └────┴──────┴──────┴──────┴──────┴──────┘
                              ▲             ▲
                       commitIndex=4    latest, uncommitted
```

**Committed** means "replicated on a majority, and therefore durable" — it will
survive any tolerable set of failures and can never be removed. Only committed
entries are applied to the state machine and acknowledged to the client.

## The Log Matching Property

This is the invariant that makes Raft's logs stay consistent, and it is enforced
by a single consistency check on every `AppendEntries`.

> **If two logs contain an entry with the same index and term, then the logs are
> identical in all entries up to that index.**

The mechanism: each `AppendEntries` carries `prevLogIndex` and `prevLogTerm`, and
the follower **rejects** the request unless its own log matches at that position.

```text
  leader sends:  prevLogIndex=4, prevLogTerm=2, entries=[y=7 @ t3]

  follower's log:  [x=1@1][y=2@1][x=3@2][z=9@2]
                                            ▲
                     index 4, term 2 — MATCHES → accept

  another follower: [x=1@1][y=2@1][x=3@2]
                                     ▲
                     index 3 is its last — no entry at 4 → REJECT
```

On rejection, the leader decrements `nextIndex` for that follower and retries,
walking backwards until it finds the last point of agreement, then overwrites
everything after it.

```text
  leader:    [1@1][2@1][3@2][4@2][5@3]
  follower:  [1@1][2@1][3@2][4'@2][5'@2]     ← divergent from index 4
                              ▲
  walk back to index 3 (agreed), then overwrite 4 and 5 with the
  leader's entries.
```

**The leader never modifies its own log** — it only appends, and forces followers
to match. That asymmetry ("strong leader") is a deliberate simplification versus
Paxos, where any node may propose and logs can have gaps.

Naive backwards walking is O(n) round trips for a badly divergent follower, so
real implementations have the follower return the *first index of the conflicting
term*, letting the leader skip a whole term per round trip.

## Where the client fits

Two details that matter for correctness of the system as a whole:

**Followers redirect.** A client that contacts a follower is told who the leader
is (or told to retry), so clients discover leadership changes without external
coordination.

**Commands must be idempotent, or deduplicated.** A client that times out and
retries may have had its first attempt committed:

```text
  client sends "transfer $50"
  leader commits it
  leader crashes BEFORE replying
  client retries against the new leader
  → committed twice
```

Raft's answer is a per-client session with a serial number: the state machine
records the last serial applied per client and returns the cached response for a
repeat. This is the idempotency key pattern from the fundamentals topic, applied
inside the replicated state machine — and it is a required part of a correct
system, not an optional extra.

## Read handling

Reads are the part most naive implementations get wrong. Serving a read from the
leader's local state is *not* safe:

```text
  leader is partitioned but does not know it yet.
  the other side elected a new leader and committed writes.
  the old leader answers a read from its stale local state.
  → a linearizability violation
```

Three correct approaches:

```text
  1. LOG THE READ       put the read in the log like a write.
                        correct, simple, and expensive.

  2. READ INDEX         record commitIndex, exchange heartbeats with a
                        quorum to confirm you are still leader, wait for
                        the state machine to reach that index, then read.
                        one round trip, no log entry.

  3. LEASE READ         hold a time-bounded leadership lease; while it is
                        valid, read locally with no communication.
                        fastest, and depends on bounded clock skew —
                        the assumption from the clocks topic.
```

Most production systems use (2) by default and offer (3) as an option with the
clock-skew caveat documented. If a system offers "fast local reads" from a
leader, that is a lease read, and its safety rests on your clocks.

**Follower reads** are possible too: a follower asks the leader for the current
commit index, waits until it has applied that far, then serves. This trades a
round trip to the leader for the ability to serve from a nearby replica — worth
it across regions.

## Persistence requirements

Three pieces of state must survive a crash, and must be flushed **before**
responding to any RPC:

```text
  currentTerm   or a node can vote twice in one term
  votedFor      same
  log[]         or committed entries can vanish
```

Everything else — `commitIndex`, `lastApplied`, and the leader's per-follower
indices — is safely reconstructed on restart.

The performance consequence is real: a `fsync` per write is expensive, and it is
why consensus systems batch aggressively. A leader that receives 1,000 concurrent
writes appends them all and issues one `fsync` and one round of `AppendEntries`,
amortising both. This is also why consensus throughput improves dramatically
under load — batching gets better — while latency does not.

## What to take away

1. Raft's three roles plus a term counter, and the rule that any higher term
   forces a step-down, remove most of the state space that makes Paxos hard.
2. Randomised election timeouts make split votes rare; one vote per term must be
   `fsync`ed before replying, or a restarted node can elect two leaders.
3. An entry is committed when a majority has it; only then is it applied and
   acknowledged.
4. The Log Matching Property is enforced by a `prevLogIndex`/`prevLogTerm` check
   on every AppendEntries — the leader never edits its own log, it forces
   followers to match.
5. Client commands need per-client serial numbers, or a retry after a lost reply
   commits the same operation twice.
6. A leader may not serve reads from local state without a read index or a lease;
   "fast local reads" means a lease, and leases depend on bounded clock skew.

Next: the safety argument, snapshots, and the genuinely subtle part — changing
cluster membership without ever having two leaders.
