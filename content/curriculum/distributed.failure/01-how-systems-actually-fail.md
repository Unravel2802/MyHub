---
title: How systems actually fail
minutes: 20
summary: Metastable failures, cascades and correlated failure — the shapes that produce real outages.
---

Large outages are rarely caused by a component breaking. They are caused by a
system that was working, absorbing a small disturbance, and then failing to
recover after the disturbance ended. Understanding those dynamics is more useful
than any list of failure types, because it explains why systems fall over at
moments nothing obviously broke.

## Metastable failure

The most important failure shape, and the least widely known.

```text
  STABLE                            METASTABLE

  load ──▶ system ──▶ done          load ──▶ system ──▶ done
                                              │  ▲
  a disturbance passes,                       └──┘
  the system recovers                    the system's own response
                                         SUSTAINS the overload

  remove the trigger → recovers     remove the trigger → STILL BROKEN
```

The defining property: **the trigger is gone and the system does not recover.**
Restoring capacity does not help; the system is now in a state that feeds itself.

The canonical example:

```text
  1. a brief latency spike (a GC pause, a slow query, a blip)
  2. clients time out and RETRY
  3. retries add load → higher latency → more timeouts
  4. more timeouts → more retries → more load
        ↑                                    │
        └────────────────────────────────────┘

  the original spike ended at step 1.
  the system is now at 3× normal load, generated entirely by itself.
```

Recovery requires **breaking the loop**, not adding capacity:

```text
  □  shed load aggressively (reject rather than queue)
  □  disable retries entirely, temporarily
  □  drain queues of work whose deadline has passed
  □  in the worst case, restart to clear queues — the "turn it
     off and on again" that actually works, for this reason
```

The design lesson is the one that generalises: **any amplifying feedback loop is
a metastable failure waiting to happen.** Retries, cache-miss stampedes, health
checks that fail under load and cause restarts, autoscaling that adds cold
instances which are slow which triggers more scaling — each is a loop where the
response to a problem increases the problem.

## Cascading failure

One component fails, and its load moves onto the others, which fail in turn.

```text
  3 servers at 60% each
        │
  server A fails
        │
  B and C now at 90% each     ← the load did not disappear
        │
  latency rises non-linearly at 90% (the queueing curve)
        │
  B times out on health checks → removed
        │
  C at 180% → dead
```

Two properties make this specific:

**Capacity headroom must survive the failure.** Running three servers at 60% is
running at 90% post-failure. If your target utilisation is 60%, your *real*
utilisation with N+1 redundancy is 60% × N/(N−1).

**Failure moves load; it does not remove it.** This is the arithmetic people skip.
The users whose requests went to A do not go away.

The defences are structural: bounded concurrency per instance so an instance
cannot accept more than it can serve, load shedding so excess is rejected rather
than queued, and — crucially — **not making the healthy nodes fail**. Circuit
breakers and admission control exist to protect the survivors.

## Correlated failure

Redundancy arithmetic assumes independence. Most real failures are correlated,
which means the arithmetic overstates your safety, often by orders of magnitude.

```text
  claimed:  3 replicas at 99.9% → 99.9999997% availability

  reality — what they SHARE:
    □  the same rack, PDU, top-of-rack switch
    □  the same availability zone
    □  the same software version, and therefore the same bug
    □  the same configuration, and therefore the same mistake
    □  the same certificate, and therefore the same expiry
    □  the same dependency (DNS, IAM, the metadata service)
    □  the same deploy pipeline
```

The most common correlated failures are **not hardware**. They are:

- **A bad deploy.** Every instance runs the same code; a bug is 100% correlated.
  This is what staged rollouts exist for.
- **A config change.** Faster than a deploy and usually with no canary — see the
  configuration chapter.
- **Certificate expiry.** Every instance's certificate expires at the same
  instant. This causes a startling number of large outages, and the fix is
  monitoring days-to-expiry as a first-class metric.
- **A shared dependency.** DNS, an identity service, a metadata endpoint. Every
  instance depends on it identically.

The practical response is to make the deploy the *unit of correlation you
control*: stage everything, canary everything, and be able to roll back
everything quickly. Hardware independence you buy; software correlation you must
design against.

## Slow is worse than dead

A counter-intuitive fact worth internalising:

```text
  DEAD backend                      SLOW backend

  connection refused, instantly     requests occupy a connection,
  → the client fails fast and       a thread and a timeout slot
    moves on                        → clients pile up waiting
  → the LB ejects it                → the LB sees "responding"
                                    → resources exhaust upstream
```

A dead node is removed from the pool in seconds. A node responding in 30 seconds
passes health checks, keeps receiving traffic, and consumes a caller's resources
per request. The caller's thread pool or connection pool fills, and **the caller
fails for reasons unrelated to its own health** — which is how one slow service
takes down the three services in front of it.

The defences: aggressive timeouts (a slow response is a failure), bounded
concurrency per dependency so one slow dependency cannot consume all your
capacity, and latency-based outlier ejection rather than only error-based.

## The failure taxonomy worth carrying

```text
  CRASH        the process stops. the easiest case.
  OMISSION     some messages are lost. retries handle it.
  TIMING       responses arrive too late to be useful.
  BYZANTINE    wrong answers. rare inside a trust boundary,
               but corrupted memory and bugs produce it.

  GRAY FAILURE  ← the hard one
    the component is degraded in a way its own health checks
    do not detect, and observers disagree about whether it is
    healthy at all
```

**Gray failure** deserves the emphasis. A node that is 40% packet-lossy, or whose
disk is failing slowly, or that serves one endpoint correctly and another
incorrectly, reports itself healthy — because health checks measure what the
component thinks about itself. The observation that resolves it: **health must be
measured from the perspective of the caller**, which is what passive outlier
detection does and active probing does not.

## Failure domains

The unit of "things that fail together". Design by making them explicit:

```text
  process → instance → rack → zone → region → provider
                                  │
     each level is a blast radius. spread across levels
     according to what you must survive.
```

And two that are not physical, and are more likely to bite:

- **The deploy** is a failure domain. Everything with the same version fails
  together.
- **The tenant** is a failure domain, if one tenant's traffic can affect another.

## What to take away

1. Metastable failure is the shape behind most large outages: the trigger passes
   and the system's own response sustains the overload. Recovery means breaking
   the loop, not adding capacity.
2. Any amplifying feedback loop — retries, stampedes, health-check restarts,
   autoscaling on cold starts — is a metastable failure waiting to happen.
3. Cascading failure follows from load moving rather than disappearing; headroom
   must be sized for the post-failure state.
4. Redundancy arithmetic assumes independence, and the dominant correlated
   failures are deploys, config changes, certificate expiry and shared
   dependencies — not hardware.
5. A slow backend is more dangerous than a dead one, because it passes health
   checks while consuming its callers' resources.
6. Gray failure is invisible to self-reported health; measure health from the
   caller's perspective.

Next: bulkheads — bounding the blast radius so a local failure stays local.
