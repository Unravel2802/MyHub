---
title: Fairness and multi-tenancy
minutes: 18
summary: Dividing a cluster between users who want different resources, and what "fair" means when they do.
---

A shared cluster has to divide capacity between teams, jobs and tenants who all
want more than their share. Deciding what is fair is straightforward when
everyone wants the same resource and genuinely subtle when they do not — which,
in a multi-dimensional cluster, is always.

## Why single-resource fairness is not enough

```text
  cluster: 100 CPUs, 1000 GB RAM

  user A's tasks:  1 CPU,  4 GB   ← memory-light
  user B's tasks:  1 CPU, 20 GB   ← memory-heavy

  "fair = equal CPU":  50 tasks each
    A uses  50 CPU,  200 GB
    B uses  50 CPU, 1000 GB   ← RAM exhausted; A cannot grow
                                even though CPU is free
```

Equal CPU produced an allocation where one user hit a wall and the other could
not use the remaining CPU. The question "what is a fair share?" has no answer
until you say fair *in what*.

## Dominant Resource Fairness

The standard answer (Ghodsi et al., and what Mesos and YARN implement). Equalise
each user's **dominant share** — the largest fraction of any single resource they
consume.

```text
  cluster: 9 CPUs, 18 GB

  A's task: 1 CPU, 4 GB  →  shares: 1/9 CPU, 4/18 = 2/9 MEM
                            dominant resource: MEMORY (2/9)

  B's task: 3 CPU, 1 GB  →  shares: 3/9 CPU, 1/18 MEM
                            dominant resource: CPU (3/9)

  allocate so dominant shares are EQUAL:
    A gets 3 tasks:  3 CPU,  12 GB  →  dominant share 12/18 = 2/3
    B gets 2 tasks:  6 CPU,   2 GB  →  dominant share  6/9  = 2/3
                     ─────  ──────
                     9 CPU   14 GB      both at 2/3. fair.
```

DRF has four properties that make it the right default:

```text
  SHARING INCENTIVE   no user does worse than with a static
                      1/n partition — so joining the shared
                      cluster is always rational

  STRATEGY PROOF      lying about your requirements cannot help
                      you get more

  ENVY FREE           no user prefers another's allocation

  PARETO EFFICIENT    no one can be improved without hurting
                      someone else
```

Strategy-proofness matters more than it sounds in practice: without it, teams
learn to over-request resources to game the scheduler, and the cluster fills with
inflated reservations that nobody uses. Any allocation policy you invent should be
checked against this property.

## Hierarchical quotas

Real organisations are trees, and fairness applies at each level:

```text
  cluster (100%)
  ├── engineering (60%)
  │   ├── platform (30% of eng = 18% of cluster)
  │   ├── product  (50% of eng = 30%)
  │   └── data     (20% of eng = 12%)
  └── research (40%)
      ├── team-a (50% of research = 20%)
      └── team-b (50% = 20%)
```

The essential refinement is **borrowing**: unused capacity flows to whoever wants
it, and is reclaimed when the owner returns.

```text
  guarantee   the minimum you are always entitled to
  limit       the maximum you may ever use
  borrowed    guarantee < current usage < limit
              → reclaimable at any moment
```

Without borrowing, a cluster sits half idle while one team is throttled at its
quota — which is the whole reason to share a cluster rather than partitioning it
statically. With borrowing, utilisation is high and the cost is that borrowed
capacity can be taken back, which is what preemption (the next chapter) handles.

## Priority, and its failure mode

Priorities let important work jump the queue:

```text
  0    best effort — the first thing evicted
  100  batch
  1000 production services
  2000 critical infrastructure
```

The problem, which appears in every system that has priorities:

```text
  PRIORITY INFLATION

  everything becomes "critical", because there is no cost to
  claiming it and a clear benefit.
  → priorities become meaningless
```

The defences that actually work:

```text
  □  BUDGETS — a team may run only N tasks above priority X.
     high priority becomes a scarce resource with a cost.
  □  APPROVAL — priority above a threshold requires a named owner.
  □  MONITOR the distribution — if 80% of tasks are "critical",
     the scale is broken and should be recalibrated.
  □  MAKE IT EXPENSIVE — chargeback where high priority costs more.
```

