---
title: Operating a retrieval system
minutes: 19
summary: Updates, embedding versions and hybrid search — where the real difficulty is.
---

Choosing an index is the easy part. The operational difficulties are keeping the
index current, surviving an embedding model change, and the fact that pure vector
search is usually worse than combining it with keyword search.

## Updates: the awkward part

```text
  INSERT   HNSW: fine, incremental
           IVF:  fine, appended to a list; clustering
                 degrades over time

  UPDATE   = delete + insert

  DELETE   the genuinely hard one
           HNSW: removing a node breaks graph connectivity
           → mark a TOMBSTONE, filter at query time
           → tombstones accumulate; recall degrades; rebuild
             periodically
```

The pattern that production systems converge on is borrowed from search engines:

```text
  SEGMENT-BASED INDEXING

  ┌──────────┬──────────┬──────────┬────────┐
  │ segment1 │ segment2 │ segment3 │ buffer │
  │ (sealed) │ (sealed) │ (sealed) │(active)│
  └──────────┴──────────┴──────────┴────────┘

  writes go to the small active buffer
  when full, the buffer is SEALED and indexed
  queries search ALL segments and merge results
  deletions are tombstones in a per-segment bitmap
  segments MERGE in the background, dropping tombstones
```

This is exactly Lucene's design, and it resolves the tension between fast writes
and a good index: writes are cheap appends, the expensive index build happens in
the background, and merging reclaims deleted space.

**The cost is query fan-out** — searching ten segments and merging is more work
than searching one — which is why merge policy matters: too few merges and query
latency degrades, too many and you spend all your I/O rebuilding.

## Embedding model versions

The migration that catches teams out, and it has no partial answer:

```text
  vectors from model v1 and model v2 are in DIFFERENT SPACES.

  → distances between them are MEANINGLESS
  → you cannot mix them in one index
  → changing the embedding model means RE-EMBEDDING EVERYTHING
```

```text
  100M documents, re-embedding at 1,000 docs/second
    = 28 hours of GPU time, plus the index rebuild
```

The safe migration is the expand/contract pattern from the distributed track:

```text
  1. build a SECOND index with v2, in parallel
  2. dual-write new documents to both
  3. backfill historical documents into v2
  4. evaluate v2 against v1 on a query set
  5. shift query traffic gradually (canary)
  6. drop v1 once nothing reads it
```

```text
  → plan for 2× storage and 2× embedding cost during the
    migration, and treat the embedding model version as part
    of the index's identity so a mismatch is impossible to
    introduce accidentally
```

That last point prevents the worst version of this failure: a query embedded with
v2 searched against a v1 index returns confident, wrong results with no error.
Tagging the index with its model version and checking it at query time is a few
lines that make the mistake impossible.

## Hybrid search

Pure vector search is usually worse than vector plus keyword, and this surprises
people who expect embeddings to have superseded lexical matching.

```text
  DENSE (vector)                     SPARSE (BM25 / keyword)
  ✓ semantic similarity              ✓ EXACT terms
  ✓ paraphrase, synonyms             ✓ rare words, IDs, codes
  ✓ cross-lingual                    ✓ names and acronyms
  ✗ misses exact identifiers         ✗ no synonym understanding
  ✗ weak on rare terms               ✗ vocabulary mismatch
```

```text
  the query "error TS2345"

    dense:  returns semantically similar error discussions,
            possibly not that code at all
    sparse: returns exactly the documents containing TS2345
```

Embeddings compress meaning, and in doing so lose the ability to match a specific
rare token. That is precisely what BM25 is good at, which is why the two are
complementary rather than competing.

```text
  COMBINING THEM

  RECIPROCAL RANK FUSION (RRF)
    score(d) = Σ over retrievers  1 / (k + rank(d))
    → needs no score normalisation, robust, k ≈ 60
    → the sensible default

  WEIGHTED SCORES
    α · normalise(dense) + (1-α) · normalise(sparse)
    → needs score normalisation, which is fiddly because the
      two score distributions are unrelated
```

**RRF is the right default** because it operates on ranks rather than scores, so
it sidesteps the normalisation problem entirely.

