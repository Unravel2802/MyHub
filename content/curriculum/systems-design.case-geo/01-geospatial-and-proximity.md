---
title: "Case: geospatial and proximity"
minutes: 18
summary: Finding what is nearby, and handling objects that move.
---

Design a proximity service: find drivers near a rider, restaurants near an
address, friends near a location. The core operation — "nearest to a point" — has
a small number of good data structures, and the interesting variation is whether
the objects move.

## Requirements and scale

```text
  FUNCTIONAL   find the k nearest · within a radius ·
               update a moving object's position
  NON-FUNCTIONAL
    query < 100 ms
    position updates every few seconds for moving objects
    global
```

```text
  a ride-hailing scale

    10M drivers, updating every 4 s
      = 2.5M position writes/second      ← the real problem
    1M ride requests/hour
      = ~280 proximity queries/second

  → the WRITE volume dominates by four orders of magnitude
```

Stating that ratio early reframes the problem: it is not a search problem with
some updates, it is a write-heavy problem with occasional queries.

## Why a naive query fails

```text
  SELECT * FROM drivers
   WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?

  → a two-dimensional range needs a two-dimensional index;
    a B-tree on (lat, lng) can only use the first column
    efficiently
  → and a bounding box is not a circle
```

## The spatial indexes

```text
  GEOHASH
    interleave the bits of latitude and longitude into a
    string; shared prefixes mean spatial proximity.

      9q8yy   → San Francisco, ~150 m cell
      9q8y    → ~1.2 km cell
      9q8     → ~39 km cell

    ✓ a STRING — works in any key-value or relational store
    ✓ prefix search = a bounding box
    ✗ EDGE PROBLEM: two adjacent points can have completely
      different prefixes across a cell boundary
      → query the cell AND its 8 neighbours
    ✗ cells vary in physical size with latitude

  QUADTREE
    recursively subdivide into four quadrants; subdivide
    further where density is high.
    ✓ ADAPTS to density — dense cities subdivide, oceans do
      not
    ✗ a tree to maintain; rebalancing under movement

  S2 / H3
    S2 projects the sphere onto a cube and uses a
    space-filling curve; H3 uses hexagons.
    ✓ near-uniform cell sizes globally
    ✓ hexagons have uniform neighbour distance, which
      geohash squares do not
    → what production systems use

  R-TREE / POSTGIS
    bounding-box hierarchy; supports polygons and complex
    geometry.
    ✓ full geospatial query support
    ✓ PostGIS is excellent and handles most needs
    ✗ update-heavy workloads stress the tree
```

```text
  the practical choice

    static or slowly-changing objects  → PostGIS
    high-volume moving objects          → H3 or S2 cells in
                                          Redis
    simple and portable                 → geohash prefixes
```

## Moving objects

```text
  2.5M position writes/second is the constraint.

  □  do NOT persist every position to durable storage —
     write to an in-memory store (Redis) keyed by cell
  □  a driver's position is EPHEMERAL: a TTL means a
     disconnected driver disappears without an explicit
     delete
  □  a position update is: remove from the old cell, add to
     the new one — and only when the CELL changes, not on
     every ping
```

```text
  Redis structure

    GEOADD drivers:{cell} lng lat driver_id
    with a TTL per cell key

  query:
    compute the query point's cell + neighbours
    GEOSEARCH each
    merge, compute exact distances, sort, take k
```

```text
  the two-stage pattern again

    COARSE   cell lookup → candidates
    EXACT    true distance on a few hundred candidates

  → the same retrieve-then-rank funnel as everywhere else
```

## The radius problem

```text
  a fixed radius fails in both directions:

    dense city    → 5,000 drivers within 1 km; you only
                    need 20
    rural area    → zero drivers within 1 km; the request
                    fails

  → EXPANDING SEARCH: start small, widen until you have
    enough candidates or hit a maximum
```

## Distance

```text
  EUCLIDEAN     wrong on a sphere; fine for small distances
                if you scale longitude by cos(latitude)
  HAVERSINE     great-circle distance; correct and cheap
  ROAD DISTANCE what users actually care about, and it needs
                a routing engine — far more expensive
```

```text
  the practical approach

    filter by HAVERSINE (cheap) to a shortlist,
    then compute ROAD distance/ETA for the top few only.

  → because a driver 500 m away across a river is 15
    minutes by road, and straight-line distance is the wrong
    answer for the decision.
```

## Sharding

```text
  shard by GEOGRAPHIC CELL, not by object id.

  ✓ a query touches one shard plus its neighbours
  ✗ load is UNEVEN — Manhattan and a rural county are not
    comparable
  → subdivide hot cells further; H3's hierarchy makes this
    natural
```

The hot-cell problem is the partitioning topic's skew problem in geographic form,
and the answer is the same: split the hot key, and accept a bounded fan-out.

## What to take away

1. For moving objects, write volume dominates queries by orders of magnitude —
   which reframes the problem entirely.
2. A two-dimensional range needs a spatial index; a B-tree on (lat, lng) cannot
   serve it.
3. Geohash is portable and has an edge problem requiring neighbour queries; H3 and
   S2 give near-uniform cells and are what production systems use.
4. Keep moving positions in memory with a TTL, and only re-index when the cell
   changes, not on every ping.
5. Use an expanding radius, because a fixed one fails in dense and sparse areas in
   opposite ways.
6. Filter by haversine and compute road distance only for the shortlist — the
   straight-line answer is the wrong one for the decision.

Next: video streaming.
