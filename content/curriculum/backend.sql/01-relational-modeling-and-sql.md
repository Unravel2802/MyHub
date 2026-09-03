---
title: Relational modeling and SQL
minutes: 20
summary: Normalization, joins, and reading a query plan well enough to know why a query is slow.
---

Relational modeling is the one skill nearly everything else in Backend and
Systems Design assumes you already have. This chapter is not a SQL syntax
tour — it is the reasoning behind normalization, when to break it, and how to
read a query plan instead of guessing.

## Normalization, briefly and practically

```text
  1NF   atomic columns             no "tags: a,b,c" in one cell
  2NF   no partial key dependency  (matters for composite keys)
  3NF   no transitive dependency   a fact depends on the KEY,
                                    the whole key, and nothing
                                    but the key
```

```text
  the practical version of 3NF: if you can update a fact in
  one row and now a DIFFERENT row is lying, you have an
  update anomaly.

    orders(id, customer_id, customer_email, total)
                            ^^^^^^^^^^^^^^^
    customer_email belongs to customers, not orders — change
    a customer's email and every past order's copy is now
    wrong, unless you remember to update N rows.
```

```text
  → normalize by default. denormalize DELIBERATELY, for a
    measured reason (avoiding a join on a hot path), and
    document what keeps the duplicate copies in sync.
```

## Keys and relationships

```text
  PRIMARY KEY     uniquely identifies a row
                  surrogate (auto-increment / UUID) vs
                  natural (an existing unique attribute) —
                  prefer surrogate; natural keys have a way
                  of turning out not to be unique later
                  (see backend.migrations for what changing
                  one costs)

  FOREIGN KEY     enforces that a reference points to a row
                  that actually exists
                  → ON DELETE: CASCADE / RESTRICT / SET NULL
                  → this project's own rule is soft deletes
                    everywhere, which sidesteps most FK
                    cascade decisions entirely
```

```text
  one-to-many       orders.customer_id → customers.id

  many-to-many      needs a JOIN TABLE
    order_items(order_id, product_id, quantity)
    — not a comma-separated column on either side
```

## Joins

```text
  INNER JOIN   rows present on BOTH sides
  LEFT JOIN    all of the left, NULLs where the right has
               no match
  → LEFT JOIN is what you want for "customers and their
    orders, including customers with none"; INNER silently
    drops them
```

```text
  a LEFT JOIN with a WHERE clause on the right table's
  column silently becomes an INNER JOIN:

    SELECT * FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE o.status = 'shipped'
    -- customers with ZERO orders are dropped: their o.status
    -- is NULL, and NULL = 'shipped' is never true

  → put the condition in the JOIN's ON clause instead, if the
    row itself should still appear
```

## Indexes

```text
  a B-TREE index is a sorted structure: lookups, range scans
  and ORDER BY on the indexed column are all fast.

  WITHOUT an index on customer_id:
    SELECT * FROM orders WHERE customer_id = 42
    → full table scan, O(n) rows read

  WITH one:
    → O(log n) to find the start, then a scan of just the
      matching rows
```

```text
  a COMPOSITE index (customer_id, created_at) serves:
    ✓  WHERE customer_id = 42
    ✓  WHERE customer_id = 42 AND created_at > ...
    ✗  WHERE created_at > ...   (leftmost column not used)

  → column order in a composite index is a design decision,
    not an implementation detail. put the equality column
    before the range column.
```

```text
  an index is not free: every write updates every index on
  the table. a table with eight indexes on a write-heavy path
  pays eight index maintenance costs per insert.

  → index for the reads that actually happen, not every
    column that theoretically could be filtered on.
```

## Reading a query plan

```text
  EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;

  Seq Scan on orders  (cost=0.00..2450.00 rows=3 width=97)
                      (actual time=12.4..18.9 rows=3 loops=1)
    Filter: (customer_id = 42)
    Rows Removed by Filter: 99997
```

```text
  Seq Scan          reading every row — the signal to look
                     for a missing index, on a large table

  Index Scan        used the index, fetched matching rows

  Index Only Scan   answered entirely from the index, never
                     touched the table — fastest, only
                     possible when every selected column is
                     IN the index

  cost=X..Y          the planner's ESTIMATE (arbitrary units)
  actual time=X..Y    what really happened, in ms — this is
                       the number to trust
```

```text
  cost estimate and actual time disagreeing by an order of
  magnitude usually means the table's statistics are stale
  (ANALYZE hasn't run recently) — the planner is choosing a
  plan based on a row-count estimate that is simply wrong.
```

## N+1: the query pattern that costs the most in practice

```text
  for each of 50 orders, fetch its customer separately:

    SELECT * FROM orders LIMIT 50;      -- 1 query
    SELECT * FROM customers WHERE id=?; -- × 50, one per order

  → 51 round trips where one JOIN (or one batched
    WHERE id IN (...)) does the same work in 2
```

```text
  this is an ORM default, not a SQL problem — an ORM that
  lazily loads a relationship inside a loop produces exactly
  this shape, and it is invisible in code review unless you
  know to look for a query inside a loop.
```

## Locking, briefly

```text
  SELECT ... FOR UPDATE   locks the selected rows until the
                          transaction ends — read this row
                          knowing you're about to write it,
                          and stop anyone else from doing the
                          same
```

The full machinery of isolation levels, the anomalies each one still permits,
and optimistic-vs-pessimistic concurrency belongs to the Transactions &
Isolation chapter — this chapter is the schema and query layer underneath it.

## What to take away

1. Normalize by default; denormalize for a measured reason and document what
   keeps the duplicated copies in sync.
2. A LEFT JOIN with a filter on the right table's column in WHERE silently
   becomes an INNER JOIN — put the condition in ON if outer rows should
   survive.
3. Composite index column order matters: equality columns before range
   columns, and every index has a write cost, so index for the reads that
   actually happen.
4. In a query plan, trust `actual time` over the cost estimate, and treat a
   large gap between them as a signal that statistics are stale.
5. N+1 is usually an ORM's lazy-loading default producing a query inside a
   loop — look for it there, not in the SQL itself.
