---
title: Rate limiting and resilience
minutes: 18
summary: Quotas, backoff, timeouts, and the failure-isolation patterns that stop one slow dependency from taking down everything else.
---

An API that works under normal load is not the same as an API that survives
abuse and partial failure. This chapter is the set of patterns that make the
difference — most of them cheap to add, and each one a direct answer to a
specific, named failure mode.

## Rate limiting algorithms

```text
  FIXED WINDOW        count requests per fixed interval
                       (100/minute, reset at :00)
                       → BOUNDARY BURST: 100 requests at
                         0:59, another 100 at 1:00 — 200
                         requests in under 2 seconds, both
                         "within limit"

  SLIDING WINDOW       a rolling window, not a fixed reset
  (LOG or COUNTER)     point — fixes the boundary burst

  TOKEN BUCKET         tokens refill at a steady rate, a
                       request consumes one, the bucket has a
                       max size — allows a BURST up to bucket
                       size, then throttles to the refill
                       rate
                       → the standard choice for APIs: bursts
                         are usually fine, sustained abuse
                         isn't
```

```text
  → 429 Too Many Requests, with a Retry-After header telling
    the caller exactly when to try again — a bare 429 forces
    the client to guess a retry delay.
```

## Timeouts

```text
  every network call needs an explicit timeout. no timeout
  means: a hung downstream dependency hangs YOUR request
  handler indefinitely, which — under enough concurrent
  requests — exhausts your own connection pool or thread
  pool, and now YOU are down too, because of someone else's
  outage.
```

```text
  → set a timeout on every outbound call — HTTP client, DB
    query, cache lookup. "the framework default" is often
    much longer (or infinite) than the caller can actually
    afford to wait.
```

## Retries and backoff

```text
  same shape as [backend.queues](/curriculum/backend.queues)'s
  backoff, applied synchronously: exponential backoff + jitter,
  and — critically — only retry on IDEMPOTENT operations
  (see [backend.http](/curriculum/backend.http)).

  retrying a non-idempotent POST blindly can duplicate the
  side effect the first attempt already caused.
```

## Circuit breakers

```text
  CLOSED  →  requests flow normally, failures are counted
     │
     │  failure rate exceeds threshold
     ▼
  OPEN   →  requests FAIL IMMEDIATELY, without even
             attempting the call, for a cooldown period
     │
     │  cooldown elapses
     ▼
  HALF-OPEN → let a small number of requests through as a
              probe
     │                              │
     │ succeed                     │ fail
     ▼                              ▼
  CLOSED                          OPEN (retry cooldown)
```

```text
  → the point isn't to help the FAILING dependency — it's to
    stop wasting YOUR resources (threads, connections,
    latency) on calls that are very likely to fail anyway,
    and to stop hammering an already-struggling dependency
    with load it cannot currently handle, which only delays
    its recovery.
```

## Bulkheads

```text
  named after a ship's bulkheads: compartmentalize so ONE
  breach doesn't sink the whole vessel.

    a single shared connection pool for every downstream
    dependency → one slow dependency exhausts the shared
    pool, and now requests to healthy dependencies fail too,
    purely from resource starvation

    → a SEPARATE pool (connections, threads) per dependency
      — dependency A being slow can only exhaust A's pool,
      leaving B's calls unaffected
```

## Idempotency keys, tied together

```text
  [backend.rest](/curriculum/backend.rest) introduced the
  header; this is the storage mechanic:

    Idempotency-Key: 3f29a1e4-...

    on receipt:
      1. has this key been seen? → return the STORED result
      2. else: process the request, store (key → result,
         status, expiry)

  → the store needs a UNIQUE CONSTRAINT on the key, so two
    concurrent requests with the same key racing each other
    don't both pass a "have I seen this?" check and both
    process — same atomicity requirement as the queue
    handler's check-and-mark.
```

## Composing these patterns

```text
  a single outbound call, hardened:

    rate limit (protect yourself from callers)
      → timeout (bound how long you'll wait)
      → circuit breaker (stop calling a failing dependency)
      → retry with backoff+jitter (survive a transient blip)
      → bulkhead (contain the blast radius if it doesn't recover)
```

```text
  → these are not alternatives to pick one of — each answers
    a DIFFERENT failure mode, and a production-grade client
    to an important dependency typically layers several of
    them together.
```

## What to take away

1. Token bucket is the standard rate-limiting choice because it allows a
   burst while still capping sustained rate — fixed windows have a boundary-
   burst flaw sliding windows fix.
2. Every outbound call needs an explicit timeout, or a hung dependency
   exhausts your own resources and turns their outage into yours.
3. Only retry idempotent operations — retrying a non-idempotent POST blindly
   can duplicate its side effect.
4. A circuit breaker's real purpose is protecting YOUR resources from calls
   likely to fail, and avoiding piling more load onto an already-struggling
   dependency.
5. A bulkhead (a separate resource pool per dependency) stops one slow
   dependency from starving requests to healthy ones — these patterns compose,
   they aren't alternatives to choose between.
