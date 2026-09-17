---
title: Serving analytics
minutes: 18
summary: OLAP engines and pre-aggregation — getting a dashboard's query, which touches billions of rows, to return in under a second anyway.
---

Every chapter in this track built toward analyzable, well-modeled,
trustworthy data. This final chapter is the last mile: a human is actually
looking at a dashboard right now, waiting for it to load — and a query that
takes 30 seconds against a well-modeled warehouse is still a genuinely
broken user experience, even though nothing about the data itself is wrong.

## The gap between "a correct warehouse query" and "an interactive dashboard"

```text
  a warehouse query scanning a billion-row fact table, even
  with EVERY optimization from the Warehouses chapter (columnar
  storage, partition pruning, predicate pushdown) applied
  correctly, might still take 5-30 SECONDS — genuinely fine for
  an ANALYST running an ad hoc, exploratory query, and
  completely unacceptable for a DASHBOARD a user expects to
  load, interactively, in under a second, the moment they open
  it or change a filter.
```

```text
  → this is a REAL, distinct requirement from "the query is
    correct and reasonably fast" — a dashboard specifically
    needs interactive, near-instant responsiveness, and getting
    there generally needs work done BEFORE the query even runs,
    not merely a faster way of running the SAME exact
    computation against the SAME full-scale raw data every
    single time it's requested.
```

## Pre-aggregation: computing the expensive part in advance

```text
  raw fact table: 1 BILLION individual order-line rows

  pre-aggregated: "revenue by region by day" — maybe 10,000
  rows TOTAL (365 days × ~30 regions), computed ONCE, in
  advance, by a periodic batch job

  → a dashboard querying the PRE-AGGREGATED table reads 10,000
    rows instead of a billion — genuinely instant, because the
    expensive aggregation work already HAPPENED, offline, on
    the batch job's own schedule, well before any user ever
    actually looked at the dashboard and had to wait for it.
```

```text
  → the real, deliberate trade-off: pre-aggregation only
    answers the SPECIFIC questions it was built for in advance
    — "revenue by region by day" cannot answer "revenue by
    INDIVIDUAL CUSTOMER" (that granular detail was deliberately
    discarded, on purpose, during aggregation) — this is
    directly the Grain chapter's "a coarser grain can't answer
    a finer question" point, resurfacing here as a genuine
    engineering design choice rather than an accidental
    limitation nobody intended.
```

## OLAP engines: purpose-built for exactly this trade-off

```text
  → specialized engines (Druid, ClickHouse, Pinot) are
    architected SPECIFICALLY for "many small, fast, aggregate
    queries against pre-indexed, often pre-aggregated data" —
    genuinely different from a general-purpose warehouse engine
    (Snowflake, BigQuery) that's optimized for FLEXIBLE, ad
    hoc, exploratory queries against RAW, unaggregated data,
    where the exact question being asked isn't fully known in
    advance.

  → this is the SAME general shape as the NoSQL and Polyglot
    Persistence chapter's "choose by access pattern"
    reasoning, resurfacing here: a warehouse for flexible
    EXPLORATION, an OLAP engine for FAST, KNOWN, repeated
    dashboard queries — genuinely different tools for
    genuinely different, distinct jobs, not one being simply a
    faster or slower version of the other.
```

## Semantic layers: consistency AND speed, together

```text
  → the Analytics Engineering chapter's semantic/metrics layer
    ALSO plays a role here specifically: a semantic layer can
    intelligently ROUTE a query to whichever pre-aggregation is
    ACTUALLY sufficient to answer it correctly (this exact
    question can be answered from the fast, small, pre-
    aggregated table) or fall back to the raw, full-scale data
    when genuinely necessary (this specific question needs
    detail no pre-aggregation happens to have retained) —
    largely TRANSPARENTLY to whoever's actually asking the
    question, who never needs to manually know or choose which
    underlying table to query.
```

## Caching: the last layer, for the truly repeated question

```text
  → the Caching chapter's discipline, one more time, at the
    VERY top of this entire stack: if the EXACT SAME dashboard
    query runs repeatedly (many different USERS opening the
    SAME shared dashboard, or one person simply refreshing the
    same page) — CACHE the RESULT itself, not merely the
    already-fast pre-aggregated DATA underneath it, and skip
    querying the OLAP engine at all for a genuinely repeated,
    identical request.

  → this is the SAME cache-invalidation question the Caching
    chapter already covered in full — HOW FRESH does this
    number genuinely need to be? a real-time operations
    dashboard needs a very SHORT cache TTL (or none at all); a
    "revenue this quarter" executive summary can reasonably
    tolerate being cached for HOURS, since a number like that
    is never actually changing meaningfully minute to minute
    anyway.
```

## What to take away

1. A dashboard's interactive responsiveness is a distinct requirement from
   "the query is correct and reasonably fast" — getting there generally
   needs work done before the query runs, not a faster way to run the same
   full-scale computation every time.
2. Pre-aggregation trades detail for speed deliberately — a table
   aggregated by region and day genuinely cannot answer a per-customer
   question, the grain chapter's coarser-can't-answer-finer point
   resurfacing as an intentional engineering choice.
3. OLAP engines and general-purpose warehouses are genuinely different
   tools for different jobs (fast known repeated queries vs flexible
   exploration), the same access-pattern-driven choice as picking a
   database.
4. A semantic layer can transparently route a query to whichever
   pre-aggregation actually suffices, or fall back to raw data when
   necessary, without whoever's asking needing to know which table to query.
5. Caching a dashboard's actual result, on top of already-fast
   pre-aggregated data, is the same TTL-freshness trade-off the caching
   chapter covers — how fresh a number genuinely needs to be determines how
   long it's safe to cache.
