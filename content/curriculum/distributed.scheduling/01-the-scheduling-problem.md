---
title: The scheduling problem
minutes: 18
summary: Placing work on machines, and why the obvious formulation is NP-hard and the obvious architecture does not scale.
---

A cluster scheduler answers one question continuously: which machine should run
this work? It is an optimisation problem with hard constraints, soft preferences,
incomplete information and a deadline of milliseconds — and the exact answer is
computationally intractable, so every real scheduler is a well-chosen
approximation.

## What a scheduler decides

```text
  a request arrives:
    "4 CPUs, 16 GB RAM, 100 GB disk, a GPU, in zone us-east-1a,
     not on the same host as its two siblings, near its data"

  the cluster:
    1,000 machines, each partly occupied, some with GPUs,
    spread over zones, some being drained, some unhealthy

  the scheduler must choose one — in milliseconds, thousands of
  times per minute, without making tomorrow's placements worse
```

Three things make it more than a lookup:

**It is multi-dimensional.** A machine with free CPU but no free memory cannot
take a memory-heavy task. Fitting along one axis is easy; fitting along four is
where the difficulty starts.

**Decisions are long-lived.** A task placed now may run for weeks. A greedy choice
that fits today can fragment the cluster so tomorrow's large task fits nowhere.

**The state is stale.** By the time the scheduler decides, machines have finished
tasks, started others, or failed. Every placement is made against an out-of-date
picture.

## Bin packing, and its intractability

The core is multi-dimensional bin packing: fit items of various sizes into as few
bins as possible.

```text
  machine A: [CPU ████░░░░] [MEM ██████░░]
  machine B: [CPU ██░░░░░░] [MEM ███████░]
  machine C: [CPU ███████░] [MEM ██░░░░░░]

  a task needing [CPU ███] [MEM ███] fits on... A? B? C?
    A: CPU yes (4 free), MEM yes (2 free — no, needs 3)
    B: CPU yes, MEM no
    C: CPU no, MEM yes
  → nowhere, despite the cluster having plenty of both in total
```

That picture is **resource fragmentation**, and it is the scheduler's central
enemy: the cluster has the capacity and cannot use it, because the free capacity
is distributed wrongly.

Bin packing is NP-hard even in one dimension, so schedulers use heuristics:

```text
  FIRST FIT        the first machine that fits
                   → fast, and fragments badly

  BEST FIT         the machine with the LEAST remaining capacity
                   after placement
                   → packs tightly, leaves large holes elsewhere
                   → good for cost (fewer machines), bad for
                     absorbing growth in place

  WORST FIT        the machine with the MOST remaining capacity
                   → spreads out, leaves room to grow
                   → uses more machines

  SCORED           weight several factors and take the best score
                   → what real schedulers do
```

The choice encodes a policy rather than a truth:

```text
  BIN PACK (best fit)          SPREAD (worst fit)
  ───────────────────          ──────────────────
  fewer machines → lower cost  better fault tolerance
  can scale down aggressively  more headroom per task
  noisy neighbours             wasted capacity
  a machine failure takes      a machine failure takes
  many tasks with it           few tasks with it
```

Batch and cost-sensitive workloads pack; latency-sensitive and
availability-sensitive ones spread. Most schedulers let you express this per
workload, and the mistake is applying one policy cluster-wide.

## Constraints and preferences

```text
  HARD CONSTRAINTS (must)           SOFT PREFERENCES (should)
  ───────────────────────           ─────────────────────────
  enough free CPU/memory/disk       prefer a zone with fewer replicas
  a required GPU or hardware        prefer a machine with a warm
  a specific zone or region           image cache
  affinity: near this other task    prefer a less loaded machine
  ANTI-affinity: not with these     prefer to spread across racks
  taints and tolerations
  licence or compliance limits

  → filter                          → score and rank
```

Every scheduler is fundamentally **filter then score**: eliminate machines that
cannot host the task, rank the survivors, take the best. That two-phase structure
is worth recognising because it is universal — Kubernetes, Mesos, Nomad and
Borg all work this way.

