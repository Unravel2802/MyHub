---
title: Running databases in production
minutes: 18
summary: Backups, failover, and vacuum — the operational discipline the Database Internals chapter's structures require to actually stay reliable.
---

The Database Internals chapter covered how a database works. This chapter
is what it takes to keep one RUNNING, reliably, in production — and the gap
between those two is real: a correctly-designed schema on a database
nobody's backing up, testing failover for, or maintaining is still one
incident away from real, permanent data loss.

## Backups: the one you never test is the one that fails

```text
  → the single most important operational fact about backups:
    an UNTESTED backup is a HOPE, not a guarantee — a backup
    process that "should" work, that nobody has ever actually
    RESTORED from, can be silently broken (corrupted files, a
    schema mismatch, a credential that expired) for MONTHS
    before anyone discovers it, at exactly the worst possible
    moment: during a real incident where the backup turns out
    to be the ONLY thing that could have saved the data.
```

```text
  → REGULARLY practicing an actual RESTORE (not just confirming
    the backup FILE exists) is what turns "we have backups" from
    an assumption into a verified fact — this is the same
    discipline as a load test verifying capacity BEFORE a real
    spike arrives, applied to disaster recovery instead of
    capacity.
```

## Point-in-time recovery: restoring to a specific moment, not just the last backup

```text
  a DAILY full backup only lets you restore to one of a handful
  of DISCRETE points (yesterday, the day before...) — a
  disaster at 2pm means losing EVERYTHING since last night's
  backup, potentially many hours of data.

  → POINT-IN-TIME RECOVERY combines a periodic full backup with
    the DATABASE'S OWN write-ahead log (the Database Internals
    chapter's WAL, retained continuously rather than discarded
    after each commit) — replaying the WAL from the last backup
    forward to ANY specific moment (say, 1:59pm, one minute
    before a bad deploy started corrupting data) recovers to
    THAT exact point, not just to whichever discrete daily
    snapshot happens to exist.
```

## Failover: surviving the loss of the primary

```text
  PRIMARY (accepts writes) → replicates to → REPLICA(S)
  (read-only, kept in sync)

  → when the PRIMARY fails, a replica is PROMOTED to become
    the new primary — this can be MANUAL (a human decides and
    executes the promotion, slower but with a human verifying
    the decision) or AUTOMATIC (a monitoring system detects
    the primary's failure and promotes a replica itself,
    faster but with a REAL risk: a false-positive failure
    detection — the primary was actually FINE, just
    experiencing a temporary network partition — triggers an
    UNNECESSARY failover, and now TWO nodes may briefly both
    believe they're the primary, a SPLIT-BRAIN scenario that
    can itself cause real data inconsistency).
```

```text
  → this is the Consensus chapter's leader-election problem,
    concretely: correctly and safely electing a new leader
    when the old one MIGHT still be alive (just unreachable,
    not actually dead) is a genuinely hard distributed-systems
    problem, not a simple "if primary doesn't respond, promote
    a replica" script — the difference between "unreachable"
    and "actually dead" is exactly what makes this hard, and
    getting it wrong is how split-brain happens.
```

## Connection pooling: databases have a hard connection limit

```text
  → a database has a MAXIMUM number of concurrent connections
    it can hold open (often in the hundreds, not unlimited) —
    each application instance opening its OWN large pool of
    connections can collectively EXCEED this limit as the
    application scales horizontally, causing new connection
    attempts to FAIL outright, in a way that looks like "the
    database is down" even though the database itself is
    perfectly healthy.
```

```text
  → a CONNECTION POOLER (PgBouncer, for Postgres, is the
    canonical example) sits BETWEEN the application and the
    database, multiplexing MANY application-level logical
    connections over FEWER actual database connections — this
    is the exact same "cap the resource, protect the shared
    dependency" idea as the Rate Limiting and Resilience
    chapter's bulkhead pattern, applied specifically to
    database connections as the scarce, sharable resource.
```

## Zero-downtime upgrades

```text
  → upgrading a database's major version can involve real,
    breaking changes (data format changes, deprecated features
    actually removed) — the SAME expand/contract-style
    discipline the Zero-Downtime Migrations chapter covers for
    schema changes applies here too, at the ENGINE-VERSION
    level: a BLUE-GREEN-style database upgrade (stand up a
    replica running the NEW version, verify it thoroughly, then
    cut over) trades real infrastructure cost for an upgrade
    that doesn't require scheduled downtime.
```

## VACUUM and routine maintenance

```text
  → Postgres's MVCC (the Database Internals chapter's mechanism
    for readers-never-blocking-writers) has a real, direct
    operational cost: OLD row VERSIONS aren't immediately
    deleted when a row is updated or deleted — they accumulate
    as DEAD TUPLES until VACUUM (a periodic cleanup process)
    reclaims that space.
```

```text
  → a database that's NEVER vacuumed (or vacuumed too
    infrequently for its actual write volume) accumulates dead
    tuples that BLOAT table and index size over time, degrading
    query performance gradually and often confusingly, since
    "the schema and queries didn't change, but it's gotten
    steadily slower" doesn't obviously point at maintenance —
    this is precisely why understanding MVCC's actual mechanism
    (rather than treating VACUUM as an opaque, ignorable
    background task) is what makes this failure mode
    diagnosable rather than mysterious.
```

## What to take away

1. An untested backup is a hope, not a guarantee — regularly practicing an
   actual restore is what turns "we have backups" from an assumption into
   a verified fact.
2. Point-in-time recovery combines a periodic backup with the database's
   own write-ahead log, letting recovery target any specific moment rather
   than only whichever discrete daily snapshot happens to exist.
3. Automatic failover risks split-brain from a false-positive failure
   detection — correctly distinguishing "unreachable" from "actually dead"
   is the same hard leader-election problem the Consensus chapter covers,
   not a simple promote-on-timeout script.
4. A connection pooler multiplexes many application-level connections over
   fewer real database connections — the same cap-the-shared-resource idea
   as a bulkhead, applied specifically to a database's hard connection
   limit.
5. MVCC's old row versions accumulate as dead tuples until vacuumed —
   infrequent vacuuming produces a gradual, confusing performance
   degradation that's diagnosable once you understand the mechanism behind
   it, and mysterious if you don't.
