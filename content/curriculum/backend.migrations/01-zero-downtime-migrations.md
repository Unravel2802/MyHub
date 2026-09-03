---
title: Zero-downtime migrations
minutes: 17
summary: Expand/contract, dual writes, and why changing a live schema is a sequencing problem more than a SQL problem.
---

A schema migration that locks a table for even a few seconds is an outage on
any system with continuous traffic. The techniques in this chapter aren't
exotic SQL — they're a sequencing discipline for making a change land across
multiple deploys, each one individually safe.

## Why a single ALTER TABLE isn't safe

```text
  ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';

  on some databases (older Postgres, MySQL without INSTANT
  ADD COLUMN) this REWRITES EVERY ROW to add the default —
  on a 50M-row table, that's an exclusive lock held for
  however long the rewrite takes.
```

```text
  → modern Postgres (11+) makes ADD COLUMN with a constant
    default instant — check your actual database version and
    the specific operation, because the answer depends on
    both, and an assumption that's true for one is a locked
    table on another.
```

```text
  the operation that's ALWAYS dangerous regardless of
  version: adding a NOT NULL constraint to an EXISTING
  column on a large table — validating it against every
  existing row takes a full table scan under lock, unless
  done in the two-step form below.
```

## The expand/contract pattern

```text
  renaming a column safely — the naive single-step version
  breaks any code still deployed against the OLD name the
  instant the migration runs:

    EXPAND    add the NEW column, alongside the old one
              both exist; old code writes the old column,
              nothing yet reads the new one

    BACKFILL   copy existing data: old column → new column
              (in batches — see below, not one giant UPDATE)

    DUAL WRITE  deploy code that writes BOTH columns —
                old code paths still work untouched, new
                code paths start using the new column

    MIGRATE READS  deploy code that reads the NEW column

    CONTRACT   once nothing reads or writes the old column,
              drop it — a separate migration, separate deploy
```

```text
  → five steps, five deploys, for what looks like "just
    rename a column". the discipline exists because a rolling
    deploy runs OLD and NEW code simultaneously — the same
    constraint backend.serialization covers for message
    schemas, applied here to a live database schema instead.
```

## Backfilling in batches

```text
  UPDATE orders SET new_status = old_status;   -- ✗ one giant
                                                 transaction,
                                                 locks every
                                                 row it
                                                 touches until
                                                 commit

  → batch it: UPDATE ... WHERE id BETWEEN X AND X+1000,
    committing between batches, with a short pause — each
    batch's lock is brief, and other transactions get a
    chance to run between batches instead of queuing behind
    one enormous one.
```

```text
  a batched backfill is also RESUMABLE: if it's interrupted
  partway, track the last completed batch and continue from
  there, rather than restarting a multi-hour job from zero.
```

## Adding a NOT NULL constraint safely

```text
  the two-step version that avoids a full-table validating
  scan under an exclusive lock:

    1. ALTER TABLE ... ADD CONSTRAINT ... CHECK (col IS NOT
       NULL) NOT VALID;
       — adds the constraint for FUTURE rows instantly; does
       NOT validate existing rows yet

    2. ALTER TABLE ... VALIDATE CONSTRAINT ...;
       — validates existing rows, but takes only a SHARE lock
       (not exclusive) — concurrent reads and writes continue
```

## Removing a column safely

```text
  the mirror of expand: STOP writing and reading a column in
  the application first (a deploy), confirm nothing depends
  on it, THEN drop it (a separate deploy, separate migration).

  → dropping a column a still-deployed instance is reading
    from turns "cleanup" into an outage — the column removal
    step must come strictly after every instance is confirmed
    running the code that no longer touches it.
```

## Backward-compatible ORM/application code

```text
  the application code deployed DURING a migration must
  tolerate BOTH schema shapes — the old one (some instances
  haven't redeployed yet) and the new one (some have):

    read: prefer new_column if present, fall back to
          old_column
    write: write to whichever step the migration is
           currently at, per the expand/contract sequence
```

```text
  → this is why the migration and the application code
    change ship as SEPARATE, ordered deploys rather than one
    combined change — a single deploy that both adds a
    constraint AND assumes it's already enforced has no safe
    window during its own rollout.
```

## What to take away

1. Whether a schema change locks the table depends on the specific operation
   and database version — check both, rather than assuming any ALTER TABLE is
   instant or that all of them are dangerous.
2. Expand/contract splits a schema change into independently-safe steps (add,
   backfill, dual-write, migrate reads, drop) because a rolling deploy runs
   old and new code simultaneously.
3. Backfill in small, committed batches rather than one giant transaction — a
   batched backfill is also resumable if interrupted.
4. Add a NOT NULL constraint in two steps (NOT VALID, then VALIDATE) to avoid
   an exclusive lock during validation.
5. Application code deployed during a migration must tolerate both the old
   and new schema shapes, which is why the schema change and the code that
   depends on it ship as separate, ordered deploys.
