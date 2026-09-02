---
title: Health checking and outlier detection
minutes: 18
summary: Deciding which backends are eligible, and the failure where health checks take down a healthy fleet.
---

A load balancer's algorithm only matters among backends it considers eligible.
Deciding eligibility is a failure detector, with all the properties from the
fundamentals topic — you cannot distinguish slow from dead, and the timeout you
choose trades one failure for another. Health checking done badly is a
well-documented cause of outages that would not otherwise have happened.

## Active versus passive

```text
  ACTIVE                            PASSIVE (outlier detection)

  the LB probes each backend        the LB watches REAL traffic
  GET /healthz every 5s             and ejects backends that fail

  + detects a dead backend even     + no synthetic traffic
    with no traffic                 + reflects what users experience
  + uniform, predictable            + catches partial failures
  - synthetic; may not reflect        (one endpoint broken)
    what real requests hit          - needs traffic to notice
  - probe load ∝ backends × LBs     - a burst of errors is needed
```

**Use both.** Active checks catch a backend that is completely down and remove it
before any user request reaches it. Passive detection catches the far more common
case: a backend that answers `/healthz` cheerfully while failing real work,
because its database pool is exhausted or one code path is broken.

## Liveness versus readiness — again, because it matters

The distinction from the RPC topic, restated because this is where it causes
outages:

```text
  LIVENESS   "is this process wedged?"
             failure → RESTART
             MUST NOT check dependencies

  READINESS  "can this instance serve right now?"
             failure → remove from the pool, do NOT restart
             SHOULD check the dependencies it cannot serve without
```

The failure this prevents:

```text
  liveness probe includes a database ping

  the database has a 30-second blip
     ↓
  EVERY instance fails liveness simultaneously
     ↓
  EVERY instance is restarted
     ↓
  restarts open new connections, hammering the recovering database
     ↓
  a 30-second blip becomes a 20-minute outage
```

This has happened to many organisations, and the diagnosis is always the same
line in a Kubernetes manifest. **Liveness answers "is this process stuck", and
nothing else.** If a process is running and its event loop is responsive, it is
alive, even if it can do no useful work.

Kubernetes' third probe, **startup**, exists to stop liveness from killing a
slow-starting process before it has finished booting. Use it for anything with a
long warm-up rather than inflating the liveness timeout.

## What a readiness check should do

```python
@app.get("/ready")
def ready():
    checks = {
        # things we CANNOT serve without
        "db":    db.ping(timeout=1),
        "cache": cache.ping(timeout=0.5),
        # capacity, not just connectivity
        "pool":  db.pool.available() > 0,
        "queue": request_queue.depth() < MAX_DEPTH,
    }
    # deliberately NOT checked: downstream services we can degrade
    # without. a recommendations outage must not take us out of
    # the pool — see the graceful degradation chapter.
    return (200 if all(checks.values()) else 503), checks
```

Three principles:

- **Check what you cannot serve without, and nothing else.** A dependency you can
  degrade around does not belong here.
- **Check capacity, not just connectivity.** An instance with an exhausted
  connection pool is not ready, even though every ping succeeds.
- **Time-limit every check.** A readiness probe that hangs is worse than one that
  fails, because the platform's probe timeout then decides your behaviour.

## The correlated-failure trap

The most dangerous property of dependency-aware health checks:

```text
  every instance checks the same database.
  the database is slow.
  every instance reports unhealthy AT THE SAME TIME.
  the load balancer has ZERO healthy backends.
  → 100% outage, when the truth was "somewhat degraded"
```

Removing every backend is never an improvement. The defence is a **minimum
healthy threshold**, implemented by every serious balancer under names like
"panic mode" (Envoy) or "healthy panic threshold":

```text
  if fewer than 50% of backends are healthy:
      IGNORE health status and send to ALL of them

  reasoning: if most of the fleet looks unhealthy, the problem is
  probably shared — and degraded service beats no service.
```

Verify this is enabled. Its absence is the difference between a slow site and a
dark one.

## Outlier detection

Ejecting a backend based on the traffic it is actually serving.

```text
  backend C returns 5xx on 40% of requests over the last 10s
     → eject C for 30 seconds
     → after 30s, admit it again on a trial basis
     → if it fails again, eject for 60s (doubling)
```

The parameters that matter:

```text
  consecutive_5xx        or   success_rate_stdev_factor
  interval               how often the check runs
  base_ejection_time     the first ejection duration
  max_ejection_percent   ← the important one: never eject more than
                           this fraction of the pool, for the same
                           reason as the panic threshold
```

Success-rate-based ejection — comparing each backend to the *fleet's* success rate
rather than to a fixed threshold — is better than a fixed error count, because it
adapts when the whole fleet is degraded. If everyone is at 90% success, a backend
at 89% is not an outlier; if everyone is at 99.9%, it is.

## Probe cost

An easily-missed scaling problem:

```text
  100 backends × 20 load balancers × one probe every 5 seconds
    = 400 probes per second of pure overhead

  and every probe that touches the database multiplies that load
  onto the database.
```

Mitigations: cache the readiness result for a second or two rather than
re-executing every dependency check per probe; make probes cheap by design; and
prefer passive detection where traffic volume makes it sufficient.

## Deregistration timing

The other half, and the one that produces the errors visible on every deploy:

```text
  1. receive SIGTERM
  2. fail the readiness probe immediately     ← says "stop sending"
  3. KEEP SERVING for (probe interval × failure threshold) + margin
     ← the LB has not noticed yet
  4. finish in-flight requests
  5. close connections gracefully
  6. exit
```

Step 3 is skipped constantly. With a 5-second probe interval and a threshold of
2, a load balancer takes up to 10 seconds to remove an instance — so a pod that
exits at step 2 produces 10 seconds of connection failures. That is the entire
explanation for "we see a few errors during every deploy", and the fix is a sleep
in the shutdown hook.

## What to take away

1. Use active checks to catch a dead backend with no traffic, and passive outlier
   detection to catch one that answers probes while failing real work.
2. Liveness must never check dependencies, or a dependency blip restarts the whole
   fleet and turns a blip into an outage.
3. A readiness check should test what you cannot serve without, include capacity
   rather than only connectivity, and time-limit every check.
4. A minimum-healthy threshold (panic mode) is essential: removing every backend
   is never better than serving degraded.
5. Prefer success-rate-relative outlier detection over fixed thresholds, and cap
   the fraction of the pool that can be ejected.
6. On shutdown, fail readiness and then keep serving until the balancer has
   noticed — skipping that wait is why deploys produce errors.

Next: service discovery, which decides what the pool contains in the first place.
