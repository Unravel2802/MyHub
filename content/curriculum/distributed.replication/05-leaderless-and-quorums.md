---
title: Leaderless replication and quorums
minutes: 21
summary: Dynamo-style writes, the R + W > N arithmetic, and the guarantees it does not actually give.
---

Leaderless replication removes the leader entirely. Clients — or a coordinator
acting for them — write to several replicas at once and read from several at
once, and consistency comes from the *overlap* between those sets rather than
from any node being in charge. It is the design behind Dynamo, Cassandra, Riak
and S3, and its central idea is one inequality.

## The mechanism

```text
  N = 3 replicas, W = 2, R = 2

  WRITE                                READ
  ─────                                ────
  client ──▶ replica 1  ✓ ack          client ──▶ replica 1  → v2
         ──▶ replica 2  ✓ ack                 ──▶ replica 2  → v2
         ──▶ replica 3  ✗ slow/down           ──▶ replica 3  → v1 (stale)

  2 acks ≥ W → write succeeds          2 responses ≥ R → read succeeds
                                       take the newest version: v2
```

No leader means no failover, no promotion, no split brain, and no write outage
when a node dies — the remaining nodes simply satisfy the quorum. That is the
appeal, and it is a genuine one.

## The quorum inequality

```text
  R + W > N
```

If the read set and the write set are each large enough that they must **overlap
in at least one node**, then any read is guaranteed to touch at least one replica
that saw the latest write.

```text
  N = 5, W = 3, R = 3      →  3 + 3 = 6 > 5   ✓ overlap guaranteed

     write went to:  [1] [2] [3]  4   5
     read reaches:    1   2  [3] [4] [5]
                             ▲
                        overlap: replica 3 has the new value
```

Choosing R and W is choosing where to spend latency and where to accept
unavailability:

| Config (N=3) | Read | Write | Property |
| --- | --- | --- | --- |
| W=3, R=1 | fast | slow | Fast reads; any node down blocks writes |
| W=1, R=3 | slow | fast | Fast writes; any node down blocks reads |
| W=2, R=2 | balanced | balanced | Tolerates one node down for both |
| W=1, R=1 | fastest | fastest | **No overlap** — eventual only |

`W = R = ⌈(N+1)/2⌉` — a simple majority for both — is the usual default, because
it tolerates the most node failures while keeping the guarantee.

## Why the guarantee is weaker than it looks

This is the part that matters, and the part most summaries skip. `R + W > N`
gives you overlap. **It does not give you linearizability.** Several things go
wrong.

**Concurrent writes have no defined order.** Two clients write simultaneously to
overlapping but different subsets. There is no leader to serialise them, so
different replicas may end up with different values, and which one "wins" depends
on the conflict-resolution rule — usually last-write-wins, with all the clock
problems that implies.

**A write that fails may still be partially applied.** If W = 2 and only one
replica acked, the client is told the write failed — but that one replica has the
data, and it will be spread by anti-entropy. A "failed" write becomes visible
later.

```text
  client writes, W=2:  replica 1 ✓ acked
                       replica 2 ✗ timeout
                       replica 3 ✗ timeout
  → client sees FAILURE, does not retry, moves on

  later: read repair copies replica 1's value to 2 and 3
  → the failed write is now the committed value everywhere
```

There is no rollback in a leaderless system. This is genuinely surprising the
first time you meet it, and it means "the write failed" cannot be relied upon to
mean "the write did not happen".

**Sloppy quorums break the overlap entirely.** Under a partition, some systems
accept a write on *any* N reachable nodes, not the N nodes that own the key:

```text
  key K's home replicas: [1] [2] [3]   ← all unreachable from the client
  reachable nodes:        4   5   6

  sloppy quorum: write to 4, 5, 6 with a HINT saying
                 "this belongs to 1, 2, 3 — deliver it when they return"

  → write availability preserved
  → but a reader reaching 1, 2, 3 sees NOTHING. no overlap.
```

**Hinted handoff** delivers the data when the home replicas return, so it
converges eventually. But during the partition the quorum guarantee simply does
not hold. This is a deliberate availability-over-consistency choice, and it needs
to be understood as one — a system configured with `R + W > N` and sloppy quorums
enabled is not offering what the inequality suggests.

**Read repair timing.** A read that detects stale replicas repairs them — but
whether it does so before or after returning to the client differs by system and
by setting, and "before" costs latency.

## Keeping replicas converged

Two mechanisms, and both are needed.

**Read repair** — on a read, if replicas disagree, write the newest value back to
the stale ones.

