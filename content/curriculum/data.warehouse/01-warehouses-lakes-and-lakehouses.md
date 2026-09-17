---
title: Warehouses, lakes, and lakehouses
minutes: 18
summary: Columnar storage and the separation of storage and compute — the two ideas that turned "query a billion rows" into an ordinary operation.
---

A row-oriented database (the Database Internals chapter's B-tree, optimized
for fetching one complete row at a time) is genuinely the wrong tool for an
analytical query that touches every row but only a few columns. This
chapter is the storage layout and architecture built specifically for that
different access pattern.

## Row-oriented vs column-oriented storage

```text
  ROW-ORIENTED (the Database Internals chapter's B-tree world)

    row 1: [id=1, name="A", price=10, category="X"]
    row 2: [id=2, name="B", price=20, category="Y"]

    → stored TOGETHER, row by row — fetching ONE COMPLETE ROW
      (an OLTP point lookup) reads one contiguous chunk

  COLUMN-ORIENTED

    id:       [1, 2, 3, ...]
    name:     ["A", "B", "C", ...]
    price:    [10, 20, 30, ...]
    category: ["X", "Y", "X", ...]

    → stored SEPARATELY, column by column — a query needing
      only price and category (SUM(price) GROUP BY category)
      reads ONLY those two columns' data, never touching name
      or id AT ALL
```

```text
  → this is the actual mechanism behind a columnar warehouse's
    speed on analytical queries: "average order value" touching
    a billion-row fact table only needs to read ONE column's
    worth of bytes, not the entire row's worth × a billion —
    an analytical query typically uses a SMALL fraction of a
    wide table's columns, and columnar storage means you only
    pay for the ones you actually read.
```

## Compression: columnar storage's second, compounding win

```text
  category: ["X","Y","X","X","X","Y","X","X","X","X", ...]

  → values WITHIN one column tend to REPEAT far more than
    values across a whole row do (a "category" column has a
    small number of DISTINCT values repeated millions of
    times) — this is exactly the non-uniform-distribution
    property the Information Theory chapter's compression
    discussion depends on, and columnar storage exposes it
    directly: compressing one column's worth of repetitive
    values achieves FAR better ratios than compressing a row
    with many DIFFERENT, unrelated column types interleaved
    together.
```

## Partitioning: skipping data before you even read it

```text
  orders/
    year=2025/month=01/...
    year=2025/month=02/...
    year=2026/month=01/...

  WHERE year = 2026 AND month = 01

  → a partitioned table lets the query engine SKIP entire
    partitions ENTIRELY based on the query's filter, WITHOUT
    reading a single byte of the skipped data — this is a much
    coarser, cheaper filter than scanning every row and
    checking a WHERE clause per row; PARTITION PRUNING happens
    before any actual row-level work begins at all.
```

```text
  → choosing a partition KEY is choosing which filter pattern
    gets this "skip entirely" benefit — partitioning by DATE
    is the extremely common default specifically because "give
    me last month's data" is the most common analytical query
    shape by a wide margin; a table partitioned on the WRONG
    column provides no pruning benefit for the queries that
    actually run against it.
```

## The warehouse vs the lake: two different original philosophies

```text
  DATA WAREHOUSE     STRUCTURED data, a defined SCHEMA enforced
                     on WRITE, optimized for SQL analytics —
                     Redshift, Snowflake, BigQuery

  DATA LAKE            RAW files (any format — structured,
                     semi-structured, unstructured), NO schema
                     enforced until READ time, cheap OBJECT
                     STORAGE (the Backend Engineering track's
                     File Storage and Media chapter's
                     substrate) as the underlying store
```

```text
  → schema-on-write (the warehouse) catches a data-quality
    problem IMMEDIATELY, at load time, before anything bad is
    stored — schema-on-read (the lake) defers that check,
    trading immediate validation for FLEXIBILITY: a lake can
    ingest data whose eventual SHAPE isn't even known yet, or
    that different consumers will interpret differently,
    without needing to agree on a schema upfront before
    ANY data can be stored at all.
```

## The lakehouse: getting both, via table formats

```text
  → the genuinely new idea: put TABLE FORMAT METADATA (the
    Iceberg/Delta/Hudi formats the File and Table Formats
    chapter covers) directly ON TOP OF raw files in cheap
    object storage — this gets a warehouse's SCHEMA
    ENFORCEMENT, ACID TRANSACTIONS, and QUERY OPTIMIZATION
    (partition pruning, statistics) WHILE keeping a lake's
    cheap, flexible, OPEN file-based storage underneath, rather
    than being forced to choose one philosophy or the other
    entirely.
```

## Separation of storage and compute: the architectural shift underneath all of this

```text
  the OLD model: storage and compute are the SAME machine — to
  scale QUERY capacity, you also had to (expensively) scale
  STORAGE, even if storage wasn't actually the bottleneck.

  → modern warehouses/lakehouses SEPARATE the two: data sits in
    cheap OBJECT STORAGE, and COMPUTE (query engines) SCALES
    INDEPENDENTLY, spinning up ONLY when a query actually runs
    — this is the Cloud Primitives chapter's compute-spectrum
    idea and the Serverless and Edge chapter's scale-to-zero
    idea, both applied specifically to analytical query
    engines: pay for compute only while a query is actually
    executing, rather than for a permanently-provisioned
    cluster sized for PEAK load that sits mostly idle.
```

## What to take away

1. Columnar storage reads only the columns a query actually touches, which
   is the direct mechanism behind an aggregate query over a billion-row
   table only paying for a fraction of that table's total bytes.
2. Values within one column repeat far more than values across a row do,
   which is exactly the non-uniform-distribution property that makes
   columnar compression ratios dramatically better than row-oriented
   compression.
3. Partition pruning skips entire partitions before any row-level work
   begins — choosing the right partition key means choosing which query
   filter pattern actually benefits from that skip.
4. A warehouse enforces schema on write (catching problems immediately); a
   lake defers to schema on read (trading immediate validation for
   ingesting data whose shape isn't agreed upon yet) — a real trade-off,
   not one being strictly better.
5. Separating storage from compute lets query capacity scale independently
   of data volume, paying for compute only while a query actually runs —
   the same scale-to-zero idea serverless applies, aimed at analytical
   query engines specifically.
