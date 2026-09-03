---
title: Approximate nearest neighbour search
minutes: 19
summary: Why exact search stops working, and the index structures that trade recall for speed.
---

Retrieval by embedding similarity underpins RAG, recommendation, semantic search
and deduplication. The operation is simple — find the k closest vectors — and it is
computationally brutal at scale, which is why every production system uses an
approximation.

## Why exact search fails

```text
  10M vectors × 768 dimensions, float32

  brute force per query:
    10M dot products × 768 multiply-adds = 7.7 GFLOP
    plus reading 10M × 768 × 4 = 30 GB from memory

  → ~15 ms on a fast GPU, ~1 second on a CPU
  → per query. at 1,000 QPS that is 30 TB/s of memory traffic.
```

Exact search is memory-bandwidth-bound and scales linearly with corpus size. It is
genuinely fine below roughly 100k vectors — where a brute-force scan takes
microseconds and needs no index — and untenable above a few million.

**The curse of dimensionality** rules out the classical alternatives: KD-trees and
similar space-partitioning structures degrade to brute force above roughly 20
dimensions, because in high dimensions almost all points are roughly equidistant
and pruning stops working. Embeddings are 384–4096 dimensions.

So the answer is approximation: accept 95–99% recall in exchange for orders of
magnitude less work.

## The distance metrics

```text
  COSINE           similarity by ANGLE; magnitude ignored
                   → the default for text embeddings

  DOT PRODUCT      angle AND magnitude
                   → for recommendation, where magnitude
                     encodes popularity

  EUCLIDEAN (L2)   straight-line distance
                   → for spatial or image embeddings

  on NORMALISED vectors, cosine and dot product rank
  identically, and L2 is monotonically related to both.
  → normalise once at index time and use dot product, which
    is the cheapest.
```

**Use the metric the embedding model was trained with.** A model trained with a
cosine objective indexed under L2 without normalisation produces subtly wrong
neighbours — a bug that degrades quality without failing.

## HNSW

Hierarchical Navigable Small World graphs — the dominant in-memory index.

```text
  a multi-layer graph. upper layers are sparse (long-range
  links); lower layers are dense (local links).

  layer 2:   ●─────────────────────●              few nodes
             │                     │
  layer 1:   ●────●────────●───────●              more
             │    │        │       │
  layer 0:   ●─●─●─●─●─●─●─●─●─●─●─●─●─●─●        ALL nodes

  SEARCH: enter at the top, greedily walk toward the query,
          descend a layer, repeat.
          → coarse jumps first, fine refinement last
```

```text
  complexity: ~O(log N) per query
  recall:     95–99% with reasonable parameters
```

```text
  the parameters

  M                 links per node (16–64)
                    higher → better recall, more memory
  efConstruction    search breadth while BUILDING (100–500)
                    higher → better graph, slower build
  efSearch          search breadth at QUERY time (50–500)
                    higher → better recall, slower query
                    ← the runtime knob: tune recall per query
                      without rebuilding
```

```text
  memory:  vectors + graph
    10M × 768 × 4 bytes           = 30 GB
    10M × M(32) × 4 bytes links   =  1.3 GB
    → the VECTORS dominate, which is why quantisation matters
```

```text
  strengths                  weaknesses
  ─────────                  ──────────
  excellent recall/speed     memory-hungry; must be resident
  no training step           deletion is awkward (tombstones,
  incremental inserts        periodic rebuild)
                             build is slow for large corpora
```

## IVF

Inverted file index — partition the space, search a few partitions.

```text
  1. cluster the vectors into K centroids (k-means)
  2. assign each vector to its nearest centroid
  3. at query time, find the nprobe nearest centroids and
     search ONLY those lists

  ┌─────┬─────┬─────┬─────┐
  │  ●  │  ●  │  ●  │  ●  │   K = 1,000 clusters
  │ ▪▪▪ │ ▪▪▪ │ ▪▪▪ │ ▪▪▪ │
  └─────┴─────┴─────┴─────┘
       ▲     ▲
    query searches nprobe = 2 lists → 1/500 of the corpus
```

```text
  K       typically √N clusters
  nprobe  the runtime recall knob (1–100)

  strengths                  weaknesses
  ─────────                  ──────────
  low memory overhead        needs TRAINING on a sample
  fast build                 recall drops at cluster edges
  pairs well with PQ         quality depends on the clustering
```

