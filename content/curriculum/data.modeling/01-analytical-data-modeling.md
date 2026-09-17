---
title: Analytical data modeling
minutes: 18
summary: Star schemas and grain — the same relational tools from the SQL chapter, deliberately reorganized around questions instead of writes.
---

The Relational Modeling and SQL chapter's normalization discipline optimizes
for a specific goal: a write updates exactly one place, with no duplicated
data to keep in sync. Analytical modeling optimizes for a genuinely
different goal — a read touching millions of rows should be fast and
simple to write — and that different goal justifies deliberately
reintroducing the duplication normalization spent a whole chapter
eliminating.

## OLTP vs OLAP: two different jobs, two different schemas

```text
  OLTP (normalized, the SQL chapter's discipline)
    → many SMALL, targeted writes and point reads — "update
      THIS order's status," "fetch THIS customer's profile" —
      normalization's no-duplicate-data guarantee is exactly
      right here, because each write touches one small,
      well-defined place

  OLAP (star schema, THIS chapter)
    → FEW, LARGE, aggregate-heavy reads — "total revenue by
      region by month, for the last two years" — a query
      touching millions of rows across many joined tables is
      the NORMAL case, not an edge case
```

```text
  → these are genuinely different workloads with genuinely
    different right answers, not one schema style being
    objectively "correct" and the other a compromise — this
    project's own soft-deletes-everywhere, normalized backend
    schema is optimized for OLTP because that's what a
    production application actually does; a data warehouse
    built for ANALYTICS reporting is optimized differently, on
    purpose, for a different job.
```

## The star schema: one fact table, many dimension tables

```text
                    ┌──────────────┐
                    │  dim_date     │
                    └───────┬──────┘
                            │
  ┌──────────────┐  ┌──────┴───────┐  ┌──────────────┐
  │ dim_customer  ├──┤  fact_orders  ├──┤  dim_product  │
  └──────────────┘  └───────────────┘  └──────────────┘
                            │
                    ┌───────┴──────┐
                    │ dim_region    │
                    └──────────────┘
```

```text
  FACT TABLE      one row per EVENT/MEASUREMENT (one row per
                 order line) — mostly NUMBERS (quantity,
                 price, revenue) plus FOREIGN KEYS pointing out
                 to dimensions — this table gets HUGE (billions
                 of rows, over years of operation)

  DIMENSION TABLE   descriptive CONTEXT about an entity
                 (customer name, product category, region) —
                 relatively SMALL, and DELIBERATELY DENORMALIZED
                 — a customer's full name and address live
                 directly on dim_customer, not split across
                 three normalized tables an analyst would need
                 to join every single time
```

```text
  → the payoff: "revenue by region, by month" becomes ONE join
    of the (enormous) fact table against TWO (small) dimension
    tables — a query an analyst can actually WRITE by hand and
    a query engine can actually execute FAST, rather than a
    six-table join across a fully normalized OLTP schema that
    was never designed with this access pattern in mind.
```

## Grain: the single most important modeling decision

```text
  the GRAIN of a fact table is WHAT ONE ROW REPRESENTS — and
  getting it wrong is the single most common, most damaging
  analytical modeling mistake, because it's a decision that's
  genuinely painful to change after real queries and dashboards
  already depend on it.

    "one row per ORDER"          → cannot answer "revenue by
                                     PRODUCT," since a multi-
                                     item order has no single
                                     product to attribute it to

    "one row per ORDER LINE ITEM" → CAN answer both "revenue by
                                     order" (sum the lines) AND
                                     "revenue by product" — the
                                     FINER grain can always
                                     answer a coarser question
                                     by aggregating UP, but a
                                     coarse grain can never
                                     answer a finer question —
                                     the detail simply isn't
                                     there to recover
```

```text
  → the practical rule: pick the FINEST grain that's genuinely
    useful for the actual questions this data needs to answer
    — coarsening later (aggregating up) is easy and always
    possible; going FINER later requires re-loading the
    ENTIRE fact table from source data, if that source data is
    even still available and unchanged by then.
```

## Slowly changing dimensions: history that a plain UPDATE destroys

```text
  a customer moves from the "West" region to the "East" region
  — an OLTP system correctly UPDATES the row (there IS only one
  current truth: where they live NOW).

  → an ANALYTICAL system asking "what was LAST QUARTER's
    revenue by region" needs to know WHERE THE CUSTOMER WAS AT
    THE TIME of last quarter's orders — a plain UPDATE
    (overwriting "West" with "East") makes this question
    UNANSWERABLE after the fact: every historical order now
    appears to have been made by an "East" region customer,
    retroactively, which is simply false.
```

```text
  TYPE 1 SCD    overwrite (accept losing history — fine for a
               genuine correction, like fixing a typo, where
               there IS no meaningful "history" to preserve)

  TYPE 2 SCD      INSERT a new row, with valid-from/valid-to
               dates, rather than updating the existing one —
               preserves the FULL history, and a query joins
               against whichever version of the dimension row
               was VALID at the time of the fact being analyzed

  TYPE 3 SCD       keep just the PREVIOUS value in an extra
               column (current_region, previous_region) —
               a middle ground: some history, bounded, not the
               full sequence of every change ever made
```

```text
  → Type 2 is the standard choice when history genuinely
    matters (which is most analytical modeling) — it's this
    project's own event-sourcing chapter's "never overwrite,
    only append" discipline, applied specifically to slowly
    changing descriptive attributes rather than to every write
    in the system.
```

## Modeling for questions, not for writes

```text
  the entire chapter's underlying reframe: an OLTP schema is
  shaped by what the APPLICATION needs to WRITE correctly and
  efficiently — an analytical schema is shaped by what
  QUESTIONS an analyst or a dashboard needs to ANSWER
  correctly and efficiently, and those two shapes are
  genuinely, deliberately different, not one being a lazier
  version of the other.
```

## What to take away

1. OLTP (normalized, from the SQL chapter) and OLAP (star schema, this
   chapter) optimize for genuinely different workloads — many small
   targeted writes vs few large aggregate-heavy reads — neither is a
   compromise version of the other.
2. A star schema's deliberate denormalization on dimension tables is what
   turns a multi-table analytical query into one or two joins against a
   huge fact table, rather than a six-table OLTP-shaped join.
3. Grain — what one fact row represents — is the single most consequential
   modeling decision: a finer grain can always answer a coarser question by
   aggregating up, but a coarse grain can never recover detail that was
   never captured.
4. A plain UPDATE on a dimension destroys the ability to answer "what was
   true at the time" for historical facts — Type 2 slowly changing
   dimensions preserve that history by inserting a new row instead of
   overwriting.
5. Type 2 SCD is this project's own event-sourcing "never overwrite, only
   append" discipline, applied specifically to descriptive attributes that
   change slowly over time rather than to every write in the system.