## Reranking

The second stage that usually matters more than the first:

```text
  RETRIEVE          100–1,000 candidates, fast, approximate
                    (bi-encoder: query and document embedded
                     independently)
       │
       ▼
  RERANK            top 10–50, slow, accurate
                    (cross-encoder: query and document
                     processed TOGETHER)
```

```text
  BI-ENCODER              CROSS-ENCODER
  embed separately        process the PAIR jointly
  → documents can be      → cannot be precomputed; must run
    precomputed             per (query, document) pair
  → fast: a dot product   → slow: a model forward pass
  → less accurate         → MUCH more accurate
```

The division of labour is forced by precomputation: a bi-encoder can index a
billion documents because their embeddings do not depend on the query; a
cross-encoder cannot, but is far more accurate on the few hundred candidates it
can afford to score.

**Reranking typically improves relevance more than any retrieval tuning**, and it
is the highest-value addition to a naive vector-search system. The cost is latency
proportional to the candidate count, so the tuning question is how many candidates
the reranker sees.

## Chunking

For document retrieval, how text is split matters as much as the index:

```text
  TOO SMALL   loses context; a chunk that answers nothing
              on its own
  TOO LARGE   dilutes the embedding; the relevant sentence
              is averaged with irrelevant ones

  typical: 200–500 tokens with 10–20% overlap
```

```text
  better than fixed-size splitting:

  □  SEMANTIC / STRUCTURAL — split on headings, paragraphs,
     sections; never mid-sentence
  □  add CONTEXT to each chunk: the document title and section
     heading, so an isolated chunk is interpretable
  □  keep tables and code blocks intact
  □  store a pointer to the surrounding text, and expand at
     retrieval time
```

The last two are where quality gains hide. A chunk containing half a table
embeds poorly and reads worse; a chunk prefixed with its document and section
title is far more retrievable, because the embedding then encodes what it is
about as well as what it says.

## Evaluation

```text
  RETRIEVAL METRICS
    recall@k           is the right document in the top k?
    MRR                how high is the first relevant one?
    NDCG@k             ranking quality with graded relevance

  END-TO-END (what actually matters)
    for RAG: answer correctness, groundedness, citation accuracy
    for recommendation: engagement, conversion
```

```text
  build a small labelled query set — 100–300 queries with
  known relevant documents — and run it in CI.

  it catches:
    □  a chunking change that degrades retrieval
    □  an embedding model change
    □  an index parameter regression
    □  a filter bug
```

**A retrieval evaluation set in CI is the highest-value test in a RAG system**,
because every component change silently affects retrieval quality and nothing
else detects it. Building it is a day of labelling and pays for itself the first
time someone changes the chunk size.

## Operations

```text
  □  INDEX BUILD TIME — a full rebuild's duration bounds your
     recovery and migration options
  □  MEMORY — HNSW must be resident; know the growth curve
  □  QUERY LATENCY p99, and RECALL, tracked together
  □  index freshness — how long from write to searchable?
  □  segment count and merge backlog
  □  tombstone ratio — rising means recall is degrading
  □  embedding model version, recorded on the index
```

The freshness metric is the one users notice: a document uploaded and not findable
for ten minutes is a product problem that no retrieval metric shows.

## What to take away

1. Deletion is the hard operation; segment-based indexing with background merges
   is the pattern that reconciles fast writes with a good index.
2. Vectors from different embedding models are incomparable — changing the model
   means re-embedding everything, and the index must carry its model version.
3. Pure vector search misses exact identifiers and rare terms; hybrid dense+sparse
   with reciprocal rank fusion is the sensible default.
4. Cross-encoder reranking over a few hundred candidates improves relevance more
   than any retrieval tuning.
5. Chunk on structure rather than fixed size, and prefix chunks with document and
   section titles so they are interpretable alone.
6. A 100–300 query labelled evaluation set in CI is the highest-value test in a
   retrieval system, because every component change affects it silently.

That completes vector search. Next in the track: **ML monitoring and drift** —
detecting that a deployed model has stopped working.
