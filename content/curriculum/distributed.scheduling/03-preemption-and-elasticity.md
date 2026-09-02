---
title: Preemption and elasticity
minutes: 18
summary: Taking resources back, growing the cluster, and the feedback loop that makes autoscaling dangerous.
---

A cluster that only ever adds work eventually fills. Reclaiming capacity from
running tasks, and changing the cluster's size to match demand, are the two ways
out — and both introduce feedback loops that can destabilise the system they were
meant to stabilise.

## Preemption

Evicting running work so more important work can run. Necessary the moment you
allow borrowing above a guarantee.

```text
  cluster is full.
  a production service needs 8 CPUs.
  a batch job is using 20 CPUs it borrowed above its guarantee.

  → evict enough batch tasks to free 8 CPUs
```

The victim selection is a policy decision with real consequences:

```text
  □  LOWEST PRIORITY FIRST         the obvious rule
  □  MOST RECENTLY STARTED         least work lost
  □  FEWEST EVICTIONS NEEDED       minimise disruption count
  □  AVOID CHECKPOINT-LESS JOBS    a 20-hour job with no
                                   checkpoint loses 20 hours
  □  RESPECT DISRUPTION BUDGETS    never evict below N replicas
                                   of a service
```

The disruption budget is the one that prevents a self-inflicted outage: without
it, preemption can legitimately evict every replica of a low-priority service at
once, which is a correct scheduling decision and an incident.

## Graceful preemption

```text
  1. SIGNAL the task (SIGTERM) and start a grace period
  2. the task checkpoints, drains connections, deregisters
  3. on expiry, SIGKILL

  the grace period must be long enough to be USEFUL:
    a stateless web pod        10–30 s
    a task with checkpointing  minutes
    a long batch job           potentially much longer
```

**A preemption the task cannot react to is just a crash.** The value of graceful
preemption is entirely in what the task does during the grace period, so the
period must match what the task actually needs, and tasks must actually handle
the signal. A workload that ignores SIGTERM has opted out of graceful anything.

For batch work, **checkpointing is what makes preemption cheap**. A job that
checkpoints every ten minutes loses at most ten minutes; one that never
checkpoints loses everything and must start over — which, on a preemptible pool,
may mean it never finishes at all.

## Spot and preemptible instances

The economics that make preemption a first-class concern:

```text
  on-demand      $1.00/hour     available until you stop it
  spot           $0.20–0.40     reclaimable with ~2 minutes' notice

  → 60–80% cheaper, in exchange for handling interruption
```

The workload split that works:

```text
  SPOT-SUITABLE                     ON-DEMAND
  ─────────────                     ─────────
  batch and ETL                     stateful databases
  CI runners                        the control plane
  stateless web (with enough        anything whose restart is
    on-demand baseline)               expensive or slow
  ML training WITH checkpointing    the scheduler itself
```

The design rules:

```text
  □  handle the interruption notice — 2 minutes is enough to
     checkpoint and drain if you wrote the code, and useless
     if you did not
  □  DIVERSIFY instance types and zones — spot capacity is
     reclaimed per instance type, so a single-type fleet can
     lose everything at once
  □  keep an on-demand baseline for minimum capacity
  □  never put quorum members entirely on spot
```

That last one deserves emphasis: a three-node consensus group entirely on spot
instances of the same type can lose two members simultaneously when the provider
reclaims that type, which is a permanent-majority-loss event caused by a cost
decision.

## Autoscaling, and the loops in it

```text
  HORIZONTAL (more instances)       VERTICAL (bigger instances)

  + no restart needed               + helps a single-threaded
  + linear-ish scaling                bottleneck
  - requires stateless-ish work     - usually requires a RESTART
  → the default                     - bounded by the largest
                                      instance type
```

```text
  APPLICATION AUTOSCALING     more pods for a service
  CLUSTER AUTOSCALING         more machines for the pods

  they interact: pods pending → add machines → pods schedule
  and the reverse: machines idle → remove → pods evicted → pending
```

