---
title: File and table formats
minutes: 18
summary: Parquet, Arrow, and Iceberg — the specific file formats that make the previous chapter's columnar and lakehouse ideas actually work on disk.
---

The Warehouses, Lakes and Lakehouses chapter described columnar storage and
ACID-on-object-storage as ideas. This chapter is the specific, concrete file
formats those ideas are actually built from — the files a query engine
reads, and the metadata layer that turns a folder of files into something
that behaves like a real, transactional table.

## Parquet: columnar storage as an actual file format

```text
  a Parquet file, internally: data grouped into ROW GROUPS,
  each row group storing each COLUMN's values TOGETHER and
  COMPRESSED (the previous chapter's columnar idea, as actual
  bytes on disk) — plus a FOOTER containing METADATA: min/max
  values per column PER ROW GROUP, among other statistics.

  → that footer metadata is what enables PREDICATE PUSHDOWN:
    a query filtering WHERE price > 1000 can check each row
    group's STORED min/max for price and SKIP an entire row
    group WITHOUT reading its actual data at all, if the
    group's max is already below 1000 — this is the SAME
    partition-pruning idea from the warehouse chapter, applied
    at a FINER grain, WITHIN a single file rather than across
    entire files/partitions.
```

## Arrow: a format for memory, not disk

```text
  → Parquet is optimized for DISK: compressed, optimized for
    STORAGE size and I/O. ARROW is a DIFFERENT columnar format,
    optimized for MEMORY: uncompressed, laid out so a CPU can
    operate on it DIRECTLY without a deserialization step first.

  → the concrete payoff: two DIFFERENT systems (say, a Python
    pandas process and a Spark JVM process) that BOTH support
    Arrow can share data with ZERO serialization/deserialization
    cost between them — this is the Languages and Compilers
    chapter's intermediate-representation idea, applied to DATA
    interchange between systems instead of to a compiler
    pipeline's internal stages: Arrow is the common, standard
    "IR" multiple analytical tools all speak.
```

## The problem neither Parquet nor Arrow solves: transactions on a folder of files

```text
  a folder of Parquet files, with no additional metadata layer,
  is just... a folder of files. it has NO transactional
  guarantees at all:

    ✗  a WRITER crashing HALFWAY through writing new files
       leaves the table in an inconsistent, PARTIALLY-updated
       state — some new files present, others not, with no
       record of which write was "in progress"
    ✗  a READER querying WHILE a writer is actively adding new
       files can see an inconsistent, PARTIAL snapshot —
       some but not all of a batch's new files, which is
       exactly the "dirty read" anomaly the Transactions and
       Isolation chapter already named for a database, now
       reappearing for a folder of files with no isolation
       mechanism at all
```

## Table formats: ACID transactions layered on top of plain files

```text
  Iceberg / Delta Lake / Hudi (the TABLE FORMATS the previous
  chapter referenced) solve EXACTLY this, by adding a
  METADATA LAYER that tracks, via VERSIONED MANIFEST files:

    ✓  which DATA files currently belong to the table (a
       SNAPSHOT — an atomic, point-in-time definition of "the
       table," at each version)
    ✓  COLUMN STATISTICS per file (predicate pushdown, at the
       whole-FILE granularity, one level above Parquet's own
       internal row-group granularity)
    ✓  SCHEMA EVOLUTION history — safely adding, renaming, or
       removing a column over time
```

```text
  → a WRITE atomically SWAPS which manifest is "current" —
    readers querying at ANY moment see one COMPLETE, CONSISTENT
    snapshot (either the old one or the new one, in full, NEVER
    a partial mix of the two) — this is the Database Internals
    chapter's MVCC idea, reimplemented at the FILE-SYSTEM level
    instead of inside a traditional database engine, which is
    precisely what makes ACID transactions possible on top of
    what's fundamentally still just a folder of immutable files
    in object storage.
```

## Time travel: a direct consequence of keeping old snapshots

```text
  SELECT * FROM orders VERSION AS OF '2026-01-15'

  → because OLD manifests/snapshots aren't immediately deleted
    on a write (only eventually garbage-collected, once nothing
    references them and a retention window has passed), a table
    format can query the table AS IT EXISTED AT A PAST POINT IN
    TIME — this is the Database Internals chapter's write-ahead-
    log-enables-point-in-time-recovery idea, appearing again in
    a genuinely different, adjacent context: versioned snapshots
    instead of a replayable log, but the same underlying
    payoff — being able to reconstruct a specific past state on
    demand.
```

## Schema evolution: changing a table's shape without rewriting history

```text
  → adding a column to an OLD Parquet file with no table-format
    metadata layer generally means historical files simply don't
    HAVE that column at all — a table format tracks schema
    CHANGES explicitly, by COLUMN ID rather than by column
    POSITION/name, so OLD files (missing a newer column) are
    still read correctly (the missing column reads as NULL for
    those old rows) — this is the Serialization and Schemas
    chapter's backward/forward compatibility discipline,
    reappearing for a data lake's schema instead of an API's.
```

## Choosing between them

```text
  Parquet + Arrow ALONE (no table format)    fine for
                                              small/simple/
                                              single-writer
                                              data, or when
                                              transactional
                                              guarantees
                                              genuinely aren't
                                              needed

  a table format (Iceberg/Delta/Hudi) on top    needed the
                                              moment MULTIPLE
                                              writers, real
                                              transactional
                                              guarantees, or
                                              schema evolution
                                              over time actually
                                              matter — which,
                                              in practice, is
                                              most real
                                              production data
                                              lakes eventually
```

## What to take away

1. Parquet's per-row-group min/max metadata enables predicate pushdown at a
   finer grain than the warehouse chapter's file/partition-level pruning —
   the same skip-without-reading idea, one level deeper.
2. Arrow is optimized for memory rather than disk, letting different
   systems share data with zero serialization cost — the same intermediate-
   representation idea from compilers, applied to data interchange.
3. A folder of plain Parquet files has no transactional guarantees at all —
   a crashed writer or a concurrent reader can see an inconsistent, partial
   state, the exact dirty-read anomaly transactions already named for
   databases.
4. A table format's atomic manifest swap is MVCC reimplemented at the
   filesystem level, which is what makes ACID transactions possible on top
   of a folder of immutable files.
5. Retained old snapshots enable time travel (the database chapter's
   point-in-time recovery, reappearing here), and column-id-based schema
   tracking is the serialization chapter's compatibility discipline applied
   to a data lake's schema instead of an API's.
