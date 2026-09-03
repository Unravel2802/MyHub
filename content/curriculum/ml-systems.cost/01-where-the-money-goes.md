---
title: Where the money goes
minutes: 18
summary: Building a cost model for an ML system, and the line items that surprise people.
---

ML systems have an unusual cost profile: the expensive hardware is scarce, the
largest line item is often not the one people expect, and costs scale with usage
in ways that are easy to miss until the invoice arrives. Building a model of where
the money goes is what makes optimisation targeted rather than superstitious.

## The categories

```text
  TRAINING            GPU-hours × price
                      + failed runs and reruns
                      + hyperparameter search
                      → BURSTY, and visible

  DATA                storage, processing, feature pipelines,
                      labelling
                      → CONTINUOUS, and frequently the largest

  INFERENCE           serving hardware, scaled to traffic
                      → CONTINUOUS, and grows with the product

  INFRASTRUCTURE      registries, monitoring, orchestration,
                      experiment tracking
                      → fixed-ish

  PEOPLE              usually the largest of all, and the one
                      compute spend should be traded against
```

**Feature pipelines are the line item that surprises.** For most organisations
with a mature ML system, the continuous cost of computing and materialising
features exceeds training, because training is bursty and pipelines run forever.

And the last row is worth stating explicitly: an engineer spending three weeks
optimising a $2,000/month bill has spent more than they saved. Cost work should be
sized against the salary it consumes.

## Training cost

```text
  cost = GPU-hours × $/GPU-hour × (1 + failure_overhead)

  a 7B model, 1T tokens, 64 × A100 at $2/hour:

    FLOPs   = 6 × 7e9 × 1e12 = 4.2e22
    at 40% MFU on 64 A100s (312 TFLOP/s each)
            = 64 × 312e12 × 0.4 = 8e15 FLOP/s
    time    = 4.2e22 / 8e15 ≈ 5.25e6 s ≈ 61 days
    cost    = 61 × 24 × 64 × $2 ≈ $187,000
```

```text
  the levers, in order of effect

  1. MFU                    40% vs 20% is HALF the cost
  2. fewer/shorter runs     hyperparameter search discipline
  3. spot instances         60–80% cheaper
  4. a smaller model or
     fewer tokens           if quality allows
  5. cheaper hardware       older generations for smaller jobs
```

The first is the most valuable and the most neglected: **doubling MFU halves the
training bill**, and going from 20% to 40% is usually a dataloader fix and a
batch-size change rather than anything exotic.

```text
  and the waste to look for

  □  failed runs — a job that OOMs at hour 40 costs 40 hours
  □  sweeps with no early stopping — running all 200
     configurations when ASHA would kill 150 in the first 10%
  □  idle reserved capacity between jobs
  □  debugging at full scale instead of on a small config
```

## Inference cost

For a product that succeeds, inference eventually dominates: training is paid
once, inference is paid per request forever.

```text
  cost per 1,000 requests
    = instance $/hour ÷ (requests/hour)

  and requests/hour is set by BATCHING, quantisation and
  hardware — which is why the serving optimisations are cost
  optimisations.
```

```text
  the same 7B model, one A100 at $2/hour

    unbatched          ~40 req/s   → $13.90 per million
    batch 32           ~530 req/s  → $1.05
    batch 32 + int4    ~1,400 req/s → $0.40

  → a 35× cost difference, same model, same hardware
```

That table is the argument for the inference-optimization topic stated as money.
The optimisations are not performance work; they are the difference between a
viable unit economics and an unviable one.

```text
  the other inference levers

  □  a SMALLER or distilled model — usually the largest
  □  CASCADES — a cheap model for the easy 80%
  □  CACHING — identical and prefix-shared requests
  □  right-sized hardware — the biggest GPU is rarely the
     cheapest per request
  □  autoscaling with a sensible floor
  □  spot for tolerant workloads
```

## Data cost

The one that accumulates quietly:

