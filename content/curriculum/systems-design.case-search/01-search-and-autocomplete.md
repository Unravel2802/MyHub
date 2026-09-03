---
title: "Case: search and autocomplete"
minutes: 19
summary: The index build and serve paths, and why autocomplete is a different system.
---

Design search over a large corpus, plus autocomplete. They look like one feature
and are two systems with different latency budgets, different data structures and
different freshness requirements.

## Requirements and scale

```text
  SEARCH
    full-text over 1B documents
    < 200 ms
    relevance ranking, filters, facets
    near-real-time indexing (seconds to minutes)

  AUTOCOMPLETE
    < 50 ms — it fires on every keystroke
    prefix matching, typo tolerance
    personalised and trending suggestions
```

```text
  10,000 searches/second
  autocomplete: ~5 requests per search (one per keystroke)
    → 50,000/s, at a QUARTER of the latency budget
```

That ratio is the reason they are separate systems: autocomplete is five times the
volume at a quarter of the budget, and it cannot run through the search path.

## The inverted index

```text
  term      → posting list (document ids, positions, scores)

    "database"  → [3, 17, 42, 108, ...]
    "design"    → [17, 42, 91, ...]

  a query for both intersects the lists.
```

```text
  the build path

    document ──▶ analyse ──▶ tokenize ──▶ normalise
                          ──▶ stem / lemmatise
                          ──▶ remove stopwords (maybe)
                          ──▶ post to the index
```

```text
  ANALYSIS is where search quality is won or lost, and it
  must be IDENTICAL at index time and query time —
  otherwise the query's tokens do not match the index's.

  → the same skew problem as ML feature pipelines, in a
    different setting
```

## Sharding and replication

```text
  1B documents, ~1 KB each = 1 TB of source, ~300 GB indexed

  SHARD by document id (not by term)
    → each shard holds a complete index of ITS documents
    → a query goes to EVERY shard, and results are merged

  REPLICATE each shard for read throughput and availability
```

```text
  query flow

    coordinator
      ├─▶ shard 1 ─┐
      ├─▶ shard 2 ─┼─▶ each returns its top k
      ├─▶ shard 3 ─┤
      └─▶ shard N ─┘
             │
        merge, re-rank, return the global top k
```

```text
  the tail-latency problem, from the fundamentals topic

    the query is as slow as the SLOWEST shard.
    with 50 shards, a p99 shard latency becomes the typical
    query latency.

  → hedged requests to a replica
  → or return partial results past a deadline, marked
    incomplete
```

## Ranking

```text
  the two-stage funnel, again

    RETRIEVE   BM25 over the inverted index → top 1,000
    RE-RANK    a learned model over ~100 features → top 10
```

```text
  signals
    TEXTUAL      BM25, field weights, exact-phrase match
    QUALITY      authority, freshness, engagement history
    PERSONAL     the user's history and location
    CONTEXT      device, time, session
```

**Hybrid retrieval** applies here as in the RAG chapter: BM25 for exact terms and
rare tokens, dense embeddings for semantic matching, fused by reciprocal rank —
because embeddings lose exactly the identifiers and proper nouns BM25 finds.

## Indexing freshness

```text
  the segment design, from the vector-search topic

    writes go to a small in-memory segment
    it is periodically SEALED and written
    queries search ALL segments and merge
    segments MERGE in the background

  → near-real-time visibility (seconds) with an efficient
    on-disk structure
  → deletes are tombstones, reclaimed at merge
```

```text
  the trade
    more frequent sealing → fresher, more segments,
                            slower queries
    less frequent         → staler, fewer segments, faster
```

## Autocomplete

```text
  a DIFFERENT system: a trie, in memory.

              (root)
              /    \
            d       s
            |       |
            a       y
            |       |
            t       s
           / \
          a   e
          |   |
      "data" "date"
```

```text
  □  each node stores the TOP k completions for its prefix,
     PRECOMPUTED
  □  → a lookup is a prefix walk plus a read, not a search
  □  the whole trie fits in memory: 10M queries × ~50 B
     ≈ 500 MB
  □  rebuilt periodically from query logs, not updated per
     event
```

```text
  TYPO TOLERANCE
    edit distance ≤ 1 or 2, via a fuzzy trie walk or a
    precomputed deletion index
    → and it costs; apply it only when the exact prefix
      returns too few results

  RANKING
    query frequency, recency, personalisation, trending
    → recompute the trie hourly from a rolling window
```

**Autocomplete is a precomputation problem, not a search problem.** Once the top-k
per prefix is materialised, serving is a hash lookup — which is what makes 50 ms
achievable at 50,000 QPS.

## Caching

```text
  query distribution is a power law: a small number of
  queries are a large fraction of traffic.

    □  cache the RESULT for popular queries — a high hit rate
    □  cache the autocomplete response per prefix
    □  normalise the cache key: lowercase, trim, sort filters
    □  short TTL for freshness-sensitive corpora
```

## Components

```text
  documents ──▶ [indexing pipeline] ──▶ [index shards ×N]
       │                                      ▲
       └──▶ CDC from the source of truth      │
                                              │
  query ──▶ [query service] ──▶ [coordinator]─┘
                │                     │
                ├─▶ [result cache]    └─▶ merge + re-rank
                │
  keystroke ──▶ [autocomplete service] ──▶ [trie, in memory]
                                             ▲
                        query logs ──▶ [hourly trie build]
```

## What to take away

1. Search and autocomplete are separate systems: autocomplete is several times the
   volume at a quarter of the latency budget.
2. Analysis must be identical at index and query time, or the query's tokens do not
   match the index's — the same skew problem as ML feature pipelines.
3. Shard by document, query every shard, and merge — which makes the slowest shard
   the query's latency, so hedging or partial results are needed.
4. Retrieve then re-rank, with hybrid BM25 plus dense retrieval because embeddings
   lose exact identifiers.
5. Segment-based indexing gives near-real-time freshness with an efficient on-disk
   structure, trading segment count against query speed.
6. Autocomplete is a precomputation problem — top-k per prefix in an in-memory
   trie, rebuilt periodically from query logs.

Next: payments and ledgers.
