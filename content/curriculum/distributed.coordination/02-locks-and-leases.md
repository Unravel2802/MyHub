---
title: Locks and leases
minutes: 20
summary: What makes a distributed lock safe, and the Redlock argument worth understanding.
---

A distributed lock is the most-reached-for coordination primitive and the one
most often implemented incorrectly. The failure is not usually in acquiring the
lock — that part is easy — but in the assumption that holding it means you still
hold it.

## Two different jobs

Before implementing anything, decide which you need, because the requirements
differ enormously:

```text
  EFFICIENCY LOCK                   CORRECTNESS LOCK
  ───────────────                   ────────────────
  avoid doing work twice            prevent two writers

  two holders → wasted work         two holders → CORRUPTION
  a rare double-execution is fine   a rare double-execution is a bug

  → a simple lock is adequate       → you need fencing, and probably
                                      not a lock at all
```

Most locks in practice are efficiency locks: do not send the newsletter twice, do
not run the nightly report on two machines. For those, a Redis `SET NX PX` is
genuinely fine, and the occasional double-execution costs a duplicate email.

For correctness locks, the rest of this chapter applies, and the honest
conclusion is that a lock is usually the wrong tool.

## The three requirements

```text
  1. MUTUAL EXCLUSION   only one holder at a time
  2. LEASE              it expires, or a crashed holder blocks forever
  3. FENCING TOKEN      the protected resource rejects stale holders
```

Requirement 2 creates the problem requirement 3 solves:

```text
  A acquires the lock, lease 10s
     │
     ├─ A pauses: a 15s GC pause, VM descheduled, disk I/O stall
     │
     │   lease expires
     │   B acquires the lock legitimately, and writes
     │
     └─ A resumes, believing it still holds the lock, and writes

  → two writers. the lock worked. the system is corrupt.
```

**No lease duration prevents this**, because no bound on a process pause exists.
A 60-second lease makes it rarer and changes nothing structurally. The only
defence is to make the stale writer's write fail.

## Fencing tokens

Each acquisition gets a monotonically increasing number, and the **resource being
protected** rejects anything older than what it has seen.

```text
  A acquires → token 33
  A pauses
  B acquires → token 34
  B writes with 34   → storage records highest = 34
  A resumes, writes with 33   → REJECTED
```

```python
lease = etcd.lease(ttl=10)
etcd.put("/locks/report", node_id, lease=lease)
token = lease.id             # monotonically increasing

storage.write(data, fencing_token=token)    # storage compares and rejects
```

The check must live in the resource. A check in the client is worthless: the
paused client is precisely the one that cannot check. If the resource cannot
perform the check — a filesystem, a third-party API — then **you cannot build a
correctness lock against it**, and you need a different design (single ownership,
or idempotent operations, or a conditional write the resource does support).

Many storage systems already provide the mechanism under another name:

```text
  S3 / GCS       conditional writes on ETag / generation number
  Postgres       optimistic version column
  DynamoDB       ConditionExpression
  HDFS           the original fencing token design
```

## The Redlock argument

Redis's Redlock algorithm acquires the lock on a majority of independent Redis
instances, on the theory that this tolerates instance failure. Martin Kleppmann's
critique and Salvatore Sanfilippo's response are both worth reading in full; the
substance:

**The critique.** Redlock's safety depends on bounded clock drift and bounded
process pauses. Neither is guaranteed:

```text
  a GC pause longer than the lease → two holders (as above)
  a clock jump on one node         → early expiry, two holders
  → Redlock is not safe for correctness WITHOUT fencing tokens,
    and Redis provides no monotonic token
```

**The response.** Redlock targets efficiency locks, where occasional double
execution is acceptable, and for that purpose it works.

**The resolution that matters for you:**

```text
  efficiency lock  ──▶ Redis SET NX PX is fine. Redlock is
                       unnecessary complexity for most cases.

  correctness lock ──▶ you need a monotonic fencing token, which
                       means a consensus store (etcd, ZooKeeper) —
                       or, better, no lock at all
```

The deeper lesson generalises past Redis: **any lock whose safety rests on
timing is not safe**, because timing assumptions fail under GC, virtualisation,
and clock adjustment. The token is what removes the dependence on timing.

## Lease renewal, and the trap in it

A long-running job holds a lease and renews it periodically:

```text
  acquire (ttl 30s)
    ├─ renew at 10s  ✓
    ├─ renew at 20s  ✓
    ├─ renew at 30s  ✗ network blip
    │
    │  lease expires at 40s. someone else acquires.
    │
    └─ renew at 40s  ✗ "lease not found"
       ← THE JOB MUST STOP HERE. immediately.
```

The rule: **a failed renewal must stop the work, not retry the renewal.** A job
that keeps working while trying to re-acquire is the two-holders case, self
-inflicted.

And renew early. A renewal interval of ttl/3 gives two chances to recover from a
transient failure before expiry; renewing at ttl/2 or later leaves no margin.

## Deadlock, and why it is rarer here

Classic deadlock requires holding one lock while waiting for another. In a
distributed setting it happens, but leases make it self-healing — the locks
expire and everything unwedges, which is one genuine advantage of leases over
in-process mutexes.

The defences are the same as locally, and the first is the one that works:

```text
  1. ACQUIRE IN A GLOBAL ORDER    always lock A before B, never B then A
  2. ONE LOCK AT A TIME           if you need two, you may need a
                                  different decomposition
  3. SHORT LEASES                 bounded damage from any deadlock
  4. TIMEOUT ON ACQUISITION       never block indefinitely
```

## The alternatives, again

Before implementing a distributed lock, the same questions as the previous
chapter, made concrete:

```text
  "only one worker should process this job"
     ──▶ partition jobs by hash; each worker owns a partition.
         no lock.

  "only one process should write this file"
     ──▶ write to a unique name and atomically rename/commit.
         no lock.

  "only one instance should run this cron"
     ──▶ a conditional insert into a table keyed by
         (job_name, scheduled_time). the unique constraint
         is the lock, and it is transactional.

  "only one request should decrement this counter"
     ──▶ an atomic conditional update. no lock.
```

That third one is worth adopting as a habit. A `unique (job_name, run_at)`
constraint gives you a leader per scheduled run, using infrastructure you already
operate, with no lease to renew and no fencing to implement.

## What to take away

1. Decide first whether it is an efficiency lock (double execution wastes work)
   or a correctness lock (double execution corrupts) — the requirements differ
   enormously.
2. A lease is necessary because holders crash, and it creates the pause problem;
   only a fencing token checked *by the resource* solves it.
3. If the protected resource cannot check a token, you cannot build a correctness
   lock against it — change the design.
4. Redlock's safety rests on bounded clocks and pauses, which do not hold; the
   general lesson is that any lock relying on timing is unsafe without a token.
5. A failed lease renewal must stop the work immediately, and renewals should
   happen at roughly ttl/3.
6. Most lock requirements are better served by partition ownership, an atomic
   rename, or a unique constraint on (job, scheduled_time).

Next: leader election — the most common use of a lock, and the patterns that make
it safe.
