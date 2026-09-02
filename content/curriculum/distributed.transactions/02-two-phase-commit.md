---
title: Two-phase commit
minutes: 20
summary: The protocol, the window where it blocks, and why the fix is more expensive than it looks.
---

Two-phase commit is the classical answer to atomic commit, and it is both simpler
and more dangerous than its reputation suggests. The protocol is four messages.
The problem is a specific window in which a coordinator failure leaves
participants holding locks with no way to decide — and the fix for that window is
consensus, which is why modern systems that offer 2PC have consensus underneath.

## The protocol

```text
  COORDINATOR                          PARTICIPANTS

     │  ─── PREPARE ──────────────────▶ │  do the work, write it to the
     │                                  │  log, acquire locks, fsync
     │  ◀── VOTE YES / NO ───────────── │  ← after this, a YES voter has
     │                                  │    GIVEN UP the right to abort
     │
     │  [decide: all YES → commit, any NO → abort]
     │  [WRITE THE DECISION TO THE LOG] ← the point of no return
     │
     │  ─── COMMIT / ABORT ───────────▶ │  apply, release locks
     │  ◀── ACK ────────────────────── │
```

Two things make this work, and both are commonly misunderstood:

**A YES vote is a promise.** Once a participant votes yes, it *must* be able to
commit — even if it crashes and restarts. So it must durably write everything
needed to commit before voting, and it may not unilaterally abort afterwards. It
has surrendered its autonomy.

**The coordinator's log entry is the decision.** The moment the coordinator
durably records "commit", the transaction is committed, regardless of whether any
participant has been told. Recovery reads that record and finishes the job.

## The blocking problem

The window that defines 2PC's reputation:

```text
  participants have all voted YES
  they are holding locks, waiting

           ╳ COORDINATOR CRASHES ╳

  participant state: "I voted yes. I don't know the decision."

  Can it commit?  NO — another participant may have voted no.
  Can it abort?   NO — the coordinator may have decided commit.

  → it must WAIT. holding locks. indefinitely.
```

This is not a bug in an implementation. It is a proven property: **no atomic
commit protocol can be non-blocking with a single coordinator failure.** Skeen
and Stonebraker showed this in 1983.

Participants can ask each other, which resolves some cases — if any participant
heard the decision, it can share it; if any voted no, everyone can abort. But if
all voted yes and none heard the outcome, they are genuinely stuck until the
coordinator returns.

The operational consequence is severe: those locks are held on *live data*, so a
coordinator that stays down takes rows — or whole tables — out of service for
everyone. A 2PC deployment therefore needs the coordinator to be highly
available, and "highly available coordinator" means replicated, and replicating a
decision means consensus. **This is why modern implementations put the
coordinator's log in Raft**, and why 2PC-over-consensus is the design in Spanner,
CockroachDB and TiDB rather than 2PC alone.

## Three-phase commit, and why nobody uses it

3PC inserts a "pre-commit" phase so participants can distinguish "everyone voted
yes" from "no decision yet", making it non-blocking under crash failures.

```text
  PREPARE ──▶ VOTE ──▶ PRE-COMMIT ──▶ ACK ──▶ COMMIT
```

It fails in the presence of **network partitions**: two groups can independently
reach different decisions, because 3PC assumes a synchronous network with bounded
delays. Since partitions are the thing you were worried about, this is not a
useful trade — one extra round trip, plus an unsafe assumption. It is a textbook
protocol, not a production one.

## What is really used

**Consensus-backed 2PC.** Replicate the coordinator's decision log through Raft
or Paxos so no single coordinator failure blocks anything. Participants are
themselves replicated groups. This is what distributed SQL databases do, and it
is the reason they can offer real cross-shard transactions.

```text
  ┌──── coordinator (Raft group) ─────┐
  │  decision log is replicated       │
  └───────────────┬───────────────────┘
       ┌──────────┼──────────┐
       ▼          ▼          ▼
   shard 1     shard 2     shard 3
   (Raft)      (Raft)      (Raft)

  a coordinator node failing does not block: another member of its
  Raft group reads the replicated decision and finishes the protocol
```

**Percolator-style 2PC** (Google's, and the basis of TiDB's) is worth knowing
because it removes the separate coordinator entirely. One of the participating
rows is designated the **primary lock**, and its state *is* the transaction's
state:

```text
  1. PREWRITE   write data + a lock to every row.
                one row is the PRIMARY; the others point at it.

  2. COMMIT     commit the PRIMARY row (one atomic single-row write).
                → this single write commits the whole transaction.

  3. CLEANUP    asynchronously commit the secondaries.
                anyone who encounters a stale secondary lock can
                look at the primary and finish the job themselves.
```

The elegance is that **the decision is one single-row write**, so there is no
coordinator to fail, and any reader that stumbles on an unresolved lock can roll
it forward or back by consulting the primary. Recovery is self-healing rather
than dependent on a coordinator returning.

**XA transactions** are the standard interface for 2PC across heterogeneous
resource managers — a database and a message broker, or two different databases.
Widely supported and widely regretted:

```text
  □  the transaction manager becomes a critical stateful component
  □  its recovery log must be as durable as the databases it coordinates
  □  in-doubt transactions require manual intervention alarmingly often
  □  many drivers implement XA poorly, and the bugs are subtle
  □  performance is substantially worse than local transactions
```

If you inherit XA, the operational reality is that you will periodically resolve
in-doubt transactions by hand. If you are choosing, choose the outbox or a saga.

## Locks, and the cost that scales badly

The window between prepare and commit is a full network round trip plus the
coordinator's fsync. Locks are held throughout, and that changes contention
arithmetic:

```text
  local transaction:      locks held ~1 ms
  2PC transaction:        locks held ~10–50 ms (same DC)
                                     ~200 ms+  (cross region)

  → 50× the lock hold time means 50× the contention on hot rows
```

For a hot row — an inventory count, a sequence, a popular product — this is the
difference between a working system and a queue of blocked transactions. It is
the reason 2PC is rationed to the operations that genuinely need it rather than
used as the default.

## When 2PC is the right answer

```text
  ✓  across shards of ONE database you operate
  ✓  participants are homogeneous and colocated
  ✓  the coordinator is consensus-backed
  ✓  transactions are short and touch few rows
  ✓  correctness genuinely requires atomicity (money, inventory,
     seat allocation)

  ✗  across independently deployed services
  ✗  across a WAN
  ✗  when any participant is a third party
  ✗  for long-running business processes
  ✗  when a saga's eventual consistency is acceptable
```

The distinction that matters most is the first line of each column. **Within one
system that you operate and that has consensus underneath, 2PC is fine and you
should use the database's transactions without agonising.** Across services, it
is the wrong tool, and reaching for it is usually a sign the boundary is wrong.

## What to take away

1. 2PC is four messages, and its correctness rests on a YES vote being an
   irrevocable promise plus the coordinator's log entry being the decision.
2. The blocking window — all voted yes, coordinator gone — is provably
   unavoidable with a single coordinator, and the locks held during it take live
   data out of service.
3. 3PC is non-blocking only under crash failures, and unsafe under partitions,
   which is why it is not used.
4. Real systems back the coordinator with consensus, or use Percolator's design
   where committing one primary row *is* the decision and recovery is
   self-healing.
5. XA works across heterogeneous systems and brings a stateful transaction
   manager and periodic manual resolution of in-doubt transactions.
6. 2PC holds locks for tens to hundreds of milliseconds instead of one, so
   contention on hot rows scales badly — ration it to operations that need it.

Next: sagas, which give up atomicity to get availability back.
