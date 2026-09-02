---
title: Building on consensus, and operating it
minutes: 21
summary: The primitives consensus gives you, the ones people misuse, and what a Raft cluster needs from you.
---

Consensus is rarely something you interact with directly. It is the layer beneath
a handful of primitives — locks, leader election, configuration, coordination —
and most of the mistakes in this area are made *above* it, by using those
primitives as if they were the local versions. This chapter is the correct usage
patterns and the operational realities.

## What a consensus store gives you

etcd, ZooKeeper and Consul all expose roughly the same set of primitives:

```text
  LINEARIZABLE KV       get/put/delete with real-time ordering
  COMPARE-AND-SWAP      atomic conditional write
  LEASES / TTL          a key that expires unless refreshed
  WATCHES               notification on change, in order
  SEQUENTIAL KEYS       server-assigned monotonically increasing names
```

Everything else — locks, leader election, membership, service discovery,
barriers, queues — is built from those five.

## Distributed locks, done properly

The most-used and most-misused primitive. A correct lock needs three things, and
the third is the one people omit.

```text
  1. MUTUAL EXCLUSION   only one holder — consensus provides this
  2. A LEASE            the lock expires, or a crashed holder blocks
                        everyone forever
  3. A FENCING TOKEN    the protected resource rejects stale holders
```

Without (3), the lock is not safe, and the reason is a sequence you cannot
prevent:

```text
  client A acquires the lock (lease 10s)
     │
     ├─ A is paused: a 15-second GC pause, or the VM is descheduled
     │
     │   ... lease expires ...
     │
     │   client B acquires the lock. B writes.
     │
     └─ A resumes. A does not know time passed. A writes.

  → two writers. the lock did its job; the SYSTEM was still corrupted.
```

No lease duration fixes this, because a pause can always exceed it. The fix is to
make the *storage* reject the stale writer:

```text
  A acquires lock → token 33
  A pauses
  B acquires lock → token 34
  B writes with token 34   → storage records highest seen = 34
  A resumes, writes with token 33   → REJECTED (33 < 34)
```

```python
lease = etcd.lease(ttl=10)
etcd.put("/locks/report", node_id, lease=lease)
token = lease.id                 # monotonically increasing; use as the fence

# every protected write carries the token, and the STORAGE compares it
storage.write(data, fencing_token=token)
```

The check must be in the resource being protected. A check in the client is
worthless — the paused client is the one that cannot check.

**And before reaching for a distributed lock at all**, ask whether you can avoid
it. Partitioning work so only one worker can touch a resource, using a
conditional write (`UPDATE ... WHERE version = n`), or making the operation
idempotent so concurrent execution is harmless — all are cheaper and have fewer
failure modes.

## Leader election

```python
# the standard shape, using a lease + CAS
lease = etcd.lease(ttl=10)
acquired = etcd.put_if_absent("/service/leader", node_id, lease=lease)

if acquired:
    lease.keep_alive()           # refresh in the background
    become_leader()
else:
    etcd.watch("/service/leader", on_delete=try_again)
```

Three rules that make the difference between this working and causing an outage:

**Never assume you are still the leader.** Leadership can be lost silently — a
network blip drops your keep-alive, the lease expires, someone else takes over,
and your process has not noticed. Check the lease before every consequential
action, and fence every write.

**Stop work immediately on losing leadership.** The keep-alive failing must
trigger an orderly stop, not a retry loop. A demoted leader that keeps working is
the split-brain case.

**Do not tie leadership to liveness.** A process that panics and exits when its
lease lapses will restart-loop during a network blip. Step down, wait, retry.

## Configuration and coordination

Consensus stores are the right home for small, critical, rarely-changing state:

```text
  GOOD                              BAD
  ────                              ───
  cluster membership                application data
  feature flags                     session state
  service discovery                 job queues
  shard assignments                 metrics
  schema versions                   anything high-write
  leader identity                   anything large
```

The line is about **write rate and size**. etcd's practical limits are on the
order of 10k writes/second and a 1.5 MB value cap, with a total database size
meant to be measured in gigabytes at most. It is a coordination store, not a
database, and treating it as one is a common and painful mistake — a team puts
per-request state in etcd, the write rate saturates the Raft group, and *every*
system depending on it for leader election starts flapping.

