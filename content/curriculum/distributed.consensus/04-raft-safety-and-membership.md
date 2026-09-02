---
title: Raft — safety, snapshots and membership
minutes: 22
summary: The election restriction, the commit rule that looks wrong, and why reconfiguration is the hard part.
---

The previous chapter described how Raft normally works. This one covers the
parts that exist purely to make it *correct under failure* — and they are the
parts that homegrown implementations get wrong, because they only matter in
sequences of events you will not think to test.

## The Election Restriction

A candidate must not win if it is missing committed entries — otherwise it would
overwrite them, and committed means durable.

> **A voter refuses its vote unless the candidate's log is at least as up-to-date
> as its own.**

"At least as up-to-date" compares the last entry:

```text
  compare (lastLogTerm, lastLogIndex) lexicographically

  higher TERM wins outright
  same term → longer log (higher index) wins
```

```text
  candidate: last entry (term 2, index 5)
  voter:     last entry (term 3, index 4)

  → the voter's term is HIGHER. it refuses.
    even though the candidate's log is LONGER.
```

Term dominates length, and the reason is that a higher term means the voter has
seen entries from a more recent leader — entries the candidate could not have.
Length without a matching term proves nothing.

Combined with the quorum intersection property, this guarantees safety: a
committed entry is on a majority; any winning candidate collected votes from a
majority; the two majorities share a node; that node holds the entry and would
have refused a candidate lacking it. Therefore **every leader contains every
committed entry**. That is the Leader Completeness Property, and it is the
keystone of Raft's correctness argument.

## The commit rule that looks wrong

Raft has a rule that seems unnecessarily conservative:

> **A leader may only mark an entry committed by counting replicas if the entry
> is from its own current term.**

Entries from earlier terms become committed only *indirectly* — when a later
entry from the current term commits, everything before it commits with it.

The reason is a real scenario in which the naive rule loses committed data:

```text
  5 nodes: S1..S5

  (a) S1 is leader in term 2, appends entry@2 at index 2,
      replicates to S2 only.   [not yet a majority]

         S1: [1@1][2@2]
         S2: [1@1][2@2]
         S3: [1@1]
         S4: [1@1]
         S5: [1@1]

  (b) S1 crashes. S5 is elected leader for term 3
      (votes from S3, S4, S5 — their logs are all [1@1],
       and S5's last term 1 ties, so it can win).
      S5 appends entry@3 at index 2 but replicates nothing yet.

         S5: [1@1][2'@3]

  (c) S5 crashes. S1 restarts and is elected leader for term 4.
      It resumes replicating its OLD entry@2 and reaches a majority:

         S1: [1@1][2@2]
         S2: [1@1][2@2]
         S3: [1@1][2@2]      ← now on 3 of 5

      If S1 counted this as committed, index 2 = entry@2 is committed.

  (d) S1 crashes again. S5 is elected for term 5 (its log has term 3
      at index 2 — HIGHER term than the others' term 2, so it wins
      the election restriction).
      S5 forces its own [2'@3] onto everyone.

      → index 2 changes from entry@2 to entry'@3
      → a "committed" entry was OVERWRITTEN
```

The fix is exactly the rule above: in step (c), S1 is in term 4 and the entry is
from term 2, so it may not commit it by counting. It must first append a *new*
entry in term 4 and commit that; doing so commits index 2 as a side effect, and
after that S5 can no longer win an election.

This is worth working through slowly, because it is the clearest demonstration
that "replicated on a majority" is **not** sufficient for durability on its own —
and it is exactly the class of bug that only appears in a specific interleaving of
two crashes and two elections.

## Snapshots and log compaction

The log grows forever. At some point it must be truncated, and the state it
represents captured another way.

```text
  BEFORE                                    AFTER
  ┌──────────────────────────────────┐      ┌──────────┬────────┐
  │ [x=1][y=2][x=3][z=9][y=7][x=0]   │  ──▶ │ SNAPSHOT │[y=7]   │
  │  entries 1 .. 6                  │      │ @index 4 │[x=0]   │
  └──────────────────────────────────┘      │ {x:9,z:9}│        │
                                            └──────────┴────────┘
```

A snapshot stores the state machine's state plus the index and term it covers.
Everything up to that index can be discarded.

Two consequences:

