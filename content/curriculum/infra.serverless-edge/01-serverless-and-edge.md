---
title: Serverless and edge
minutes: 17
summary: Cold starts and execution models — the trade-offs behind "you only manage code" that no free lunch actually eliminates.
---

Serverless promises to remove infrastructure management entirely — no
servers to patch, no capacity to provision. That promise is largely true, and
it doesn't eliminate trade-offs, it moves them: from operational burden you
manage directly to constraints on execution model that you have to design
around instead.

## The execution model: stateless, event-triggered, ephemeral

```text
  a FUNCTION is invoked by an EVENT (an HTTP request, a queue
  message, a file upload) — runs, returns a result, and the
  execution ENVIRONMENT may be torn down immediately after,
  or reused for the NEXT invocation if one arrives soon enough.

  → this is genuinely different from the Cloud Primitives
    chapter's VM/container spectrum: there is NO persistent
    process running between invocations by default — anything
    a function needs to remember between calls (a cache, a
    connection pool) either doesn't reliably survive, or
    survives OPPORTUNISTICALLY (if the same execution
    environment happens to be reused), never guaranteed.
```

## Cold starts: the real, unavoidable cost

```text
  COLD START      no existing execution environment available
                  → the platform provisions ONE from scratch
                  (allocate resources, load your code, start
                  a runtime) before your function can even
                  begin executing — real, measurable latency
                  (tens of milliseconds to several seconds,
                  depending heavily on runtime and package size)
                  added to THAT specific request

  WARM START        an existing environment is reused — the
                  function starts executing IMMEDIATELY, with
                  none of the above overhead
```

```text
  → this is the SAME JIT-warmup shape the Performance
    Engineering chapter covered for a runtime's first few
    calls, at the INFRASTRUCTURE level instead of the language-
    runtime level — a function that's invoked rarely
    (occasional background job) pays cold-start cost on a
    meaningful fraction of its invocations; one invoked
    CONSTANTLY stays warm nearly always, because a new
    invocation almost always arrives before the platform tears
    down the previous environment.
```

```text
  → mitigations exist (smaller deployment packages load faster;
    "provisioned concurrency"/keeping a minimum number of
    warm instances running, at a real ongoing cost even when
    idle) but NONE of them eliminate cold starts entirely for a
    genuinely spiky, unpredictable traffic pattern — this is a
    real architectural constraint to design around, not a
    solved problem.
```

## Where serverless genuinely fits

```text
  ✓  EVENT-DRIVEN, BURSTY workloads — a webhook handler, an
     image-processing job triggered by an upload, code that
     runs occasionally and unpredictably — you pay per
     invocation, not for idle capacity sitting around waiting
  ✓  workloads where SCALING TO ZERO between requests is
     actually desirable (genuinely no traffic overnight, no
     cost overnight, automatically)

  ✗  SUSTAINED, high-throughput, latency-SENSITIVE workloads —
     paying the cold-start tax (even occasionally) and
     execution-time LIMITS (most platforms cap a single
     invocation's duration) make serverless a poor fit for
     "constantly busy, needs to respond in single-digit
     milliseconds, every time"
  ✗  anything needing a LONG-LIVED connection or persistent
     in-memory state a function's ephemeral model can't
     reliably provide (a WebSocket server holding open
     connections, an in-memory cache other requests can count
     on)
```

## Edge computing: pushing execution close to the user

```text
  a TRADITIONAL function runs in ONE region (or a few) — an
  EDGE function runs at hundreds of GEOGRAPHICALLY DISTRIBUTED
  locations, executing the request CLOSE to wherever the user
  actually is.

  → this is the CDN chapter's caching idea, generalized from
    "cache static content near the user" to "run actual CODE
    near the user" — cutting the network round-trip latency
    the Computer Networking chapter's numbers already
    established matters, for logic that genuinely needs to
    run per-request (A/B test routing, request rewriting,
    auth checks) rather than content that can simply be cached.
```

```text
  → edge runtimes are DELIBERATELY MORE RESTRICTED than a
    regular serverless function (a narrower JavaScript/Wasm
    runtime, tighter memory/CPU limits, often no direct
    filesystem access) — this is a genuine trade for the
    ability to run at hundreds of locations cheaply and start
    executing near-instantly; a full Node.js runtime with
    arbitrary native dependencies simply doesn't fit that
    deployment model.
```

## What to take away

1. A serverless function's execution environment isn't guaranteed to
   persist between invocations — anything it needs to remember either
   doesn't reliably survive or survives opportunistically, never as a
   guarantee.
2. Cold starts are the same JIT-warmup shape as a language runtime's first
   few calls, moved to the infrastructure level — a function invoked
   rarely pays this cost on a meaningful fraction of its calls, with no
   full elimination for genuinely spiky traffic.
3. Serverless fits event-driven, bursty workloads where scale-to-zero is
   genuinely desirable — it's a poor fit for sustained, latency-sensitive
   workloads or anything needing a long-lived connection.
4. Edge computing generalizes a CDN's "cache content near the user" to "run
   code near the user," specifically for logic that must run per-request
   rather than content that can simply be cached.
5. Edge runtimes are deliberately more restricted than a regular serverless
   function — a genuine trade for running cheaply at hundreds of
   distributed locations with near-instant startup.