**Watches are the right way to consume changes**, not polling:

```python
for event in etcd.watch_prefix("/config/"):
    apply(event.key, event.value)
```

Watches deliver in order and include a revision number, so a client that
disconnects can resume from where it left off rather than re-reading everything.
The failure mode to handle: **watch history is compacted**, so a client
disconnected long enough gets a "revision compacted" error and must do a full
re-read before resuming. Handle it explicitly or the client silently misses
updates.

## Operating a cluster

**Sizing.** Three nodes tolerate one failure; five tolerate two and are the right
choice when the cluster is critical enough that you want to survive a failure
*during* a planned maintenance. Seven is almost always wrong — the latency cost is
real and the marginal tolerance rarely matters. Never an even number.

**Placement.** Spread across failure domains, and understand what a
majority means geographically:

```text
  3 nodes, 2 in DC-A and 1 in DC-B

  DC-A fails → 1 node left, no quorum → CLUSTER DOWN
  DC-B fails → 2 nodes left, quorum   → fine

  → this is NOT "surviving a data centre failure". it survives
    exactly one of the two.
```

Three failure domains is the minimum for real DC-level tolerance, and a witness
node in a third location is the cheap way to get it.

**Disk.** Consensus `fsync`s on every write. Disk latency *is* write latency, and
`fsync` latency (not throughput) is the metric that matters. Local NVMe; never
network storage for a consensus group if you can avoid it, because a storage blip
becomes a cluster-wide stall.

**Monitoring.** The signals that actually predict trouble:

```text
  □  leader changes per hour        → should be ~0. any churn is a
                                       symptom, usually of slow disk or
                                       an aggressive election timeout
  □  fsync / commit latency p99     → the leading indicator
  □  per-follower lag               → a lagging follower silently
                                       reduces your fault tolerance
  □  proposal failures / pending    → backpressure signal
  □  database size vs quota         → etcd stops accepting writes when
                                       full, which is a hard stop
  □  time since last successful
     snapshot / compaction          → an un-compacted log fills the disk
```

The first row is the highest-value alert in this whole topic. A cluster changing
leaders repeatedly is a cluster that is about to have an outage, and the cause is
almost always disk latency or a timeout tuned for a faster network than the one
it is on.

**Backups.** A consensus cluster is replicated, and replication is not backup —
the same rule as before. A bad `DELETE` on a prefix replicates instantly to
every node. Take periodic snapshots, store them elsewhere, and restore one
occasionally to confirm the procedure works.

**Disaster recovery.** Losing a majority permanently is the scenario to have a
plan for. Recovery means forcing a new cluster from a surviving node's data,
which **discards any writes that node did not have**. Know the procedure for your
system before you need it; it is not something to read for the first time during
an incident.

## The costs, restated plainly

```text
  latency      one round trip to a majority, plus fsync
               (single-digit ms locally, 50–150 ms across regions)

  throughput   bounded by the leader; batching helps enormously,
               scaling out the cluster does NOT

  availability unavailable in a minority partition, by design

  operations   an odd-sized cluster, spread across failure domains,
               on fast local disks, with leader-change alerting
```

The design consequence, one more time: **use consensus for the small amount of
state that genuinely needs agreement, and keep everything else out of it.** The
systems that scale run thousands of small consensus groups underneath a
partitioned data layer, and put almost no traffic through any one of them.

## What to take away

1. A distributed lock needs mutual exclusion, a lease, *and* a fencing token
   checked by the protected resource — a pause longer than the lease is always
   possible.
2. Prefer avoiding the lock: partitioned ownership, conditional writes, or
   idempotent operations have fewer failure modes.
3. A leader must never assume it still holds leadership; check the lease and
   fence every write, and stop work immediately when it lapses.
4. Consensus stores are for small, low-write, critical state. Putting application
   data in one saturates the Raft group and breaks every system depending on it.
5. Size 3 or 5, never even, spread across at least three failure domains — two
   data centres do not give data-centre tolerance.
6. Alert on leader changes per hour and on fsync p99; repeated leader churn is the
   leading indicator of a consensus outage, and it is usually slow disk.

That completes consensus. Next in the track: **distributed transactions** — using
consensus and everything before it to make several changes atomic across
machines.
