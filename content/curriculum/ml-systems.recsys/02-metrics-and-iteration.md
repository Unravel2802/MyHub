---
title: Ranking metrics and iteration
minutes: 18
summary: Measuring a ranked list, the position bias that corrupts every log, and the loop that improves it.
---

A recommender is judged by a ranked list, which needs its own metrics, and trained
on logs that are systematically biased by the system that produced them. Handling
both correctly is what separates a system that improves from one that oscillates.

## Offline ranking metrics

```text
  PRECISION@k   what fraction of the top k are relevant?
                → simple; ignores order within k

  RECALL@k      what fraction of all relevant items are in
                the top k?
                → the retrieval-stage metric

  MRR           1 / rank of the FIRST relevant item
                → right when the user wants one answer
                  (search, question answering)

  MAP           average precision across the list
                → binary relevance, order-sensitive

  NDCG@k        discounted cumulative gain, normalised
                → GRADED relevance and position discount
                → the standard for ranking
```

```text
  NDCG's position discount

    gain at position p = relevance / log2(p + 1)

    position 1: ÷1.00      position 5: ÷2.58
    position 2: ÷1.58      position 10: ÷3.46

  → an item at position 1 is worth ~3.5× the same item at
    position 10, which reflects how attention actually falls
```

**Report metrics at the k users actually see.** NDCG@100 on a page that shows ten
items measures ninety positions nobody looks at, and improvements there are
invisible.

## Position bias

The problem that corrupts every recommendation log.

```text
  users click position 1 far more than position 10 —
  REGARDLESS of relevance.

  so:  observed_click = relevance × P(examined | position)

  a model trained naively on clicks learns POSITION, not
  relevance — and the strongest predictor of a click is
  "we showed it first", which is circular.
```

```text
  correcting for it

  INVERSE PROPENSITY WEIGHTING
    weight each observation by 1 / P(examined | position)
    → the position-bias curve must be ESTIMATED, usually
      from randomised interleaving or position swaps

  POSITION AS A FEATURE
    include position at training time; set it to a constant
    at serving
    → simple, effective, and widely used

  RANDOMISATION
    occasionally shuffle results to collect unbiased data
    → the cleanest estimate; costs some short-term quality
```

The position-as-a-feature trick is the pragmatic default: the model learns to
attribute part of the click to position, and at serving you ask "what would the
click probability be at a fixed position", isolating relevance.

## Online metrics

```text
  ENGAGEMENT       CTR, dwell time, completion rate, saves
  SATISFACTION     explicit ratings, hides, reports, skips
  BUSINESS         conversion, revenue, subscription retention
  ECOSYSTEM        catalogue coverage, creator diversity,
                   Gini coefficient of impressions
  GUARDRAILS       latency, error rate, policy violations
```

```text
  the trap, stated once more:

    optimising CTR alone produces clickbait.
    optimising dwell alone produces autoplay traps.
    optimising engagement alone produces outrage.

  → a WEIGHTED combination, with guardrails, and long-horizon
    validation of which short-term signal predicts retention
```

The ecosystem metrics are the ones most often absent and most often the source of
a slow-motion product failure. A marketplace where impressions concentrate on 1%
of sellers is losing supply-side participation, which no engagement metric shows
until the supply is gone.

## The iteration loop

```text
  ┌───────────────────────────────────────────────────────┐
  │  hypothesis → offline eval → online A/B → ship or not │
  │       ▲                                        │       │
  │       └────────── learn from the result ───────┘       │
  └───────────────────────────────────────────────────────┘

  offline eval SCREENS (fast, biased)
  online A/B DECIDES (slow, true)
```

```text
  the correlation between offline and online improvement is
  positive and WEAK.

  → offline is a filter that stops obviously bad ideas
  → it is not a substitute for the experiment
  → a system whose offline and online results diverge
    consistently has a measurement problem worth fixing,
    because the screening step is not doing its job
```

Measuring that correlation over many experiments is itself worthwhile: if half of
your offline wins fail online, the offline evaluation needs repair before more
modelling.

## Where the wins usually come from

Roughly in order of observed impact:

```text
  1. BETTER CANDIDATES        recall gains propagate through
                              everything downstream
  2. FRESHER FEATURES         real-time session signals often
                              beat a better model
  3. MORE / BETTER FEATURES   especially cross features
  4. HARD NEGATIVES           in retrieval training
  5. MULTI-TASK OBJECTIVES    aligning the score with what the
                              product values
  6. DIVERSITY / EXPLORATION  long-term ecosystem health
  7. A BIGGER MODEL           usually the smallest win per unit
                              of effort
```

**Feature freshness is the underrated one.** A user's last five actions in this
session are frequently more predictive than any architectural change, and the work
is a streaming pipeline rather than a modelling project — which is why it often
goes to the bottom of the backlog despite being at the top of this list.

## Serving considerations

```text
  □  the latency budget: retrieval + filter + rank + rerank
  □  precompute item embeddings; compute user embeddings at
     request time
  □  cache aggressively — the same user requesting twice in a
     session
  □  fall back to popularity when the ranker is unavailable
  □  log candidates, features, scores, positions AND
     PROPENSITIES
```

That last line is the one that determines whether you can improve the system
later. **Logging propensities is what makes counterfactual evaluation and
position-bias correction possible**, and the information cannot be recovered
afterwards.

## Common failures

```text
  □  TRAINING ON BIASED LOGS with no correction
       → the model learns the previous model

  □  POPULARITY COLLAPSE
       → the same items to everyone; coverage falls

  □  STALE FEATURES
       → recommendations that ignore what the user just did

  □  IGNORING NEGATIVE FEEDBACK
       → hides and skips are strong signals and are often
         not modelled at all

  □  OPTIMISING THE PROXY
       → clickbait, as above

  □  NO EXPLORATION
       → the catalogue ossifies and new items never surface
```

## What to take away

1. NDCG with a position discount is the standard offline ranking metric; report it
   at the k users actually see.
2. Position bias means clicks measure position as much as relevance — correct with
   propensity weighting, position-as-a-feature, or randomisation.
3. Offline and online results correlate positively but weakly; offline screens,
   online decides, and a consistent divergence is a measurement problem.
4. Track ecosystem metrics like catalogue coverage — impression concentration is a
   slow-motion failure no engagement metric reveals.
5. Better candidates and fresher features usually beat a better model; feature
   freshness is the most underrated lever.
6. Log candidates, scores, positions and propensities — without propensities you
   cannot correct bias or evaluate counterfactually later.

That completes recommendation systems. Next in the track: **cost and capacity for
ML** — what all of this costs and how to control it.
