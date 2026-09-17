---
title: Capacity planning and cost
minutes: 17
summary: Load testing and headroom — provisioning for the traffic you'll actually have, not the traffic you have right now.
---

Capacity planning answers a question that's easy to get wrong in both
directions: provision too little, and a traffic spike takes the system
down; provision too much, and you're paying for idle capacity every single
day it isn't needed. This chapter is finding the actual right amount,
deliberately, rather than guessing.

## Load testing: finding the breaking point before users do

```text
  → the point of a LOAD TEST isn't confirming "the system works
    under NORMAL load" (production traffic already confirms
    that, every day) — it's finding EXACTLY where the system
    starts to DEGRADE or BREAK, under load HIGHER than normal,
    in a CONTROLLED setting where the consequences are a test
    report, not a real outage during a real traffic spike.
```

```text
  ✓  a REALISTIC traffic PATTERN (production traffic is rarely
     uniform — it has read/write ratios, request-type mixes,
     and burstiness that a naive "hit it with N requests/sec,
     all identical" test misses entirely)
  ✓  test DEPENDENCIES too, not just the service itself — a
     downstream database or third-party API frequently breaks
     BEFORE your own service does, under real load
  ✓  test in an environment that's a genuinely FAITHFUL
     representation of production, not a smaller, differently-
     configured "staging" that breaks at a completely
     different point for reasons unrelated to the thing you're
     actually testing
```

## Headroom: the buffer between "handles today's peak" and "breaks"

```text
  → provisioning for EXACTLY today's peak load, with ZERO
    margin, means the SLIGHTEST additional load (organic
    growth, a marketing campaign, an unusually busy day) pushes
    the system past its limit — HEADROOM is the deliberate gap
    between current peak and actual capacity, and it's a real,
    quantifiable design decision (a common starting point:
    provision for peak load times a safety factor, commonly in
    the 1.5-2x range, tuned by how VOLATILE and how
    UNPREDICTABLE the actual traffic pattern is).
```

```text
  → this connects directly to the SLOs and Reliability
    Engineering chapter's diminishing-returns point: MORE
    headroom means MORE safety margin against an unexpected
    spike, at MORE ongoing cost paid for capacity that sits
    idle the overwhelming majority of the time — there's no
    universally "correct" headroom percentage; it's a real,
    deliberate trade-off tuned to a specific system's actual
    traffic volatility.
```

## Autoscaling policy: automating the headroom decision

```text
  the Kubernetes and Orchestration chapter's autoscaler is the
  MECHANISM; the POLICY (what threshold triggers scaling, how
  FAST to scale, how much to over/under-provision during the
  scaling LAG itself) is the actual design decision that
  determines whether autoscaling helps or actively hurts.

  → SCALING LAG matters concretely: a new instance takes real
    time to actually become ready (provision, start, pass
    health checks — genuinely not instant) — a spike that
    arrives FASTER than the autoscaler can add capacity still
    causes real, temporary degradation DURING that lag window,
    which is exactly why a PREDICTIVE component (scale up
    BEFORE a known daily peak, based on historical pattern,
    rather than purely REACTING after load already increased)
    matters for genuinely predictable traffic patterns.
```

## The unit economics of a request

```text
  → the actual, concrete cost question: what does ONE request
    cost to serve (compute + database + third-party API calls +
    bandwidth, all divided across total request volume)? — this
    single number is what makes "should we optimize this code
    path" or "is this pricing tier profitable" an ANSWERABLE,
    concrete question, rather than an intuition-based guess.
```

```text
  → a feature that seems clearly valuable can be revealed as
    genuinely UNPROFITABLE once its actual per-request cost is
    computed honestly — this is precisely why unit economics
    matters as a REAL engineering input to a product decision,
    not merely a finance-department concern engineers can
    reasonably ignore.
```

## Reserved vs. on-demand: paying for predictability

```text
  ON-DEMAND      pay full price, use exactly what you need,
                RIGHT NOW, with zero upfront commitment

  RESERVED/       commit to a BASELINE amount of capacity in
  COMMITTED         advance, in exchange for a SIGNIFICANTLY
  USE                lower per-unit price (often 30-60% off)
```

```text
  → the practical strategy that combines both, deliberately:
    RESERVED capacity for your PREDICTABLE baseline load (the
    traffic floor you KNOW you'll always need), ON-DEMAND for
    the VARIABLE portion above that baseline (a spike, a
    seasonal surge) — this captures the reserved discount on
    the predictable majority of load while staying flexible for
    the genuinely unpredictable part, rather than over-
    committing to reserved capacity that sits unused during a
    quiet period, or paying full on-demand price for load that
    was actually entirely predictable all along.
```

## What to take away

1. A load test's real purpose is finding exactly where the system degrades
   under higher-than-normal load in a controlled setting — not confirming
   what production traffic already confirms daily.
2. Headroom is a deliberate, quantifiable gap between current peak and
   actual capacity — the same diminishing-returns trade-off as reliability
   itself, tuned to a specific system's traffic volatility, not a
   universal percentage.
3. Autoscaling's real design decision is the policy, not the mechanism —
   scaling lag means a fast-enough spike still causes temporary degradation
   during the window before new capacity comes online, which is why
   predictive scaling matters for known traffic patterns.
4. The per-request unit-economics cost is what turns "should we optimize
   this" or "is this feature profitable" into an answerable, concrete
   question rather than an intuition-based guess.
5. Combining reserved capacity for a predictable baseline with on-demand
   for the variable portion above it captures the reserved discount without
   over-committing to capacity that sits unused during a quiet period.
