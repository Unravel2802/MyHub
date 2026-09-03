---
title: Feature stores
minutes: 19
summary: The infrastructure that makes skew and leakage structurally impossible, and whether you need one.
---

A feature store is a system that computes a feature *once* and serves it to both
training and inference, with history for point-in-time joins and low latency for
serving. It exists to make the two previous chapters' failures impossible by
construction rather than by discipline.

## The architecture

```text
                 ┌──────────────────────────┐
                 │   FEATURE DEFINITION     │
                 │   (written ONCE)         │
                 └────────────┬─────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
   ┌─────────────────┐                 ┌─────────────────┐
   │  OFFLINE STORE  │                 │  ONLINE STORE   │
   │  full history   │                 │  latest value   │
   │  warehouse /    │                 │  Redis / DynamoDB│
   │  Parquet        │                 │                 │
   │                 │                 │                 │
   │  point-in-time  │                 │  <10 ms lookup  │
   │  joins for      │                 │  by entity key  │
   │  TRAINING       │                 │  for SERVING    │
   └─────────────────┘                 └─────────────────┘
```

One definition, two materialisations shaped for two access patterns. That is the
whole idea, and everything else is consequence.

## What it solves

```text
  ✓  TRAINING/SERVING SKEW
       one definition, so there is nothing to diverge

  ✓  POINT-IN-TIME CORRECTNESS
       the offline store keeps history; as-of joins are built in

  ✓  REUSE
       "days since last login" computed once, used by six models

  ✓  DISCOVERY
       a catalogue of what exists, who owns it, what it means

  ✓  SERVING LATENCY
       precomputed values, not computed per request
```

Reuse is the benefit that grows with the organisation. The tenth model at a
company with a feature store starts from a hundred existing features; the tenth
model without one starts from a pipeline jungle and reimplements features three
other teams already have — slightly differently.

## Feature types, and how each is materialised

```text
  BATCH        computed on a schedule from historical data
               "orders in the last 90 days", "lifetime value"
               freshness: hours to a day
               → a scheduled job writes both stores

  STREAMING    computed continuously from an event stream
               "clicks in the last 5 minutes", "current session length"
               freshness: seconds
               → a stream job writes the online store; the offline
                 store is appended for history

  ON-DEMAND    computed at request time from request data
               "distance between user location and merchant"
               cannot be precomputed — it depends on the request
               → a shared FUNCTION, applied identically in both paths
```

On-demand features are where skew sneaks back in, because they are computed at
serve time and therefore need a second implementation for training. The answer is
that the store must let you register a *transformation function* which it applies
in both paths — Feast's "on-demand feature views" and equivalents exist for
exactly this. If your store cannot do that, on-demand features are the one place
you still need contract tests.

## The offline/online consistency problem

The store removes skew from the *definition* and does not automatically remove it
from the *materialisation*:

```text
  the batch job writes the offline store at 02:00
  the batch job writes the online store at 02:00

  → between 02:00 and tomorrow's 02:00, the online value is
    up to 24 hours stale, and TRAINING SAW THE VALUE AS OF
    ITS OWN TIMESTAMP

  → if training rows use a value computed hourly and serving
    reads one computed daily, you have skew again — inside
    the feature store
```

The materialisation cadence must match what training assumes. The mitigation is
that **the training-time as-of join should reflect the online store's actual
freshness**, not the ideal value — which some stores support by recording the
materialisation timestamp alongside the value.

## Storage shapes

```text
  ONLINE STORE                       OFFLINE STORE
  ────────────                       ─────────────
  key-value, by entity id            columnar, append-only
  Redis, DynamoDB, Cassandra         Parquet on object storage,
                                     a warehouse, Iceberg/Delta

  optimised: point lookup, <10 ms    optimised: large scans,
  holds: the LATEST value            as-of joins
  size: bounded by entity count      holds: every value, forever
                                     size: grows without limit
```

Two practical notes. The online store's size is bounded by the number of entities
times the number of features, which for a consumer product with 100M users and
200 features is a genuinely large Redis bill — feature *count* is a cost decision,
not only a modelling one. And the offline store needs the table formats from the
data track (Iceberg, Delta) to make as-of joins efficient at scale.

## Serving path latency

```text
  a model needing 50 features for one entity

  NAIVE:  50 individual lookups × 2 ms = 100 ms   ✗
  BATCHED: one multi-get               = 3 ms     ✓

  for a ranking model scoring 500 candidates:
    500 entities × 50 features
    → ONE batched request, not 25,000 lookups
```

Batched retrieval is not an optimisation here; it is the difference between a
feasible and an infeasible design. Any feature store worth using has a
`get_online_features(entities, features)` call that issues one round trip, and
using it correctly is the main thing that determines serving latency.

## Do you need one?

The honest answer is: later than the vendors suggest, and earlier than most teams
build one.

```text
  YOU PROBABLY DON'T                 YOU PROBABLY DO
  ──────────────────                 ───────────────
  one or two models                  many models sharing features
  batch scoring only (no online      real-time serving from
    serving)                           precomputed features
  features come straight from the    features are aggregations
    request                            over history
  a small team, one codebase         several teams, several
                                       codebases
                                     skew has already bitten you
```

**The first model does not need a feature store.** Building one before you have
the second and third is the "platform nobody asked for" anti-pattern from the
previous topic. What the first model *does* need is the discipline: a shared
feature definition, an as-of join, and logged serving features — all achievable
with a library and a convention.

The signal that you need the infrastructure is **duplication**: the same feature
computed in three places, or a team asking whether a feature already exists and
nobody being able to answer.

## A lighter alternative

Much of the value is available without a feature-store product:

```text
  □  one library of feature definitions, imported by both the
     training job and the serving service
  □  features materialised to a warehouse table WITH validity
     timestamps, so as-of joins work
  □  a nightly/streaming job that pushes the latest values to
     Redis for serving
  □  a markdown catalogue: name, owner, definition, freshness,
     when the value becomes known
  □  contract tests comparing both paths
```

That is a few hundred lines and a table, and it delivers the skew and
point-in-time guarantees. A feature-store product adds discovery, lineage,
governance and managed materialisation — real value at scale, and overhead below
it.

## Operating one

```text
  □  FRESHNESS per feature — alert when materialisation is late.
     a stale feature is a silent accuracy loss.
  □  NULL / DEFAULT RATE — a spike means an upstream break
  □  ONLINE/OFFLINE CONSISTENCY — sample entities, compare the
     two stores, alert on divergence
  □  UNUSED FEATURES — materialising something no model reads is
     pure cost; audit and delete
  □  ONLINE STORE SIZE and COST
  □  serving p99 for batched retrieval
```

The consistency check is the one that catches real bugs: sample a few hundred
entities periodically, compute the feature both ways, and compare. It is the
log-and-replay technique from the skew chapter, run continuously.

## What to take away

1. A feature store computes a feature once and serves both training and inference,
   making skew and point-in-time errors structural impossibilities.
2. The offline store keeps history for as-of joins; the online store keeps latest
   values for sub-10 ms lookups.
3. On-demand features are where skew re-enters — they need a registered
   transformation applied in both paths, or contract tests.
4. Materialisation cadence must match what training assumes, or you have skew
   inside the feature store.
5. Batched multi-entity retrieval is the difference between a feasible and an
   infeasible serving path for ranking models.
6. The first model does not need a feature store, only the discipline; the signal
   to build is duplication, and a library plus a versioned table gets most of the
   value.

Next: versioning and validating the data itself.
