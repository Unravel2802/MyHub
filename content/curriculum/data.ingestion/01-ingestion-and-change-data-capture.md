---
title: Ingestion and change data capture
minutes: 18
summary: Getting data from a live production database into a warehouse — without querying the production database into the ground doing it.
---

Every warehouse chapter so far assumed data was already there. This chapter
is how it actually arrives — and the naive approach (just query the
production database repeatedly) creates a genuine conflict between the
system that needs to stay fast for real users and the system that wants to
read all of it for analytics.

## Batch extraction: the simple, naive starting point

```text
  SELECT * FROM orders WHERE updated_at > '2026-01-01';

  → periodically querying for ROWS THAT CHANGED since the last
    extraction — simple to reason about, and genuinely fine at
    small scale.

  → the problem at real scale: this query runs AGAINST THE SAME
    production database real users' requests are hitting — a
    large analytical extraction query competes for the SAME
    resources (the Database Internals chapter's buffer pool,
    connection slots) as production traffic, and a naive,
    frequent, unbounded extraction query is a genuine, common
    cause of production slowdowns that have NOTHING to do with
    actual user load.
```

## Change Data Capture: reading the write-ahead log instead of querying the table

```text
  the Database Internals chapter's WAL already records EVERY
  write, in order, DURABLY, for crash recovery — CDC's genuinely
  clever move: read THAT SAME LOG, as a STREAM of change events,
  instead of separately QUERYING the table for what changed.

    INSERT order 42     → {op: "insert", table: "orders",
                            after: {...}}
    UPDATE order 42       → {op: "update", before: {...},
                            after: {...}}
    DELETE order 42        → {op: "delete", before: {...}}
```

```text
  → this SIDESTEPS the batch-query problem structurally: reading
    a WAL is a fundamentally CHEAP, SEQUENTIAL, append-only-log
    operation the database ALREADY performs for its own crash
    recovery — it adds essentially NO extra query load to
    production, because it's not a QUERY against the table at
    all; it's the database's own durability mechanism, read a
    second time, for a second purpose.
```

```text
  → CDC ALSO captures DELETES correctly, which a naive
    `updated_at > X` batch query structurally CANNOT — a
    deleted row simply isn't THERE anymore to be selected by any
    query; the WAL, by contrast, has an explicit DELETE event
    recorded, because the database needed that record for its
    own crash-recovery correctness regardless of any downstream
    analytical consumer.
```

## CDC events flow through a message queue

```text
  production DB's WAL → CDC connector (Debezium is the
  well-known example) → Kafka/a message queue (the Messaging
  and Event Streaming chapter's territory) → the warehouse

  → this is the Queues and Async Jobs chapter's at-least-once
    delivery guarantee, reappearing here: a CDC pipeline can
    deliver the SAME change event more than once, which means
    the WAREHOUSE-SIDE consumer needs the SAME idempotent-write
    discipline (an upsert keyed on a unique event id, rather
    than a blind append) that any other at-least-once consumer
    needs.
```

## Schema drift: the production database changes, and the pipeline has to notice

```text
  → a column added, renamed, or removed in the SOURCE production
    database is a REAL, RECURRING operational event for an
    ingestion pipeline — not a rare edge case. this is the
    Serialization and Schemas chapter's compatibility problem,
    reappearing here specifically because the SOURCE system
    (the production application) and the DOWNSTREAM system (the
    warehouse) are maintained by DIFFERENT people, on DIFFERENT
    release schedules, who may not even know the other exists
    or depends on this exact shape.
```

```text
  → the practical response: DETECT a schema change automatically
    (rather than a downstream job silently breaking or silently
    dropping a new column with no alert at all), and either
    adapt automatically for a SAFE, additive change (a new
    optional column) or ALERT loudly for a BREAKING one (a
    column renamed or removed) — silent, undetected schema
    drift is a genuinely common, real cause of a dashboard
    quietly showing WRONG numbers for weeks before anyone
    notices something's off.
```

## Backfills: loading history that predates the pipeline

```text
  → a NEWLY built pipeline typically needs to load HISTORICAL
    data that existed BEFORE the pipeline itself started running
    — a ONE-TIME batch load of everything that already existed,
    followed by ONGOING incremental CDC for everything NEW from
    that point forward.

  → the genuinely tricky part: correctly handling the
    HANDOFF between the one-time backfill and the ongoing
    stream, without either DUPLICATING data that both captured
    (the backfill AND the stream both covering the same
    transition-period rows) or LOSING data that fell in the
    genuine gap between exactly where the backfill's snapshot
    ended and exactly where the stream's capture began —
    getting this boundary precisely right is a real, common
    source of subtle, hard-to-detect data-completeness bugs in
    a newly launched pipeline.
```

## What to take away

1. A naive batch extraction query competes for the same production database
   resources as real user traffic — a genuine, common cause of production
   slowdowns unrelated to actual user load.
2. CDC reads the database's own write-ahead log instead of querying the
   table, which is fundamentally cheap because it's the database's existing
   crash-recovery mechanism read a second time, not a new query against
   production data.
3. CDC captures deletes correctly where a naive `updated_at` batch query
   structurally cannot — a deleted row isn't there to be selected, but the
   WAL has an explicit delete event.
4. A CDC pipeline delivers at-least-once, which means the warehouse-side
   consumer needs the same idempotent-upsert discipline as any other
   at-least-once queue consumer.
5. Undetected schema drift between a production database and a downstream
   pipeline is a real, common cause of a dashboard quietly showing wrong
   numbers for weeks — detecting it automatically, and distinguishing safe
   additive changes from breaking ones, is the practical response.