```text
  read K → replica 1: v5, replica 2: v5, replica 3: v3
                                                    ▲
  return v5 to the client, and write v5 to replica 3
```

Cheap and effective — for data that is read. Its weakness is exactly that: a key
nobody reads is never repaired, and can stay stale indefinitely. That matters
because of the next section.

**Anti-entropy** — a background process comparing replicas and reconciling
differences. Comparing two large datasets naively means transferring everything,
so **Merkle trees** are used: a hash tree over the key range, compared top-down,
so only the differing branches are examined.

```text
                    hash(all)
                   ╱         ╲
            hash(A-M)       hash(N-Z)
             ╱     ╲          ╱    ╲
        h(A-F)  h(G-M)   h(N-S)  h(T-Z)
                                    ▲
        compare roots: differ → descend
        compare children: only T-Z differs → descend
        → transfer only the differing keys, not the dataset
```

This is the same structure git uses for object trees and Bitcoin uses for
transaction sets — a general mechanism for "efficiently find the differences
between two large collections".

## Tombstones and the resurrection problem

Deletion in a leaderless system cannot be "remove the row", because a replica
that missed the delete would see the row as *present* and helpfully replicate it
back:

```text
  delete K on replicas 1, 2.  Replica 3 was down.
  replica 3 returns, still has K.
  anti-entropy: "1 and 2 are missing K, let me fix that"
  → K is RESURRECTED
```

So a delete writes a **tombstone**: a marker saying "deleted at version v". It
replicates like any other write and takes precedence over older values.

Tombstones must eventually be collected, or deletes accumulate forever — but
collecting one too early reopens the resurrection hole. Systems use a grace
period (`gc_grace_seconds` in Cassandra, default 10 days) chosen to exceed the
maximum time a node can be down and rejoin.

The operational trap this creates: **a node that is down for longer than the
grace period must not simply be restarted.** Its old data will resurrect deleted
rows. It must be wiped and rebuilt from its peers. This is a genuine footgun and
has caused real data-integrity incidents.

A second trap: workloads that delete heavily accumulate tombstones that must be
scanned on every read of that range. A queue implemented on Cassandra — write a
row, read it, delete it — degrades badly for exactly this reason, and "do not use
Cassandra as a queue" is standard advice built on it.

## Where leaderless fits

**Good for:**

- Write availability above all — telemetry, sensor data, event ingestion, session
  storage.
- Multi-region where every region must accept writes.
- Workloads with natural partitioning by key and no cross-key constraints.
- Very large scale where losing nodes is routine rather than exceptional.

**Bad for:**

- Anything needing read-your-writes without extra machinery.
- Anything needing uniqueness, or any cross-record invariant.
- Anything where "the write failed" must mean it did not happen.
- Queues, and any delete-heavy workload.
- Transactions across keys.

The design that works best: **use leaderless for the workload it fits, and a
single-leader store for the parts that need constraints.** A system that stores
events in Cassandra and account balances in Postgres is not confused — it is
matching the store to the guarantee each dataset needs.

## The three architectures, compared

| | Single leader | Multi leader | Leaderless |
| --- | --- | --- | --- |
| Write conflicts | impossible | resolve | resolve |
| Write availability | fails during failover | high | **highest** |
| Read-your-writes | easy | needs care | needs R+W>N and care |
| Ordering | total | per leader | none |
| Uniqueness constraints | ✅ | ✗ | ✗ |
| Failover complexity | high | none | **none** |
| Operational complexity | low | high | medium |
| Examples | Postgres, MySQL | multi-region MySQL, CouchDB | Cassandra, Riak, S3 |

The two cells worth reading together are "failover complexity: high" for single
leader and "none" for leaderless. That is the real trade at the heart of Dynamo's
design: it gave up ordering and constraints to eliminate the entire class of
failover problems from the previous chapter.

## What to take away

1. Leaderless replication replaces a leader with overlap: `R + W > N` guarantees
   a read set touches at least one replica holding the latest write.
2. That inequality does not give linearizability — concurrent writes have no
   defined order, and a "failed" write can still become visible via repair.
3. Sloppy quorums with hinted handoff preserve write availability during a
   partition by abandoning the overlap guarantee. Know which you have enabled.
4. Read repair fixes what is read; anti-entropy with Merkle trees fixes the rest,
   by comparing hash trees rather than data.
5. Deletes must write tombstones or absent replicas resurrect them — and a node
   down longer than the grace period must be rebuilt, not restarted.
6. Match the store to the guarantee: leaderless for availability-first data,
   single-leader for anything with constraints.

That completes replication. Next in the track: **partitioning** — splitting data
across nodes rather than copying it, and the two are almost always combined.
