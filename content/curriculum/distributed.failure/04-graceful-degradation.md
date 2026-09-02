---
title: Graceful degradation
minutes: 18
summary: Deciding in advance which parts of the product to lose, so that losing them is a feature.
---

When a dependency fails, a system has two options: fail with it, or continue
without it. Most systems fail with it by default, because "continue without it"
requires deciding in advance what the product means with that piece missing. That
decision is product work as much as engineering work, and it is what separates a
degraded experience from an outage.

## The default is fail-closed, and it is usually wrong

```text
  recommendations service is down

  FAIL-CLOSED (the default)         DEGRADED
  ────────────────────              ────────
  the product page throws           the product page renders
  → 100% of page views fail         → the recommendations carousel
  → a nice-to-have feature            is hidden or shows popular items
    took down the core flow         → users mostly do not notice
```

Nobody chose fail-closed. It happened because a call was made with no fallback,
inside a request that had no isolation. Making the other choice requires exactly
two things: knowing which dependencies are optional, and having a defined
behaviour when they are missing.

## Classify every dependency

The exercise that makes this concrete, and it should be written down per service:

```text
  CRITICAL     cannot serve without it. failure = failure.
               → the primary database, the auth service

  DEGRADABLE   the feature is diminished but the flow works.
               → recommendations, related items, live inventory
                 counts, personalisation, A/B assignment

  OPTIONAL     nobody notices.
               → analytics, telemetry, non-blocking audit
```

```text
  □  For each DEGRADABLE dependency, what EXACTLY is served instead?
  □  Is the degraded path TESTED, or only theoretical?
  □  Does the user find out, and how?
  □  Does the readiness check include it? (it must NOT)
```

That last check is the most common defect: a readiness probe that includes a
degradable dependency takes the whole instance out of the pool when a
nice-to-have fails, converting graceful degradation into an outage. Readiness
should only include *critical* dependencies.

## The fallback hierarchy

Order the responses from best to worst, and fall down it:

```text
  1. LIVE          the real answer                       ideal
  2. CACHED        a recent answer, possibly stale       usually fine
  3. STALE         an old answer, explicitly marked      often fine
  4. DEFAULT       a sensible static answer              acceptable
  5. OMITTED       the feature is hidden                 acceptable
  6. ERROR         tell the user                         last resort
```

```python
def get_recommendations(user_id):
    try:
        return recs.fetch(user_id, timeout=0.05)        # 1. live
    except Timeout, ServiceError:
        cached = cache.get(f"recs:{user_id}", allow_stale=True)
        if cached:
            return cached                               # 2/3. cached or stale
        return POPULAR_ITEMS                            # 4. default
    # never 6 — this feature does not justify failing a page view
```

Two things make this work in practice:

**A short timeout on optional work.** A 50 ms budget for recommendations means
the fallback fires fast. A 5-second timeout on an optional dependency means every
user waits 5 seconds before getting the fallback, which is worse than not having
the feature at all.

**Stale-while-error.** Retaining cache entries past their TTL specifically so
they can be served when the origin is unavailable is one of the highest-value
resilience patterns available. A one-hour-old recommendation list is nearly as
good as a fresh one; no recommendation list is worse.

## Degrading the write path

Reads degrade easily; writes are harder, and the options are worth naming:

```text
  QUEUE IT        accept the write, apply it later
                  ✓ user's action is not lost
                  ✗ they may not see it immediately
                  → good for: comments, uploads, non-critical updates

  REJECT CLEARLY  "we cannot process this right now, please retry"
                  ✓ honest; no false success
                  → good for: payments, anything with money

  DEGRADE SCOPE   accept the core write, drop the enrichment
                  → save the order, skip the loyalty points
                    (and reconcile the points later)
```

The one thing never to do is **accept a write and silently drop it**. A user told
"saved" whose data is gone is far worse than a user told "try again", and it is
the failure that destroys trust rather than merely causing inconvenience.

## Feature-level kill switches

Degradation you can trigger deliberately:

```text
  □  disable an expensive feature under load
  □  turn off personalisation to shed database load
  □  serve a static homepage instead of a personalised one
  □  disable search suggestions, keep search
  □  reduce page size or result count
```

The value is having these **before** the incident. During an outage, the ability
to shed 40% of database load by flipping one flag is worth more than any amount
of clever code, and building the flag takes an afternoon in advance versus an
hour of downtime during.

Kill switches should also be **automatic** where the trigger is measurable: if
the recommendations service error rate exceeds a threshold, stop calling it for a
minute. That is a circuit breaker, and it is degradation applied automatically.

## Making degradation visible

A silently degraded system is a system nobody fixes.

```text
  TO USERS       only where it changes what they should do
                 "Live inventory is temporarily unavailable —
                  quantities may be out of date"
                 not: a red banner for a hidden carousel

  TO OPERATORS   always. a metric per degradation path:
                   degradation_active{feature="recs", reason="timeout"}
                 and an alert on sustained degradation
```

The operator half is the one that gets forgotten, and its absence produces a
characteristic bad outcome: a system that has been serving fallback data for
three weeks, and nobody knows, because the fallback works. Every fallback path
should increment a counter, and sustained use should page someone.

## Testing it

An untested fallback does not work — the same rule as failover, and it is broken
just as often. The fallback path is by definition rarely executed, so it rots:
the cache key changes, the default list references a deleted product, an
exception type is renamed.

```text
  □  unit-test the fallback path explicitly
  □  integration-test with the dependency unavailable
  □  fault-inject in staging: kill each degradable dependency
     in turn and confirm the product still works
  □  run a game day that exercises them in production
```

## What to take away

1. Fail-closed is the default because nobody chose it; degrading requires
   classifying dependencies as critical, degradable or optional.
2. A readiness check must include only *critical* dependencies, or a nice-to-have
   failure removes the instance from the pool.
3. Fall down a hierarchy — live, cached, stale, default, omitted, error — and use
   a short timeout on optional work so the fallback fires fast.
4. Stale-while-error, retaining cache entries specifically to serve during an
   outage, is one of the highest-value patterns available.
5. For writes, queue it, reject clearly, or degrade scope — but never accept and
   silently drop.
6. Instrument every fallback path and alert on sustained degradation, or you will
   run on fallbacks for weeks without knowing.

Next: chaos engineering — finding out whether any of this works before an
incident does.