```text
  STORAGE       raw data + features + embeddings + model
                artifacts + checkpoints + logs
                → grows monotonically unless someone deletes

  PROCESSING    feature pipelines running on a schedule,
                forever

  TRANSFER      cross-zone and egress — frequently a large
                and invisible line

  LABELLING     human annotation, often the largest single
                data cost
```

```text
  the audit worth running quarterly

  □  which features have NO model reading them?
  □  which are materialised more frequently than any
     consumer requires?
  □  how many checkpoints from abandoned runs are retained?
  □  how much history does any model actually use?
  □  is the pipeline recomputing everything when 5% changed?
  □  is data being read across zones unnecessarily?
```

Each of these is usually worth a double-digit percentage, and none of them are
found without someone deliberately looking — because nothing fails when a feature
nobody reads is materialised nightly forever.

## Cost per unit of value

The framing that makes decisions possible:

```text
  cost per prediction
  cost per active user
  cost as a fraction of the revenue the model influences

  → and the question that follows:
      does this model earn more than it costs?
```

```text
  a recommendation model costing $50k/month that lifts
  conversion by 2% on $100M of revenue is obviously worth it.

  a churn model costing $30k/month whose interventions have
  never been measured against a holdout might not be.
```

**This is where the permanent holdout from the monitoring topic pays for itself.**
Without it, a model's contribution is an assertion, and nobody can make a rational
decision about whether to keep paying for it. Many organisations run models for
years without knowing.

## Build versus buy

```text
  API (a hosted model)               SELF-HOSTED

  $ per token, no fixed cost         fixed hardware cost
  zero operational load              engineers, on-call,
                                     capacity planning
  scales to zero                     idle capacity is paid for
  latest models immediately          you choose and control

  → cheaper below a volume           → cheaper above it
    threshold                        → and the threshold is
                                       higher than enthusiasm
                                       suggests
```

```text
  the crossover arithmetic

    API:         $X per million tokens
    self-hosted: instance $/hour ÷ (tokens/hour achieved)

  compute BOTH at your ACTUAL utilisation. self-hosting at
  20% utilisation is often more expensive than the API, and
  20% is a common real utilisation.
```

The hidden costs of self-hosting that belong in the comparison: engineer time,
on-call, model updates, capacity for peaks, and the opportunity cost of the work
not done. The hidden cost of the API: rate limits, no control over deprecation,
and data leaving your boundary.

## Attribution

```text
  tag every resource with:
    team · project · model · environment · run id

  → so the bill can be attributed, and so a team can see
    the cost of its own decisions
```

**Visibility changes behaviour more reliably than policy.** A team that can see
"this sweep cost $4,000 and the winner was in the first ten runs" designs the next
sweep differently. A team that cannot, runs it again.

## Optimising, in order

```text
  1. MEASURE. attribute. find the actual largest line.
  2. delete what is unused — features, checkpoints, data
  3. improve UTILISATION — MFU, batching, right-sizing
  4. use cheaper resources — spot, older GPUs
  5. reduce the work — a smaller model, cascades, caching
  6. renegotiate contracts and commitments
```

Step 1 is skipped most often, and it is why cost work so frequently targets
training (visible and bursty) when the bill is dominated by feature pipelines
(invisible and continuous).

## What to take away

1. Feature pipelines are frequently the largest ML line item, because they run
   continuously while training is bursty.
2. Doubling MFU halves the training bill, and going from 20% to 40% is usually a
   dataloader and batch-size fix.
3. Batching and quantisation can change inference cost by more than an order of
   magnitude on identical hardware — serving optimisation *is* cost optimisation.
4. Audit for unused features, over-frequent materialisation and abandoned
   checkpoints quarterly; nothing fails when they are wasted.
5. Cost per unit of value is the decision-making frame, and it requires the
   permanent holdout to know the value at all.
6. Compute the API-versus-self-hosting crossover at your *actual* utilisation, and
   measure before optimising — the visible cost is rarely the largest one.

Next: capacity planning for hardware that is scarce as well as expensive.
