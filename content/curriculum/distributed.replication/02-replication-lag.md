---
title: Replication lag and the reads it breaks
minutes: 21
summary: Three anomalies that look like application bugs, and the guarantees that fix each one.
---

Asynchronous replication buys write latency and availability at one price: a
follower's data is stale. Usually by milliseconds; occasionally, under load or
during a long transaction, by minutes. That staleness produces three distinct
user-visible anomalies, each of which gets reported as an application bug, and
each of which has a specific named fix.

## The setup

```text
  client ──write──▶ LEADER ──ack──▶ client
                      │
                      │  replication (asynchronous)
                      ▼
                   FOLLOWER  ◀──read── client
                      ▲
                 lag: the data here is from T-Δ
```

Reads go to followers because that is the point of having them. The problem is
that the client has no idea which replica it reached or how stale it is.

## Anomaly 1: reading your own writes

```text
  t=0    user posts a comment      ──▶ LEADER      (committed)
  t=10ms user's page reloads       ──▶ FOLLOWER    (lag = 50ms)
                                        │
                                        └─ comment not there yet

  the user sees their own comment VANISH
```

This is the one users report immediately, because it violates the most basic
expectation there is: I did a thing and it is not there. It also produces a
characteristic secondary bug — the user posts again, and now there are two
comments.

**The guarantee needed: read-your-writes (read-after-write consistency).** A user
must see their own writes. Nothing is promised about other users' writes.

The implementations, in increasing order of sophistication:

```text
  1. READ FROM LEADER for anything the user may have modified
       simple. "read the user's own profile from the leader,
       everyone else's from a follower."
       needs a rule for which data is "theirs" — often the hard part.

  2. READ FROM LEADER FOR N SECONDS after any write by this user
       track last-write time in the session; while it is recent,
       route to the leader. simple, effective, and the leader takes
       a burst of read traffic after every write.

  3. TOKEN-BASED (the general answer)
       the write returns a position — an LSN, a timestamp, a version.
       the client sends it with subsequent reads.
       the replica waits until it has caught up to that position,
       or the router picks a replica that already has.
```

Option 3 is what a well-designed system does, and several databases expose it
directly — Postgres has `pg_current_wal_lsn()` and replicas can report their
replay position; MongoDB has `afterClusterTime` in read concern; DynamoDB just
lets you ask for a strongly consistent read.

```python
lsn = db.write(comment)              # returns the write position
...
db.read(comments, at_least=lsn)      # replica waits, or router picks a
                                     # replica already past lsn
```

The advantage over option 2 is that it is exact rather than heuristic: no
guessing at "N seconds", and no unnecessary leader load once replicas have
caught up.

**The cross-device trap:** a user writes on their phone and reads on their
laptop. A session-scoped token does not help, because it is a different session.
If your product needs cross-device read-your-writes, the token must be tied to
the *user*, not the session — stored server-side against their identity.

## Anomaly 2: monotonic reads

```text
  t=0    read ──▶ follower A (lag 10ms)  ──▶ sees comments 1,2,3
  t=1s   read ──▶ follower B (lag 5s)    ──▶ sees comments 1,2

  the third comment appeared and then DISAPPEARED
```

Time appears to move backwards. This is arguably more disorienting than anomaly 1
because nothing the user did explains it, and it is common with round-robin load
balancing across replicas with different lag.

**The guarantee needed: monotonic reads.** A user never sees older data than they
already saw. (This is weaker than "always current" — it just forbids going
backwards.)

The fix is **sticky routing**: send a given user's reads to the same replica.

```text
  replica = replicas[hash(user_id) % len(replicas)]
```

Consistent hashing on the user ID is the usual implementation, so that adding or
removing a replica remaps only a fraction of users rather than all of them. The
failure case to handle: when that replica dies, the user is remapped to another
one that may be *further behind*, and the anomaly reappears exactly once. Carrying
a last-seen position and having the new replica wait for it closes that hole.

## Anomaly 3: consistent prefix