**A far-behind follower cannot be caught up from the log**, because the entries
it needs are gone. The leader sends the whole snapshot instead — the
`InstallSnapshot` RPC — which for a large state machine is a substantial
transfer. This is why "how long does a node take to rejoin" is a real
operational number, and why systems support incremental or streamed snapshots.

**Snapshotting must not stall the leader.** A naive implementation blocks while
serialising gigabytes. Real ones use copy-on-write or fork so the state machine
keeps serving. A blocking snapshot on a leader looks exactly like a leader
failure to the rest of the cluster, and triggers an election — a self-inflicted
outage that recurs on a schedule.

## Membership changes: the genuinely hard part

Adding or removing a node changes what "majority" means, and if two nodes use
different definitions at the same instant, two leaders can be elected.

```text
  naive switch from {A,B,C} to {A,B,C,D,E}

  time ──────────────────────────────────────▶

  A, B  still think the cluster is {A,B,C}      majority = 2
  C, D, E already think it is {A,B,C,D,E}       majority = 3

  A and B elect A leader with 2 votes         ✓ (by their rule)
  C, D, E elect E leader with 3 votes         ✓ (by their rule)

  → TWO LEADERS in the same term. safety violated.
```

Raft offers two correct solutions.

**Joint consensus** — a transitional configuration requiring majorities of
*both* old and new:

```text
  C_old  ──▶  C_old,new  ──▶  C_new
              ▲
       decisions need a majority of C_old
       AND a majority of C_new
       → no single-configuration majority can act alone
```

Correct and general, and complex enough that most implementations avoid it.

**Single-server changes** — add or remove exactly one node at a time. Any two
configurations differing by one member have overlapping majorities, so no
disjoint majorities can exist:

```text
  {A,B,C} majority 2   →   {A,B,C,D} majority 3
  any 2 from the old and any 3 from the new must share a node ✓
```

To grow from 3 to 5, do it in two steps: 3 → 4 → 5. This is what most systems
implement, and it is why cluster resizing is a sequence of operations rather than
one.

**Two traps in membership changes:**

- **Add a new node as a non-voting learner first.** A brand-new node has an empty
  log; making it a voter immediately means the quorum includes a node that cannot
  vote usefully and slows every decision until it catches up. Catch up, then
  promote.
- **Removed nodes must be stopped.** A removed node stops receiving heartbeats,
  times out, and starts elections with ever-increasing terms — disrupting the
  cluster it is no longer part of. Raft's answer is that followers ignore
  `RequestVote` received within the minimum election timeout of hearing from a
  valid leader.

## What can still go wrong

A short list of real failure modes even in correct implementations:

**A partitioned leader keeps incrementing terms.** A node alone in a minority
partition times out repeatedly, raising its term. On rejoining, its high term
forces the healthy leader to step down — a disruption caused by a node that
could never have won. The **pre-vote** extension fixes this: a candidate first
asks "would you vote for me?" without incrementing its term, and only starts a
real election if a majority says yes. Enable pre-vote if your implementation
offers it.

**Disk failure with amnesia.** A node whose persistent state is lost must rejoin
as a *new member*, not restart as the old one, or it may vote twice in a term.

**A slow follower silently degrades tolerance.** A cluster of 5 with one node
persistently behind is really a cluster of 4 for commit purposes. Monitor
per-follower lag, not just cluster health.

**Clock skew breaking leases.** If lease reads are enabled, a leader whose clock
runs slow may believe its lease is still valid after a new leader was elected.
Lease reads require the clock bound the clocks topic described, and monitoring of
it.

## What to take away

1. The election restriction — a voter refuses a candidate whose log is less
   up-to-date, comparing term first and index second — combined with quorum
   intersection gives Leader Completeness.
2. A leader may only commit by counting replicas for entries from its *own*
   term; earlier entries commit indirectly. Without this, a specific two-crash
   interleaving overwrites a committed entry.
3. Snapshots truncate the log and must not block the leader — a blocking snapshot
   looks like a leader failure and triggers an election.
4. Membership changes can produce two disjoint majorities; use joint consensus,
   or change one server at a time.
5. Add new members as non-voting learners and promote once caught up; ensure
   removed nodes are actually stopped.
6. Enable pre-vote to stop a partitioned node's inflated term from disrupting a
   healthy leader.

Next: Paxos — the original, why it has a reputation, and what its variants buy.
