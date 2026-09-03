---
title: Search and indexing
minutes: 18
summary: Inverted indexes, ranking, and the hardest part in practice — keeping a search index in sync with a source of truth it doesn't own.
---

A database index (backend.sql) speeds up an exact or range lookup on a known
column. Search is a different problem: "find documents matching these words,
ranked by relevance" — and it needs a fundamentally different data structure
to answer efficiently.

## The inverted index

```text
  FORWARD index (what a database has):
    doc 1 → "the quick brown fox"
    doc 2 → "the lazy dog"

  INVERTED index (what search needs):
    "quick" → [doc 1]
    "the"   → [doc 1, doc 2]
    "lazy"  → [doc 2]
```

```text
  a query for "quick dog" intersects the postings lists for
  "quick" and "dog" — fast, because each term's list is
  precomputed, rather than scanning every document's text at
  query time.
```

## Analyzers: turning text into terms

```text
  "The Quick Brown Foxes" →

    1. TOKENIZE     ["The", "Quick", "Brown", "Foxes"]
    2. LOWERCASE     ["the", "quick", "brown", "foxes"]
    3. STOP WORDS     ["quick", "brown", "foxes"]
                      (remove "the" — too common to be useful)
    4. STEM/LEMMATIZE  ["quick", "brown", "fox"]
                      (foxes → fox, so a search for "fox"
                       matches a document containing "foxes")
```

```text
  → the analyzer is a design decision, not a default to
    accept blindly: stemming "university" and "universe" to
    the same root (both can stem toward "univers") is a real
    failure mode of aggressive stemming, and language-specific
    analyzers matter — English stemming rules produce wrong
    results on other languages.
```

## Ranking

```text
  TF-IDF, and its refinement BM25 (what Elasticsearch uses
  by default):

    TERM FREQUENCY    how often does the term appear in
                       THIS document — more occurrences,
                       higher relevance, with diminishing
                       returns (BM25 caps this; raw TF-IDF
                       does not)

    INVERSE DOCUMENT   how RARE is this term across ALL
    FREQUENCY          documents — "the" appears everywhere
                       and scores low; a rare technical term
                       scores high
```

```text
  a document matching a RARE query term ranks above one
  matching only a COMMON term, even with fewer total matches
  — this is why "the api documentation" ranks documents
  containing "api" and "documentation" heavily, and barely
  weights "the" at all, without anyone hand-tuning that.
```

```text
  → ranking can be tuned further with FIELD BOOSTS (a title
    match counts more than a body match) and business signals
    (recency, popularity) blended in — but BM25 on well-
    analyzed text is a strong, unglamorous default before
    reaching for anything more elaborate.
```

## Faceting

```text
  a facet is a COUNT alongside the results, not just the
  results themselves:

    "laptop" → 340 results
      Brand:  Dell (89)  HP (76)  Apple (62)  ...
      Price:  $0-500 (120)  $500-1000 (150)  ...
```

```text
  → computed via the same inverted index, aggregated per
    facet field at query time — this is why facet fields
    need their OWN indexed representation (often
    un-analyzed/"keyword" — "New York" as one term, not
    tokenized into "new" and "york") separate from the
    full-text-searchable version of the same field.
```

## Keeping the index in sync

```text
  the source of truth is the database. the search index is a
  DERIVED, denormalized copy — and derived data can drift
  from its source.
```

```text
  SYNCHRONOUS   write to DB, then write to index, in the
                same request
                → simple, but the index write can fail after
                  the DB commit succeeds, leaving them out of
                  sync with no automatic recovery

  ASYNCHRONOUS  write to DB → emit an event → a consumer
                updates the index
                → the DB write's success doesn't depend on
                  the index; the index lags by the queue's
                  processing time, and needs retry/dead-letter
                  handling like any consumer
                  (see backend.queues)

  PERIODIC       a scheduled job reindexes changed rows
  REINDEX         → simplest to reason about, highest lag,
                   and a useful BACKSTOP even alongside one
                   of the above, to correct any drift they
                   miss
```

```text
  → most production systems run async updates for freshness
    PLUS a periodic full reindex as a backstop against the
    drift async updates alone will eventually accumulate —
    treating the search index as eventually consistent with
    the database by design, not as an afterthought.
```

## What to take away

1. An inverted index maps terms to the documents containing them, which is
   what makes multi-term search fast instead of a per-query full scan.
2. The analyzer (tokenize, lowercase, stop words, stemming) is a design
   decision — aggressive stemming can merge unrelated words, and it's
   language-specific.
3. BM25 ranks a rare matching term above a common one automatically, via
   inverse document frequency — a strong default before reaching for
   field boosts or business signals.
4. Facet counts need a separate, un-analyzed indexed representation of the
   field, distinct from its full-text-searchable version.
5. A search index is derived, denormalized data that can drift from its
   source — async updates for freshness plus a periodic full reindex as a
   backstop is the common, deliberate answer.