```text
  Alice:  "What time is the deploy?"     written to partition 1
  Bob:    "Six o'clock."                 written to partition 2

  an observer reading both partitions may see:

      Bob:   "Six o'clock."
      Alice: "What time is the deploy?"

  the answer arrives before the question
```

Causality is violated. This is specific to **partitioned** systems, because
different partitions replicate independently and there is no ordering between
them.

**The guarantee needed: consistent prefix reads.** If a sequence of writes
happens in a causal order, anyone reading them sees them in that order.

The fixes:

- **Keep causally related writes in one partition.** All messages in a
  conversation share a partition key. This is the simple and usual answer, and it
  is why partition key choice is a correctness decision, not just a scaling one.
- **Track causal dependencies explicitly** with the vector clocks or HLCs from
  the previous topic, and have readers wait for dependencies to arrive. Correct
  and general; more machinery than most systems want.

## Where lag comes from, and what to do about each

| Cause | Signature | Response |
| --- | --- | --- |
| Write burst | Lag rises with write rate | Rate-limit writes, or add write capacity |
| Long transaction on leader | Lag spikes, then catches up fast | Break up long transactions |
| Follower under-provisioned | Steady growth, never catches up | Match follower hardware to leader |
| Single-threaded apply | Lag grows only under concurrent writes | Enable parallel apply |
| Long query on follower | Postgres: replay paused | `hot_standby_feedback`, or accept cancellation |
| Network saturation | Lag correlates with bandwidth | Compression, or a better topology |
| Schema migration | Large step change | Do migrations online, in small batches |

The **single-threaded apply** row is the one that surprises people. A leader
executing writes across 32 concurrent connections produces a serial log, and a
follower replaying it one statement at a time cannot keep up — the follower is
doing the same work with one thread. Modern MySQL and Postgres support parallel
apply, and turning it on is often the single biggest lag improvement available.

**Monitor lag in seconds, not bytes.** `pg_wal_lsn_diff` in bytes tells you
little: a megabyte of small updates and a megabyte of one large one take very
different times to apply. `now() - pg_last_xact_replay_timestamp()` is the number
that means something to a user.

And alert on it. Unmonitored lag is how a replica ends up hours behind and
serving reads that look plausible but are wrong.

## Choosing a level per read

The practical design is not one consistency level for the whole system. It is a
decision per read path:

```text
  Does this read follow a write BY THE SAME USER?
     └─ YES ──▶ read-your-writes required (leader, or token)

  Would going backwards be confusing?
     └─ YES ──▶ monotonic reads (sticky routing)

  Does this read span causally related entities?
     └─ YES ──▶ consistent prefix (one partition, or dependency tracking)

  Otherwise
     └───────▶ eventual is fine — use any replica
```

Most reads land in the last row, which is why replicas work at all. The
discipline is identifying the ones that do not, and being explicit about them
rather than discovering them through support tickets.

A pattern worth adopting: make the consistency level an **explicit parameter** of
your data-access layer, defaulting to eventual, so that a call site requiring
something stronger says so in code that a reviewer can see:

```python
order = orders.get(id)                                # eventual, any replica
order = orders.get(id, consistency=READ_YOUR_WRITES)  # visible decision
```

## What to take away

1. Replication lag produces three distinct anomalies — reading your own writes,
   monotonic reads, and consistent prefix — each with its own fix.
2. Read-your-writes is best solved with a position token returned by the write,
   rather than a heuristic "read from the leader for N seconds".
3. Monotonic reads come from sticky routing; handle the case where the sticky
   replica dies and the user lands on one further behind.
4. Consistent prefix violations are a partitioned-system problem, and keeping
   causally related writes in one partition is the usual answer — which makes
   partition key choice a correctness decision.
5. Single-threaded replay is a common and fixable cause of unbounded lag; measure
   lag in seconds, not bytes, and alert on it.
6. Pick a consistency level per read path, defaulting to eventual, and make the
   stronger requirement visible in code.

Next: failover — what happens when the leader dies, and why this is the part that
loses data.
