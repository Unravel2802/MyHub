---
title: "Case: feeds and timelines"
minutes: 19
summary: The canonical fan-out problem, and the celebrity that breaks the obvious design.
---

Design a social timeline: users post, follow each other, and see a feed of posts
from the people they follow. It is the most-asked design question because the
naive solution is obviously correct and obviously infeasible, which forces the
interesting reasoning.

## Requirements and scale

```text
  FUNCTIONAL      post · follow · view a timeline
  OUT OF SCOPE    search, DMs, moderation, ads

  NON-FUNCTIONAL
    timeline load < 200 ms
    eventual consistency acceptable (seconds)
    high availability — a read outage is worse than
      slightly stale content
```

```text
  100M DAU
    posts   200M/day  ≈ 2,300/s  · peak ~12,000/s
    reads   2B/day    ≈ 23,000/s · peak ~115,000/s
    → read:write ≈ 10:1 by request

  storage
    200M × 500 B = 100 GB/day text
    media dominates → object storage + CDN
```

## The naive design, and why it fails

```text
  SELECT * FROM posts
   WHERE author_id IN (SELECT followee FROM follows
                        WHERE follower = :me)
   ORDER BY created_at DESC
   LIMIT 20;
```

```text
  at 115,000 QPS, against a partitioned posts table, with a
  user following 500 accounts:

    → the IN clause spans hundreds of partitions
    → a scatter-gather per request
    → sorting across all of them
    → and the tail latency is the slowest partition's

  it is correct and it cannot be served.
```

**Stating this explicitly is the move that motivates everything else.** The design
is not a pattern applied from memory; it is what remains after the obvious query
is ruled out.

## Fan-out on write

```text
  when a user posts, PUSH the post id into every follower's
  precomputed timeline.

  post ──▶ [posts store]
       └─▶ queue ──▶ workers ──▶ for each follower:
                                   LPUSH timeline:{follower}
```

```text
  READ becomes: LRANGE timeline:{me} 0 19
    → one operation, single-digit milliseconds

  WRITE becomes: O(followers)
    → 500 followers = 500 writes per post
    → 2,300 posts/s × 500 = ~1.15M timeline writes/s
```

```text
  storage for materialised timelines

    100M users × 800 post ids × 8 B = ~640 GB
    → fits in a Redis cluster
    → cap each timeline at ~800 entries; older content is
      fetched on demand
```

The cap matters: an unbounded timeline per user grows without limit, and nobody
scrolls past a few hundred entries. Capping converts an unbounded store into a
bounded one.

## The celebrity problem

```text
  an account with 50,000,000 followers posts.

  → 50M timeline writes, for ONE post
  → the queue backs up; every other user's post is delayed
    behind it
```

```text
  and the inverse waste:

    a user who has not opened the app in six months still
    receives every push into a timeline nobody reads.
```

```text
  THE HYBRID

    followers < 10,000    → fan-out on WRITE
    followers ≥ 10,000    → fan-out on READ

    a reader's timeline =
        merge( their pushed timeline,
               recent posts from the few large accounts
               they follow )

  → most users follow only a handful of large accounts, so
    the read-time merge is small and bounded.
```

```text
  and for inactive users:
    do not fan out to accounts with no recent activity;
    rebuild their timeline on next login.
```

The hybrid is the answer, and the threshold is the thing to state and justify —
it is a tuning parameter driven by the queue's throughput, not a constant.

## Ranking

```text
  a chronological feed is the simple version.
  a ranked feed changes the design:

    fan-out produces CANDIDATES, not a final order
    → retrieve ~1,000 candidates
    → score them with a ranking model at read time
    → apply diversity and freshness rules

  → which is the recommendation funnel from the ML track,
    and it moves work back onto the read path
```

Ranking reintroduces read-time cost that fan-out removed, so a ranked feed
typically caches the *ranked* result for a short TTL as well.

## Components

```text
  clients
    │
  [CDN] ──────────── media
    │
  [API gateway] ──── auth, rate limiting
    │
  ├─▶ POST service ──▶ posts store (partitioned by post_id)
  │                 └─▶ queue ──▶ fan-out workers
  │                                   │
  │                                   ▼
  ├─▶ TIMELINE service ──▶ timeline cache (Redis, per user)
  │                     └─▶ merge large-account posts at read
  │
  └─▶ GRAPH service ──▶ follows store (partitioned by
                        follower_id for "who do I follow",
                        with a reverse index for "who follows
                        me")
```

```text
  the follows store needs BOTH directions:
    reading a timeline needs "who do I follow"
    fanning out needs "who follows me"
  → store both, or accept a scan on one side
```

## Failure and consistency

```text
  □  fan-out is ASYNCHRONOUS, so a post appears in the
     author's own view immediately and in followers' feeds
     within seconds
  □  the fan-out queue must be durable — a lost message is a
     post nobody sees
  □  timeline cache miss → rebuild from the posts store
     (slow path, but correct)
  □  the timeline cache is DERIVED; losing it entirely is
     recoverable, which is why Redis is acceptable for it
```

That last point is worth stating: the materialised timeline is a cache of a
computation, not a system of record, so its durability requirements are much
weaker than the posts store's.

## Trade-offs to state

```text
  eventual consistency for followers, immediate for the
  author — because read-your-writes is what users notice

  storage for compute — 640 GB of materialised timelines to
  avoid a scatter-gather per read

  a hybrid rather than one strategy — because the follower
  distribution is a power law, and one strategy is wrong at
  one end of it

  a cap on timeline length — bounding an otherwise unbounded
  store, at the cost of a slow path for deep scrolling
```

## What to take away

1. State the naive query and why it cannot be served — that is what motivates the
   design rather than reciting a pattern.
2. Fan-out on write turns an expensive read into a cheap one by paying O(followers)
   at write time, and it needs a cap per timeline.
3. The celebrity problem breaks fan-out on write; the answer is a hybrid with a
   stated threshold driven by queue throughput.
4. Do not fan out to inactive users — rebuild their timeline on login.
5. Ranking moves work back onto the read path and turns fan-out output into
   candidates for a scoring funnel.
6. The materialised timeline is derived, so it can be rebuilt — which is why its
   durability requirements are weaker than the posts store's.

Next: chat and presence.
