---
title: Data quality and contracts
minutes: 17
summary: Failing loudly at the boundary — testing data the same disciplined way this curriculum already tests code.
---

The Testing Strategy chapter's entire argument was that untested code can
silently do the wrong thing. Data pipelines have the identical problem, in
a form that's arguably worse: bad data doesn't crash — it flows silently
downstream into a dashboard, a report, or a model, where it looks completely
plausible right up until someone notices the numbers don't add up.

## Why bad data is worse than a bug: it doesn't crash

```text
  a NULL where a value was expected, a negative "quantity," a
  duplicate row from a retried pipeline step, a currency
  mismatch between two joined tables — NONE of these typically
  throw an exception ANYWHERE in the pipeline.

  → the pipeline runs "successfully" (no error, no crash, no
    alert) and produces a WRONG number that looks entirely
    PLAUSIBLE — this is genuinely more dangerous than a crash,
    because a crash is IMMEDIATELY visible and gets fixed fast;
    silently wrong data can sit in a dashboard, informing real
    decisions, for weeks before anyone happens to notice
    something looks slightly off.
```

## Tests on data: the same discipline, a genuinely different subject

```text
  assert row_count > 0
  assert null_count("customer_id") == 0
  assert unique(order_id)
  assert value BETWEEN 0 AND 1000000  -- a sanity bound on an
                                          amount column
```

```text
  → this is the Testing Strategy chapter's assertion
    discipline, applied to DATA instead of to CODE — the same
    underlying question ("does this match what I actually
    expect"), asked of the values flowing through a pipeline at
    RUNTIME rather than of a function's return value at TEST
    time. tools like Great Expectations or dbt's built-in
    tests exist specifically to make writing these assertions
    as routine and low-friction as writing a unit test already
    is.
```

## Freshness and volume checks: is the data even THERE

```text
  → beyond checking individual VALUES are correct, a pipeline
    needs to check the data ARRIVED AT ALL, and in roughly the
    EXPECTED amount — a source that silently stopped sending
    data (an upstream API outage nobody on THIS team was told
    about, a broken upstream job) produces ZERO rows today,
    which technically "succeeds" (an empty result isn't an
    error) while being a REAL, significant, unnoticed data-
    quality problem if nothing explicitly checks for it.

  → a VOLUME check ("today's row count should be within X% of
    the recent historical average") catches the OPPOSITE
    failure too — a source sending 100× its NORMAL row count
    (a duplicate job accidentally run twice, an upstream bug
    generating spurious events) is just as real a data-quality
    problem as sending too few, and it's one a naive "did SOME
    data arrive" check would miss entirely.
```

## Data contracts: an explicit agreement between producer and consumer

```text
  → the Serialization and Schemas chapter's compatibility
    discipline, formalized EXPLICITLY between a data PRODUCER
    (an upstream team's service emitting events) and a data
    CONSUMER (a downstream analytics team depending on that
    exact shape) — a CONTRACT states, in an agreed, documented,
    ideally MACHINE-CHECKED form: which fields exist, their
    types, and what changes are considered SAFE (additive) vs
    BREAKING, agreed to explicitly by BOTH sides rather than
    the consumer discovering the actual shape empirically by
    just... looking at whatever the producer happens to send
    today.
```

```text
  → this matters MORE here than for a typical internal API,
    specifically because a data pipeline's producer and
    consumer are frequently on ENTIRELY DIFFERENT TEAMS, with
    DIFFERENT priorities, who may not even reliably know the
    other depends on this exact shape at all — an explicit,
    documented contract is what makes "we changed our event
    schema" a coordinated, reviewed change instead of an
    unannounced surprise that breaks a downstream pipeline with
    zero warning to anyone.
```

## Failing loudly: the actual point of all of the above

```text
  the philosophy underneath every check in this chapter: when
  a genuine data-quality problem IS detected, the pipeline
  should FAIL the run explicitly and LOUDLY (alerting someone,
  blocking the bad data from reaching downstream consumers at
  all) — rather than silently PASSING corrupted, wrong, or
  incomplete data DOWNSTREAM and letting whoever eventually
  discovers the problem (usually a confused analyst or an
  executive questioning a dashboard number) figure out where
  in the pipeline it actually went wrong, after the fact,
  usually much later.
```

```text
  → this is a genuine, deliberate trade-off worth naming
    explicitly: a pipeline that fails LOUDLY on a data-quality
    violation means SOME days' data arrives LATE (blocked,
    while someone investigates and fixes the actual root
    cause) — which is a real, felt cost — but it's a
    dramatically smaller cost than WRONG data silently
    informing real decisions for weeks, undetected, before
    anyone notices the underlying problem existed at all.
```

## What to take away

1. Bad data is genuinely more dangerous than a bug, because it doesn't
   crash — it produces a plausible-looking wrong number that can inform
   real decisions for weeks before anyone notices.
2. Data quality tests apply the exact same assertion discipline as unit
   tests, aimed at runtime values flowing through a pipeline instead of a
   function's return value at test time.
3. A freshness check catches a source that silently stopped sending data
   entirely; a volume check catches the opposite failure (an unexpectedly
   large spike) — a naive "did some data arrive" check misses both.
4. A data contract formalizes the serialization chapter's compatibility
   discipline explicitly between producer and consumer teams who may not
   even reliably know the other depends on the exact current shape.
5. Failing a pipeline run loudly on a detected quality violation trades a
   real, felt cost (some days' data arrives late) for avoiding the far
   larger cost of wrong data silently informing decisions for weeks before
   anyone notices.