Without one of these, priority levels drift upward until they carry no
information, and you are back to first-come-first-served with extra steps.

## Starvation and gang scheduling

```text
  a large job needs 64 CPUs on one machine.
  small jobs keep arriving and filling gaps.
  the large job NEVER runs.
```

Two mechanisms address it:

**Reservation.** Hold resources for the pending large job as they free up, rather
than giving them to the next small job. Costs utilisation — reserved resources sit
idle while accumulating — which is why it is usually paired with **backfill**:
allow a small job to use reserved capacity if it will *finish before* the
reservation is needed.

```text
  reserved for job X at t+10min
  ├──────────────────────────────┤
      ┌────────┐
      │ small  │  ← 3-minute job: allowed, finishes in time
      └────────┘
             ┌──────────────────────┐
             │ small but long       │  ← 20-minute job: refused
             └──────────────────────┘
```

Backfill is what makes reservation affordable, and it requires jobs to declare a
runtime estimate — which they will get wrong, so the scheduler must enforce it.

**Aging.** Increase a waiting job's effective priority over time, so nothing waits
forever regardless of how many higher-priority jobs arrive. Simple, and it
guarantees eventual progress.

## Gang scheduling

Some work needs all its pieces running simultaneously or none:

```text
  distributed training across 8 GPUs:
    7 workers running and 1 pending is not 7/8 of the job.
    it is ZERO progress, holding 7 GPUs.
```

**All-or-nothing scheduling** is required for anything where the parts must
communicate: distributed training, MPI jobs, Spark executors under some
configurations.

Without it, the classic deadlock:

```text
  job A holds 4 GPUs, waiting for 4 more
  job B holds 4 GPUs, waiting for 4 more
  cluster has 8 GPUs total
  → neither can proceed, both hold resources, forever
```

Kubernetes needs an add-on for this (Volcano, Kueue, or a coscheduling plugin) —
the default scheduler places pods individually and will happily create the
deadlock above. If you run distributed training on Kubernetes, gang scheduling is
not optional.

## Isolation: fairness that survives a bad neighbour

Allocation is a promise; **isolation** is enforcement.

```text
  CPU        cgroup shares / quota. compressible: a task exceeding
             its share is throttled, not killed.

  MEMORY     a hard limit. INCOMPRESSIBLE — exceeding it means the
             OOM killer, not throttling.

  DISK I/O   blkio throttling. often weakly enforced in practice.

  NETWORK    traffic shaping. frequently NOT enforced at all —
             the most common source of noisy-neighbour problems.

  CACHE      L3 cache and memory bandwidth are shared and mostly
             unmanaged. this is invisible interference.
```

The bottom three rows are where multi-tenant clusters actually hurt. CPU and
memory are well-isolated by cgroups; network bandwidth, disk IOPS and CPU cache
are shared in ways that are hard to attribute. A latency-sensitive service can be
degraded by a batch job on the same host with no metric showing the connection,
which is the most frustrating class of production mystery.

The practical answer where latency matters: **do not co-locate**. Dedicate hosts,
or use anti-affinity to keep batch off latency-sensitive machines. Perfect
isolation is not achievable, so separation is the reliable defence.

## What to take away

1. Fairness is undefined until you say fair in *which* resource; equal CPU
   produces stranded capacity when users have different resource profiles.
2. Dominant Resource Fairness equalises each user's largest resource share, and is
   sharing-incentive, strategy-proof, envy-free and Pareto-efficient.
3. Strategy-proofness matters practically: without it, teams inflate requests and
   the cluster fills with unused reservations.
4. Hierarchical quotas need borrowing to keep utilisation high, and borrowing
   requires preemption to make reclamation real.
5. Priorities inflate unless high priority is made scarce by budgets, approval or
   cost; reservation with backfill and aging prevent starvation.
6. Gang scheduling is mandatory for distributed training or you get resource
   deadlock; and network, disk and cache isolation are weak enough that
   separation beats co-location for latency-sensitive work.

Next: preemption, autoscaling, and how real schedulers put this together.