The edge problem is the characteristic weakness: a query near a cluster boundary
has its true neighbours in a list that is not probed. Raising `nprobe` mitigates
it at proportional cost.

## Product quantisation

Compression, usually combined with IVF, and the technique that makes
billion-scale search affordable.

```text
  split a 768-dim vector into 96 sub-vectors of 8 dims each.
  quantise each sub-vector to one of 256 centroids (1 byte).

  768 × 4 bytes = 3,072 bytes  →  96 bytes
                                  = 32× compression
```

```text
  distances are computed on the CODES using precomputed
  lookup tables, so the full vectors are never read.

  ✓  32× less memory: 30 GB → under 1 GB
  ✓  faster, because it is memory-bound work
  ✗  approximate distances → lower recall
  → RERANK the top candidates with exact distances to recover it
```

The two-stage pattern — approximate retrieval over compressed vectors, exact
rerank over a few hundred candidates — is the standard shape for large corpora,
and it is the same retrieve-then-rank structure as the serving chapter.

## Choosing an index

```text
  corpus size        recommendation
  ───────────        ──────────────
  < 100k             BRUTE FORCE. no index. seriously.
  100k – 10M         HNSW — best recall/latency, if it fits
  10M – 100M         HNSW with scalar quantisation, or IVF+PQ
  > 100M             IVF+PQ, or a distributed/disk-based index
                     (DiskANN)

  frequent updates   IVF (easier) or a segment-based design
  static corpus      HNSW
  memory-constrained IVF+PQ
  recall-critical    HNSW with high efSearch, plus reranking
```

**Below 100k vectors, do not build an index.** A numpy matrix multiply over 100k
768-dim vectors takes a few milliseconds, needs no tuning, has perfect recall, and
handles updates trivially. A great deal of unnecessary infrastructure is built for
corpora that fit in a matrix.

## Measuring recall

```text
  recall@k = |retrieved ∩ true_top_k| / k

  measured by computing exact results for a query sample
  and comparing.
```

```text
  recall
   1.0 │            ────────────
       │         ╱
   0.9 │      ╱
       │    ╱
   0.8 │  ╱
       └────────────────────────▶ efSearch / nprobe (latency)

  the knee is where to operate: past it you pay latency for
  almost nothing.
```

**Measure recall on your own data.** Published benchmarks use particular
distributions; a corpus with heavy clustering or many near-duplicates behaves
differently, and the parameters that give 95% on SIFT may give 80% on your
embeddings.

And measure **end-to-end quality**, not only recall. Recall@10 of 0.92 versus 0.97
may make no difference to answer quality if the reranker sees enough candidates —
in which case the extra latency is wasted.

## Filtered search

The requirement that breaks naive designs:

```text
  "the 10 nearest vectors WHERE tenant_id = 42 AND status =
   'published'"
```

```text
  PRE-FILTER    filter first, then search the subset
                ✓ correct
                ✗ the index cannot be used on an arbitrary
                  subset; degrades to brute force

  POST-FILTER   search for k, then filter
                ✓ uses the index
                ✗ may return FEWER than k, or nothing, when
                  the filter is selective

  FILTERED SEARCH  the index applies the predicate during
                traversal
                ✓ correct and fast
                → what modern vector databases implement
```

The failure mode to anticipate: **post-filtering with a highly selective
predicate returns empty results.** Searching for 10 neighbours and then filtering
to one tenant out of 10,000 will usually return zero. The workarounds are
over-fetching by the expected selectivity, partitioning the index by the filter
key (one index per tenant), or using an engine with native filtered search.

Partitioning by tenant is frequently the right answer for multi-tenant systems, and
it also solves the isolation problem from the resilience track.

## What to take away

1. Exact search is memory-bound and linear in corpus size; it is genuinely fine
   below ~100k vectors and untenable above a few million.
2. Tree-based indexes fail above ~20 dimensions, which is why embeddings need
   graph or clustering approaches.
3. HNSW gives the best recall/latency for in-memory corpora with `efSearch` as a
   runtime recall knob; IVF is cheaper and weaker at cluster edges.
4. Product quantisation compresses 32× and needs an exact rerank stage to recover
   recall — the same retrieve-then-rank shape as everywhere else.
5. Measure recall and end-to-end quality on your own data; the knee in the
   recall/latency curve is where to operate.
6. Post-filtering with a selective predicate returns empty results — use native
   filtered search or partition the index by the filter key.

Next: operating a vector search system, where the hard parts are updates and
embedding versions.