**Anti-affinity is the constraint that matters most for availability**, and it is
routinely under-specified. Three replicas placed on one machine survive nothing;
three replicas spread across three zones survive a zone loss. Expressing that as
a hard constraint ("never two replicas on one host") versus a preference
("prefer different hosts") is a real decision: a hard constraint means the
deployment cannot proceed when the cluster is full, and a preference means it
degrades silently to a bad placement. Most systems should use a hard constraint
for hosts and a preference for zones.

## Two architectures

```text
  MONOLITHIC                        TWO-LEVEL / SHARED-STATE

  one scheduler sees everything     several schedulers work
  and decides everything            concurrently

  ┌────────────────┐                ┌──────┐ ┌──────┐ ┌──────┐
  │   scheduler    │                │sched1│ │sched2│ │sched3│
  └───────┬────────┘                └───┬──┘ └───┬──┘ └───┬──┘
          ▼                             └────────┼────────┘
     all machines                                ▼
                                          shared cluster state
                                          (optimistic; conflicts
                                           are detected on commit)

  + optimal decisions                + scales; specialised policies
  + simple to reason about             per workload
  - a throughput bottleneck          - conflicts when two schedulers
  - one policy for everything          pick the same machine
  - a single point of failure        - decisions on stale state
```

**Omega-style shared state with optimistic concurrency is what large systems
use.** Each scheduler works from a shared snapshot, picks a placement, and
attempts to commit; a conflict means another scheduler took the machine first, so
it retries. Conflicts are rare when the cluster has slack and frequent when it is
nearly full — which is the same optimistic-concurrency behaviour as the
coordination topic, and it degrades the same way.

Mesos's two-level model is the other approach: the master *offers* resources to
frameworks, which accept or decline. It avoids conflicts by construction and
gives up global optimisation, since each framework sees only what it was offered.

## The scale problem

```text
  10,000 machines × 100,000 pending tasks
  = one billion (machine, task) pairs to evaluate

  → scoring every machine for every task is not possible
```

The universal answer is **sampling**: score a random subset rather than
everything.

```text
  Kubernetes scores a percentage of nodes (scaling down as the
  cluster grows, with a floor), and stops once it has found
  enough good candidates.

  Sparrow and similar batch schedulers use POWER OF TWO CHOICES:
  sample two machines, pick the better.
```

That is the same result as the load-balancing chapter, applied to placement: near
-optimal quality from a constant-size sample, with no global state. It recurs
because it is the general answer to "choose well among many options cheaply".

## Latency, and the two regimes

```text
  LONG-RUNNING SERVICES             BATCH / SHORT TASKS
  ─────────────────────             ───────────────────
  minutes to place is fine          milliseconds matter
  quality matters more than speed   throughput matters more
  → careful scoring, many           → sampling, minimal scoring,
    constraints                       distributed schedulers
```

A scheduler optimised for one is wrong for the other, which is why large clusters
run **several schedulers side by side** over shared state: a careful one for
services, a fast one for batch. Trying to serve both with one policy produces a
scheduler that is too slow for batch and too crude for services.

## What to take away

1. Scheduling is multi-dimensional bin packing under hard constraints and soft
   preferences, with stale state and a millisecond budget.
2. Fragmentation — free capacity distributed wrongly — is the central enemy, and
   it is why a cluster with plenty of spare resources can have nowhere to put a
   task.
3. Pack for cost, spread for availability; the choice is a per-workload policy,
   not a cluster-wide truth.
4. Every scheduler is filter-then-score, and anti-affinity for replicas is the
   constraint most worth getting right.
5. Shared-state optimistic scheduling scales by allowing conflicts and retrying;
   conflicts become frequent exactly when the cluster is full.
6. Sampling a subset (power of two choices again) gives near-optimal placement at
   constant cost, and services and batch want different schedulers.

Next: fairness — dividing a cluster between tenants who all want all of it.
