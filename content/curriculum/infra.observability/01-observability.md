---
title: Observability
minutes: 18
summary: Logs, metrics, and traces answer three different questions — and a dashboard's value is entirely in whether it answers the question someone actually has.
---

Observability is frequently reduced to "we have logging and a dashboard,"
which misses the point: the three pillars — logs, metrics, and traces —
exist because they answer three genuinely different questions, and a system
that only has one of them has real blind spots for the other two.

## The three pillars, and what each one actually answers

```text
  LOGS       "what EXACTLY happened, in this ONE specific
             event" — high detail, high volume, per-event

  METRICS     "how is the SYSTEM behaving in AGGREGATE, over
             TIME" — low detail, low volume (a number per
             time bucket), cheap to store for a long time,
             cheap to alert on

  TRACES       "what happened as ONE REQUEST flowed through
             MULTIPLE services" — the causal path a single
             request took, with timing at each step
```

```text
  → these AREN'T interchangeable, and reaching for the wrong
    one wastes real time: "why did latency spike at 3am" is a
    METRICS question (aggregate behavior over time) — grepping
    through millions of individual log lines to answer it is
    the wrong tool; "why did THIS SPECIFIC request fail" is a
    LOGS or TRACES question — a dashboard showing "p99 latency:
    450ms" tells you nothing about WHICH request, or why.
```

## Structured logging: logs a machine can actually query

```text
  console.log(`User ${userId} failed login: ${reason}`);   ✗
    → a STRING. finding "all failed logins for user 42 in the
      last hour" needs regex-parsing free text, which is
      fragile and slow at real volume.

  logger.info('login_failed', { userId, reason, timestamp }); ✓
    → STRUCTURED — a queryable field (userId) instead of text
      buried in a sentence a machine has to parse back out.
```

```text
  → this is precisely the Errors and Failure Design chapter's
    "errors someone can act on" discipline, applied to
    OPERATIONAL logging: a structured field is directly
    filterable/aggregatable by a log platform, where the same
    information embedded in a free-text sentence requires
    fragile parsing to extract at query time, and different
    engineers writing free-text logs inevitably format the
    "same" information inconsistently across the codebase.
```

## Cardinality: the trap that breaks a metrics system

```text
  http_requests_total{endpoint="/api/users", status="200"}
                                                              fine
  http_requests_total{user_id="47291", status="200"}
                                                              ✗ DANGEROUS
```

```text
  → a metric LABEL with HIGH CARDINALITY (a value with
    thousands or millions of distinct possibilities — a user
    id, a raw request id, a full URL with query params) creates
    a SEPARATE TIME SERIES for EVERY distinct value — a metrics
    system that's cheap and fast for a few hundred label
    combinations becomes catastrophically expensive (or simply
    falls over) at millions of them. this is a REAL, common
    incident cause: someone adds `user_id` as a metric label
    "for debugging," and the metrics backend's storage or query
    performance degrades sharply, sometimes without an obvious
    connection to the actual cause.
```

```text
  → the fix: HIGH-cardinality identifying information belongs
    in LOGS (or traces), which are built to handle it; metric
    LABELS should stay LOW-cardinality (an endpoint name, a
    status code, a region) — this is the exact right-tool
    distinction the three-pillars section above sets up,
    applied to a specific, expensive mistake.
```

## Distributed tracing: following a request across service boundaries

```text
  request → [Service A: 5ms] → [Service B: 45ms] →
                                  [Service C: 200ms] →
            response (total: 250ms)

  → a TRACE shows this ENTIRE path, with a SPAN per service
    hop, and its DURATION — this answers "WHERE in a multi-
    service request did the time actually go" directly, where
    metrics alone tell you the TOTAL was 250ms but nothing
    about WHICH of the three services actually caused it.
```

```text
  → this REQUIRES CONTEXT PROPAGATION: a trace ID generated at
    the very first service must be PASSED ALONG (typically in
    an HTTP header) to every downstream service call, so each
    span can be correctly attributed to the SAME overall trace
    — a service that doesn't propagate this header BREAKS the
    trace at that point, and the very useful "where did the
    time go" picture becomes gap in exactly the place it's
    needed most.
```

## Dashboards that answer real questions

```text
  a dashboard showing 40 graphs, none of which map to a
  question anyone actually asks during an incident, is
  observability THEATER — it LOOKS like monitoring without
  functioning as monitoring.

  → the actual test for a useful dashboard: during a real
    incident, does looking at it answer "is this getting
    better or worse," "which service is the problem," and
    "what should I check next" — a dashboard designed by
    working BACKWARD from these real, specific incident
    questions is a genuinely different (and far more useful)
    artifact than one built by graphing every metric that
    happened to be available.
```

## What to take away

1. Logs, metrics, and traces answer three genuinely different questions —
   reaching for the wrong pillar (grepping logs for an aggregate trend, or
   staring at a dashboard for one specific failed request) wastes real
   time.
2. Structured logging makes a field directly queryable instead of buried in
   free text a machine has to parse back out — the errors-and-failure-
   design discipline applied to operational logging.
3. A high-cardinality metric label (a user id, a raw request id) creates a
   separate time series per distinct value, which is a real, common
   incident cause when a metrics backend's cost or performance suddenly
   degrades — high-cardinality data belongs in logs, not metric labels.
4. A distributed trace shows which specific service hop in a multi-service
   request actually consumed the time, which requires context propagation —
   a trace ID passed along every downstream call — and breaks wherever
   propagation is missing.
5. A useful dashboard is designed backward from real incident questions
   ("is this better or worse," "which service," "what next") — a wall of
   graphs that doesn't map to those questions is observability theater.
