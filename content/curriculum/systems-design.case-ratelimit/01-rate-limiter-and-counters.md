---
title: "Case: rate limiter and counters"
minutes: 18
summary: Enforcing a limit across many servers, and counting things that are counted too often.
---

Design a rate limiter for an API, and the distributed counters behind it. The
problem is small enough to reason about completely, and it exercises the
coordination trade-off precisely: exact enforcement needs coordination on every
request, which is exactly what a rate limiter cannot afford.

## Requirements

```text
  limit requests per client per window
  □  different limits per endpoint and per plan tier
  □  the check must add < 1 ms
  □  it must not be a single point of failure
  □  and it must work across many API servers
```

```text
  1M requests/second across 100 servers
    → the check happens on EVERY request
    → so its cost is the design's dominant constraint
```

## The algorithms

```text
  FIXED WINDOW
    count per (client, minute); reset each minute
    ✓ trivial, one counter
    ✗ allows 2× the limit at a boundary: 100 at 0:59 and
      100 at 1:00 is 200 in two seconds

  SLIDING LOG
    store a timestamp per request; count those in the window
    ✓ exact
    ✗ memory proportional to the request rate

  SLIDING WINDOW COUNTER
    weight the previous window by how much of it remains
      count ≈ current + previous × (overlap fraction)
    ✓ ~exact, O(1) memory
    → the usual right answer

  TOKEN BUCKET
    tokens refill at a fixed rate up to a capacity;
    each request takes one
    ✓ allows BURSTS up to the bucket size, then a steady rate
    → best when bursts are legitimate

  LEAKY BUCKET
    a queue drained at a constant rate
    ✓ smooths output completely
    ✗ adds latency; queues rather than rejecting
```

```text
  choose from the SHAPE of traffic you want to allow:

    steady enforcement        sliding window counter
    bursts are legitimate     token bucket
    smooth downstream load    leaky bucket
```

## Distributing it

```text
  CENTRALISED COUNTER
    every server increments one shared counter (Redis)

    ✓ exact
    ✗ a network round trip on EVERY request
    ✗ a single point of failure and a throughput ceiling
```

```text
  LOCAL COUNTERS, divided limit
    global 1000/s ÷ 100 servers = 10/s each

    ✓ zero coordination
    ✗ unfair under uneven load: one server rejects at its 10
      while another sits at 2
    ✗ the effective limit drops as balance worsens
```

```text
  PERIODIC RECONCILIATION — the practical answer

    servers hold LOCAL budgets and enforce locally.
    every second, each reports usage to a coordinator, which
    redistributes the remaining budget by observed demand.

    → coordination once per second, not per request
    → converges to fair sharing under uneven load
    → approximate at window boundaries, exact enough over
      any meaningful period
```

**This is the coordination lesson made concrete**: the requirement looks like it
needs per-request agreement, and decoupling the coordination frequency from the
request rate is what makes it affordable.

## Implementation with Redis

```text
  a Lua script makes check-and-increment ATOMIC —
  otherwise it is the check-then-act race from the
  coordination topic.
```

```text
  -- sliding window counter, atomic
  local key      = KEYS[1]
  local limit    = tonumber(ARGV[1])
  local window   = tonumber(ARGV[2])
  local now      = tonumber(ARGV[3])

  local current  = redis.call('GET', key) or 0
  if tonumber(current) >= limit then
    return 0                       -- rejected
  end
  redis.call('INCR', key)
  redis.call('EXPIRE', key, window)
  return 1                         -- allowed
```

```text
  □  ONE round trip, atomic
  □  EXPIRE means no cleanup job
  □  and Redis at 100k+ ops/s per node, sharded by client id,
     scales to the request volume
```

## Failure behaviour

```text
  the Redis cluster is unavailable. now what?

    FAIL OPEN     allow everything
                  → availability preserved; the limit is
                    unenforced, and an attacker who can cause
                    the outage removes the limit
    FAIL CLOSED   reject everything
                  → the limiter's outage becomes the API's
                    outage
    DEGRADE       fall back to LOCAL per-server limits
                  → approximate enforcement, service
                    preserved
```

**Degrade to local limits.** It is the only option that preserves both properties
approximately, and it requires the local path to exist and be exercised — which is
the tested-fallback point from the resilience topic.

## The response

```text
  429 Too Many Requests
  Retry-After: 30
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: 1735689600
```

```text
  □  Retry-After turns independently-guessed backoffs into a
     coordinated one you control
  □  the headers let well-behaved clients self-pace, which
     reduces the load that hits the limiter at all
  □  reject EARLY and cheaply — before parsing a body or
     acquiring a connection
```

## Distributed counters generally

The same problem without the limit:

```text
  a view counter on a popular item.

  every increment on one key → that key's shard is the
  bottleneck → the hot-key problem from the partitioning
  topic
```

```text
  SHARDED COUNTER
    write:  INCR counter:{id}:{random 0..15}
    read:   SUM of the 16 shards

    → 16× the write throughput
    → reads become a bounded scatter-gather
```

```text
  BATCHED / WRITE-BEHIND
    accumulate in memory; flush every second
    → 1000× fewer writes; loses at most a second on crash
    → correct for view counts, wrong for balances

  APPROXIMATE
    HyperLogLog for distinct counts: ~2% error, ~12 KB for
    billions of items, and it MERGES without coordination
```

```text
  the choice is the freshness/efficiency ladder again:

    a balance          exact, transactional
    a like count       sharded, eventually consistent
    a view count       batched, approximate
    unique visitors    HyperLogLog
```

## What to take away

1. Choose the algorithm from the traffic shape you want to allow: sliding window
   for steady enforcement, token bucket where bursts are legitimate.
2. A per-request centralised counter is exact and unaffordable; periodic budget
   redistribution decouples coordination frequency from request rate.
3. Make check-and-increment atomic — a read followed by a write is a race.
4. Degrade to local limits when the shared store is unavailable; fail-open removes
   the limit and fail-closed removes the API.
5. Return `Retry-After` and limit headers so clients self-pace, and reject before
   doing any work.
6. Hot counters need sharding, batching or approximation — and which one follows
   from how exact the count must be.

Next: search and autocomplete.