**That interaction is a feedback loop, and it can oscillate.**

```text
  load rises → add pods → pods pending → add machines
       ↓                                       ↓
  machines take 2–5 min to join            load falls
       ↓                                       ↓
  pods still pending, more added ←─── remove machines
       ↓                                       ↓
  overshoot ─────────────────────────────▶ pods pending again
```

The dampers, all of which are standard settings and all of which are frequently
left at unsuitable defaults:

```text
  □  COOLDOWN after scaling, before scaling again
  □  ASYMMETRY: scale up fast, scale down SLOWLY
     (being over-provisioned costs money; being under-provisioned
      costs an outage)
  □  STABILISATION WINDOW: require the signal to persist before
     acting
  □  MIN and MAX bounds, always — an unbounded autoscaler
     responding to a bug is an unbounded bill
```

The asymmetry rule is the most valuable: an aggressive scale-down is the direct
cause of the oscillation above, and the savings from removing a machine two
minutes earlier are trivial compared with the cost of thrashing.

## Choosing the scaling signal

```text
  CPU UTILISATION       the default, and often WRONG —
                        an I/O-bound service never hits it

  REQUEST RATE          better; leads the latency curve

  QUEUE DEPTH           best for worker pools — it directly
                        measures the backlog

  LATENCY               a lagging indicator: by the time it moves,
                        users are already affected

  CONCURRENCY /
  IN-FLIGHT REQUESTS    excellent for services — this is what
                        Knative and similar use
```

**Scale on a leading indicator, not a lagging one.** Latency-based autoscaling
adds capacity after users have felt the problem, and the capacity arrives minutes
later still. Queue depth and in-flight count move before latency does.

## The cold-start problem

The reason autoscaling is slower than it looks:

```text
  scale-up decision                     t+0
  ├─ instance provisioned               t+60 s
  ├─ image pulled                       t+90 s
  ├─ process started                    t+95 s
  ├─ caches warm, JIT compiled,
  │  connection pools filled            t+180 s
  └─ actually serving at full speed     t+180 s

  → three minutes from decision to useful capacity
```

If your traffic can double in ninety seconds, autoscaling alone cannot save you —
you need headroom. And a cold instance that receives full traffic immediately is
slow, which under a load-aware balancer looks like overload, which can trigger
*more* scaling: the amplifying loop from the resilience topic.

The mitigations:

```text
  □  slow start on new instances (from the load-balancing topic)
  □  pre-warmed / pre-pulled images
  □  a warm pool of idle instances for fast scale-up
  □  predictive scaling for known patterns (business hours,
     scheduled events)
  □  headroom sized for the fastest plausible ramp
```

## Scale-to-zero

```text
  no traffic → no instances → cold start on the next request

  ✓  development environments, internal tools, rare batch
  ✗  anything user-facing with an unpredictable arrival
```

The first request after scale-to-zero pays the entire cold start. That is fine
for an internal dashboard and unacceptable for a checkout path. The middle ground
is a minimum of one instance, which costs one instance and removes the cliff.

## What to take away

1. Preemption is required once borrowing above a guarantee is allowed, and victim
   selection must respect disruption budgets or it can evict every replica of a
   service.
2. A preemption the task cannot react to is a crash; the grace period is only
   worth what the task does with it, and checkpointing is what makes preemption
   cheap for batch.
3. Spot instances are 60–80% cheaper in exchange for handling interruption —
   diversify types and zones, and never put a whole quorum on them.
4. Application and cluster autoscaling form a feedback loop that oscillates; scale
   up fast, scale down slowly, and always set bounds.
5. Scale on a leading indicator — queue depth or in-flight requests — not on
   latency, which moves after users are affected.
6. Cold start is minutes, so autoscaling cannot replace headroom; slow start and
   warm pools stop new instances from triggering more scaling.

Next: how real schedulers put all of this together, and what to watch when
operating one.
