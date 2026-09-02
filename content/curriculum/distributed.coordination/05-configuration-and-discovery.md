---
title: Dynamic configuration and discovery
minutes: 18
summary: Changing behaviour without a deploy, and the ways a config change takes down a fleet faster than a bad deploy.
---

Configuration that changes at runtime is coordination: every instance must
eventually agree on the current value, and some values must be agreed on
*before* anyone acts. It is also the most dangerous change type in production,
because unlike a deploy it usually has no canary, no rollback button and no
review.

## What belongs in dynamic configuration

```text
  ✓  feature flags and kill switches
  ✓  rate limits and quotas
  ✓  timeouts and retry budgets
  ✓  sampling rates
  ✓  traffic routing weights
  ✓  circuit-breaker thresholds

  ✗  secrets            → a secret manager, with rotation and audit
  ✗  schema definitions → version them with the code
  ✗  business rules     → code, reviewed and tested
  ✗  anything large     → this is not a database
```

The line for feature flags specifically: **a flag is a temporary control, not a
permanent branch.** A flag that has been at 100% for six months is dead code with
a config dependency, and a codebase with 300 flags has 2³⁰⁰ configurations nobody
has tested. Flags need an expiry and a cleanup process, and the number of live
flags is worth tracking as a metric.

## Propagation: push beats poll

```text
  POLLING                            WATCHING

  every 30s: GET /config             one long-lived watch per instance
                                     server pushes on change

  - 30s of inconsistency             + propagates in milliseconds
  - constant load ∝ instances        + load only on change
  + trivially simple                 - a connection per instance
  + no long-lived connections        - needs reconnection handling
```

Watch where the store supports it (etcd, ZooKeeper, Consul all do), and handle
the two watch failure modes:

- **Disconnection.** Reconnect with backoff and jitter, and **re-read the full
  state** on reconnect rather than assuming you missed nothing.
- **History compaction.** A watcher offline long enough gets "revision too old"
  and must do a full read before resuming. Handle it explicitly, or the instance
  silently runs on stale config forever.

Whichever you choose, **cache locally and keep serving from the cache** when the
store is unreachable. A configuration store outage should not stop the fleet —
instances already have the values they need.

## Rollout: the part people skip

A config change reaches every instance in seconds. That is the feature and the
hazard: **a bad config value is a fleet-wide simultaneous deploy with no
canary.** More outages come from configuration than from code in most
organisations, precisely because config changes bypass the safety machinery that
code goes through.

The controls worth building:

```text
  □  VALIDATE on write — schema, ranges, referential checks.
     "timeout: 0" and "timeout: 30000000" should be rejected at
     the point of change, not discovered by a fleet.

  □  STAGE the rollout — 1% of instances, then 10%, then all,
     with a soak between stages.

  □  VERSION and make rollback one action. The previous value
     should be one click away, and its restoration should not
     require finding it in someone's terminal history.

  □  AUDIT — who changed what, when, and why. During an incident
     "what changed in the last hour" must include config.

  □  REVIEW dangerous keys — some values deserve a second pair of
     eyes as much as a code change does.
```

**Instances must validate what they receive**, too. A config value that fails
validation should be rejected in favour of the last known good one, with a loud
alert — not applied because it came from the config service.

```python
def on_config_change(new):
    try:
        validated = Config.parse(new)      # ranges, types, invariants
    except ValidationError as e:
        log.error("rejecting bad config", error=e)
        metrics.increment("config.rejected")
        return                              # keep running on the old one
    current.swap(validated)
```

Without that, one bad write takes down everything at once. With it, the fleet
keeps running and one alert fires.

## Service discovery

The special case of configuration that answers "where is service X right now?".

```text
  1. instance starts, REGISTERS itself with an address and a TTL
  2. instance sends heartbeats to stay registered
  3. clients LOOK UP the service and get healthy instances
  4. instance stops heartbeating → removed from the registry
```

Three implementations in common use:

```text
  DNS-BASED           Kubernetes services, Consul DNS
    + works with everything, zero client changes
    - TTL granularity; clients cache aggressively and ignore TTLs
    - no health beyond up/down; no per-instance metadata

  REGISTRY-BASED      Consul, etcd, Eureka
    + rich metadata, health status, watches for instant updates
    - a client library per language

  PLATFORM-BASED      Kubernetes endpoints, a service mesh
    + no application code at all
    - tied to the platform
```

**The DNS caching trap is worth knowing specifically**, because it produces a
confusing failure: many runtimes and libraries cache DNS results far longer than
the TTL says — the JVM historically cached forever by default. An instance is
removed from the registry, DNS reflects it, and a client keeps sending to the
dead address until it is restarted. If you use DNS discovery, verify your
runtime's caching behaviour explicitly.

**Registration should be automatic**, from the platform or a sidecar, not from
application code. Application-level registration fails in the case that matters
most: a process wedged badly enough to be useless but healthy enough to keep
heartbeating.

## Deregistration and draining

The half that is usually missing:

```text
  shutdown sequence

  1. mark UNREADY in the registry / fail the readiness probe
  2. WAIT for propagation — clients and load balancers must
     observe it, which takes at least one health-check interval
  3. finish in-flight requests
  4. close connections gracefully
  5. exit
```

Step 2 is skipped constantly, and it is the cause of the errors that appear on
every deploy. A pod that stops accepting connections the instant it receives
SIGTERM produces failed requests for however long the load balancer takes to
notice — typically several seconds. Marking unready, waiting out that interval,
*then* closing is what makes a deploy invisible to users.

## Configuration as code

The pattern that reconciles "changes without a deploy" with "changes are
reviewed":

```text
  git repo ──▶ PR + review + CI validation ──▶ merge
                                                 │
                                          automatic sync
                                                 ▼
                                          config store ──▶ fleet
```

You get review, history, blame, rollback via revert, and CI validation of the
values — while the propagation stays fast. The cost is that emergency changes go
through a PR, so keep a documented break-glass path for kill switches, and make
using it noisy rather than convenient.

## What to take away

1. Dynamic config is for temporary controls — flags, limits, thresholds — not for
   secrets, schemas or business rules; a flag at 100% for six months is dead code
   with a config dependency.
2. Watch rather than poll, and on reconnect re-read the full state; handle watch
   history compaction explicitly or run stale forever.
3. Cache locally and keep serving from the cache during a store outage.
4. A config change is a fleet-wide deploy with no canary — validate on write,
   stage the rollout, version for one-action rollback, and audit.
5. Instances must reject invalid config and keep the last known good value, or one
   bad write takes down everything simultaneously.
6. Deregistration must mark unready and *wait for propagation* before closing —
   skipping that wait is why deploys produce errors.

That completes coordination. Next in the track: **load balancing and routing** —
getting a request to a healthy instance, and the traffic-shaping that builds on
it.
