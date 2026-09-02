---
title: Real schedulers
minutes: 18
summary: How Borg, Kubernetes, Mesos and YARN differ, and what to watch when operating one.
---

The concepts in this topic are visible in every production scheduler, arranged
differently according to what each was built for. Knowing the shape of each makes
their documentation legible and their trade-offs predictable.

## The systems

**Borg** (Google, internal) is the ancestor. A monolithic scheduler per cell of
tens of thousands of machines, running production services and batch on the same
hardware with strict priority classes.

```text
  its defining contribution: MIXING workloads on one cluster.

  production services are over-provisioned by nature (sized for
  peak, running at average). Borg fills the gap with batch, and
  preempts it the instant production needs the capacity.

  → utilisation goes from ~30% to ~60–70%, which at Google's
    scale is an enormous amount of money
```

That idea — batch as the filler that makes services' headroom affordable — is the
main reason clusters are shared at all, and it depends entirely on preemption and
isolation working.

**Kubernetes** is Borg's descendant, redesigned around a declarative API and
extensibility.

```text
  the CONTROL LOOP is the central idea:

    observe actual state  ──▶  compare with DESIRED state
          ▲                              │
          └──────── act to converge ◀────┘

  a scheduler is one controller among many; so is the deployment
  controller, the autoscaler, and everything else.
```

Scheduling is filter-then-score, exactly as described:

```text
  1. FILTER (predicates)   nodes that CANNOT host the pod
       resources, node selectors, taints, affinity, volume
       availability, port conflicts
  2. SCORE (priorities)    rank the survivors
       least/most requested, spread across zones, image locality,
       inter-pod affinity
  3. BIND                  write the assignment; kubelet acts on it
```

Both phases are pluggable, which is Kubernetes' real design choice: rather than
being the best scheduler, it is the most extensible one.

**Mesos** takes the two-level approach. The master *offers* resources to
frameworks; frameworks accept or decline.

```text
  master ──offer: 4 CPU, 8 GB on node-7──▶ framework
         ◀─accept, run this task──────────
         ◀─or decline───────────────────────
```

Frameworks implement their own scheduling logic, so Spark and a service framework
can use completely different policies on one cluster. The cost is that each sees
only what it is offered, so no global optimisation is possible.

**YARN** is Hadoop's, built for batch. Its Capacity Scheduler implements
hierarchical queues with guarantees and borrowing, and its Fair Scheduler
implements DRF. Both are the mechanisms from the previous chapter, named.

**Nomad** is deliberately simpler — one binary, several workload types
(containers, VMs, raw executables), optimistic concurrency over shared state. A
reasonable choice when Kubernetes' complexity is not warranted.

## What they share

```text
  □  filter then score
  □  hard constraints and soft preferences
  □  priority classes with preemption
  □  hierarchical quotas with borrowing
  □  sampling rather than exhaustive evaluation at scale
  □  a control loop that converges toward a declared desired state
```

If you understand those six, any scheduler's documentation is readable.

## Requests, limits and the three QoS classes

The Kubernetes model, which is worth understanding precisely because it is where
most operational surprises come from.

```text
  REQUEST   what the scheduler reserves. determines PLACEMENT.
  LIMIT     the ceiling enforced at runtime. determines THROTTLING
            and OOM-killing.
```

```text
  request == limit          GUARANTEED
                            evicted last; can get exclusive CPUs

  request < limit           BURSTABLE
                            can use spare capacity, and is evicted
                            before Guaranteed pods

  neither set               BEST EFFORT
                            evicted FIRST; throttled aggressively
```

The two mistakes that cause most incidents here:

```text
  NO REQUEST SET
    the scheduler thinks the pod needs nothing, packs the node
    full, and the node runs out of memory under real load.
    → set requests from MEASURED usage, always.

  CPU LIMIT SET TOO LOW
    CPU is throttled rather than OOM-killed, so the symptom is
    mysterious latency with no error. a pod at its CPU limit
    stalls for whole scheduling periods.
    → many teams deliberately set no CPU limit (requests only)
      and let cgroup shares handle contention. memory limits,
      by contrast, are essential — memory is incompressible.
```

That asymmetry is worth carrying: **CPU is compressible and memory is not.**
Exceeding a CPU limit means slowness; exceeding a memory limit means death. So
memory limits protect the node and CPU limits mostly hurt you.

## Operating: what to watch

```text
  □  PENDING PODS and WHY               ← the primary signal
     "insufficient memory" ≠ "no node matches affinity"
  □  SCHEDULING LATENCY                 decision to running
  □  FRAGMENTATION                      free capacity that cannot
                                        be used
  □  PREEMPTION RATE                    rising means real contention
  □  NODE UTILISATION spread            packed unevenly?
  □  EVICTIONS and their reasons        memory pressure, disk,
                                        preemption
  □  QUOTA usage per tenant             who is near their limit
  □  AUTOSCALER decisions and lag       and any oscillation
```

**The pending reason is the diagnostic that matters**, and the categories point at
different fixes:

```text
  insufficient cpu/memory   → add capacity, or reduce requests
  no nodes match selector   → a labelling or affinity mistake
  volume node affinity      → the pod is pinned to a zone by a disk
  taints not tolerated      → intentional, or a leftover taint
  too many pods per node    → the pod-count limit, not resources
```

The third and fifth are the ones people spend hours on without a clear message —
a pod that cannot schedule despite obvious free capacity is usually pinned by a
persistent volume's zone, or hitting a per-node pod cap.

## Capacity planning

```text
  needed = peak_demand
         × (1 + growth headroom)
         × (1 + failure headroom)      ← survive N node failures
         ÷ target_utilisation          ← 60–70%, not 90%
```

The failure-headroom term is the one skipped, and it is the cascading-failure
arithmetic from the resilience topic: a cluster sized so that losing a node puts
the rest at 95% has not survived the failure, it has postponed it.

**Fragmentation makes effective capacity lower than raw capacity**, sometimes
substantially. A cluster at 70% allocated may be unable to place a large task,
and the fix is usually smaller, more uniform task sizes rather than more
machines — uniform sizes pack far better, which is why many organisations
standardise on a small set of task shapes.

## The recurring lessons

```text
  □  set requests from MEASURED usage, not from guesses
  □  set memory limits; be cautious with CPU limits
  □  use anti-affinity for replicas — it is the single highest-value
     scheduling constraint for availability
  □  use pod disruption budgets so preemption and drains cannot
     take a service to zero
  □  do not run at high utilisation; the queueing curve is
     non-linear and fragmentation eats the rest
  □  separate latency-sensitive from batch, because network, disk
     and cache isolation are weak
```

## What to take away

1. Borg's contribution was mixing batch into services' headroom, taking
   utilisation from ~30% to ~60–70% — which depends entirely on preemption and
   isolation.
2. Kubernetes is a control loop plus a pluggable filter-then-score scheduler; its
   design choice was extensibility rather than optimality.
3. Mesos offers resources and lets frameworks decide, trading global optimisation
   for policy independence.
4. Requests determine placement and limits determine runtime enforcement; unset
   requests cause node overcommit, and low CPU limits cause mysterious latency.
5. CPU is compressible and memory is not — memory limits protect the node, CPU
   limits mostly hurt you.
6. The pending-pod *reason* is the primary diagnostic, and capacity planning must
   include failure headroom and an allowance for fragmentation.

That completes cluster scheduling, and with it the Distributed Systems track. The
material from here connects outward: **Systems Design** applies all of it to
concrete cases, **Infrastructure & Ops** covers running it, and **ML Systems**
applies the same reasoning to training and serving models.
