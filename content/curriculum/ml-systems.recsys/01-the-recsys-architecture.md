---
title: The recommendation architecture
minutes: 19
summary: How to rank a hundred million items in twenty milliseconds, and why every system has the same shape.
---

Recommendation is the ML system most people encounter, and its architecture is
remarkably uniform across companies because the constraint is uniform: score
enormous catalogues under a tight latency budget. The answer is always a funnel.

## The funnel

```text
  CATALOGUE          100,000,000 items
       │
       ▼
  CANDIDATE          ~1,000 items          ~5 ms
  GENERATION         cheap, high recall, many sources
       │
       ▼
  FILTERING          ~800 items            ~1 ms
                     eligibility, seen-before, policy
       │
       ▼
  RANKING            ~800 scored           ~15 ms
                     the expensive model
       │
       ▼
  RE-RANKING         ~20 shown             ~2 ms
                     diversity, freshness, business rules
```

Each stage cuts the count by roughly an order of magnitude and spends roughly ten
times more per item. That inversion is the whole design: **you cannot afford the
good model over the whole catalogue, so you use a cheap model to find the few
hundred items worth thinking about.**

The same shape appears in search, in ads, and in RAG (retrieve then rerank). It is
the standard answer whenever a good scoring function is too expensive to apply
broadly.

## Candidate generation

The objective here is **recall, not precision** — the ranker fixes ordering, but it
cannot recover an item that was never retrieved.

```text
  SOURCES, blended

  □  TWO-TOWER RETRIEVAL      user embedding · item embedding,
                              ANN over the item index
  □  COLLABORATIVE            "users like you also liked"
  □  CONTENT-BASED            similar to what you engaged with
  □  GRAPH / CO-OCCURRENCE    items frequently consumed together
  □  TRENDING / POPULAR       the cold-start fallback
  □  RECENT                   freshness
  □  RULES                    editorial, promotional
```

Blending sources matters: each has a different bias, and a single source produces
a recognisable and narrow feed. Most systems take a fixed quota from each and let
the ranker sort them out.

**The two-tower model** is the workhorse and its structure is dictated by
precomputation:

```text
  ┌──────────────┐        ┌──────────────┐
  │ USER TOWER   │        │ ITEM TOWER   │
  │ user features│        │ item features│
  └──────┬───────┘        └──────┬───────┘
         │                       │
    user embedding          item embedding
         │                       │
         └────── dot product ────┘

  the towers are SEPARATE, so item embeddings can be
  computed OFFLINE for the whole catalogue and indexed
  for ANN search.
  → the user embedding is computed at request time, and
    retrieval is one ANN query.
```

This is the same bi-encoder/cross-encoder division as the retrieval topic: the
architecture is chosen to make precomputation possible, at the cost of the model
never seeing user and item features interact.

**Negative sampling is where two-tower models are won or lost.** Training on
observed positives requires manufactured negatives, and the choice matters more
than the architecture:

```text
  RANDOM negatives      too easy; the model learns only coarse
                        distinctions
  IN-BATCH negatives    other items in the batch; efficient and
                        biased toward popular items
  HARD negatives        items that are similar but not engaged
                        with → the strongest signal
  → and hard negative mining is usually the largest single
    quality lever in retrieval
```

## Ranking

Now you can afford a real model over ~1,000 items.

```text
  features per (user, item) pair

  USER      history, demographics, embeddings, session context
  ITEM      attributes, popularity, age, quality signals
  CONTEXT   time, device, position on the page, session state
  CROSS     the interaction terms — "this user's affinity for
            this item's category"

  → CROSS FEATURES are where ranking quality comes from, and
    they are exactly what the two-tower retrieval model
    cannot represent.
```

```text
  the objective

  POINTWISE    predict P(click) per item independently
               simple; ignores that ranking is comparative
  PAIRWISE     learn that A should rank above B
  LISTWISE     optimise the whole list's metric directly
               → best aligned with NDCG, hardest to train
```

Most production systems are pointwise with a well-chosen loss, because it is far
simpler to train and serve and the gap to listwise is smaller than the theory
suggests.

**Multi-task ranking is now standard**, because engagement is multidimensional:

```text
  one model, several heads:
    P(click) · P(long dwell) · P(share) · P(complete) · P(hide)

  final score = weighted combination of the heads

  → the weights are a PRODUCT decision, tuned online, and
    they are where "what does this product value" is
    literally encoded
```

That weighting is worth recognising as the place the framing chapter's proxy
problem gets resolved: a single click objective produces clickbait, and the
multi-head weighting is how a team expresses that a share is worth more than a
click and a hide is worth a lot of negative.

## Re-ranking

The final pass, which optimises properties of the *list* rather than of items:

```text
  □  DIVERSITY — not five items from the same creator
  □  FRESHNESS — some new content, or the catalogue ossifies
  □  EXPLORATION — items with uncertain value, to gather data
  □  BUSINESS RULES — promotions, contractual placements
  □  DEDUPLICATION — near-identical items
  □  FATIGUE — do not show what was shown and ignored
```

```text
  MMR (maximal marginal relevance)

    score(item) = λ · relevance − (1−λ) · max similarity to
                  what has already been selected

  → a tunable relevance/diversity trade
```

Diversity is not decoration. A ranker optimised purely for predicted engagement
produces a homogeneous feed that performs well on the next click and degrades
retention — one of the clearest cases where the short-term metric and the
long-term outcome diverge.

## Cold start

```text
  NEW USER      no history
                → popular items, onboarding preferences,
                  demographic priors, exploration

  NEW ITEM      no engagement
                → content features, creator priors, and
                  DELIBERATE exposure to gather signal

  NEW SYSTEM    no data at all
                → rules and popularity, and instrument
                  everything from day one
```

**New items are a systemic problem, not just a per-item one.** A ranker trained on
engagement will never show an item with no engagement, so the item never gets
engagement — a self-reinforcing loop that quietly makes the catalogue static.
Reserving a fraction of impressions for exploration is the standard answer, and it
is a cost the system must be designed to pay.

## Feedback loops

The property that makes recommendation different from most ML:

```text
  the model chooses what users see
       ↓
  users engage with what they were shown
       ↓
  that engagement becomes training data
       ↓
  the model learns to show more of it
       ↓ ────────────────────────────┘

  → POPULARITY BIAS: popular items get shown, get engagement,
    get more popular
  → FILTER BUBBLES: narrowing interest representation
  → the model never learns about what it never showed
```

```text
  mitigations
    □  EXPLORATION — a fraction of random or uncertain items
    □  propensity weighting in training (log the propensities)
    □  diversity constraints in re-ranking
    □  monitor CATALOGUE COVERAGE — what fraction of items
      ever get shown?
```

Catalogue coverage is the metric that reveals the problem, and it is rarely
tracked. A system showing 2% of its catalogue is one where 98% of the inventory is
economically dead, which is usually a much larger problem than a small ranking
improvement.

## What to take away

1. Every large recommender is a funnel: cheap retrieval over everything, expensive
   ranking over hundreds — because the good model cannot run over the catalogue.
2. Candidate generation optimises recall; the ranker cannot recover an item that
   was never retrieved.
3. Two-tower models separate the towers so item embeddings can be precomputed, at
   the cost of no user-item feature interaction — which is what ranking adds back
   through cross features.
4. Hard negative mining is usually the largest quality lever in retrieval.
5. Multi-task heads with tuned weights are where "what this product values" is
   literally encoded, and they are how the click-proxy problem gets resolved.
6. Feedback loops make new items systemically invisible; exploration and catalogue
   coverage monitoring are the answers.

Next: the metrics and the online loop that keep it honest.
