---
title: Job orchestration
minutes: 17
summary: Getting training jobs onto expensive hardware, and the queue discipline that keeps it busy.
---

Training jobs are batch jobs with unusual properties: they need many machines
simultaneously, they run for days, they need specific accelerators, and the
hardware is expensive enough that idle time is a line item someone notices. The
cluster-scheduling topic covers the general problem; this is what is specific.

## What makes ML jobs awkward to schedule

```text
  GANG SCHEDULING       8 GPUs or nothing. 7 running and 1
                        pending is zero progress holding 7 GPUs.
                        → without it, resource deadlock

  LONG RUNNING          days to weeks. a placement decision is
                        long-lived; fragmentation compounds.

  SPECIFIC HARDWARE     not just "a GPU" — H100 vs A100 vs L4,
                        and interconnect topology matters as much
                        as the card

  TOPOLOGY SENSITIVE    8 GPUs on ONE node with NVLink beats
                        8 GPUs across 8 nodes by a wide margin

  BURSTY DEMAND         nothing for a week, then forty jobs
                        before a deadline
```

Gang scheduling and topology awareness are the two that generic schedulers get
wrong. Kubernetes' default scheduler places pods individually and will happily
create the deadlock above — running distributed training on Kubernetes requires a
gang scheduler (Volcano, Kueue, or a coscheduling plugin), not as an optimisation
but for correctness.

## Topology matters more than card count

```text
  8 × A100 on ONE node, NVLink        ~600 GB/s between GPUs
  8 × A100 across 8 nodes, 100 GbE     ~12 GB/s

  → a 50× difference in interconnect bandwidth
  → for communication-heavy training, the same eight cards
    can differ by 2–5× in throughput
```

A scheduler that satisfies "8 GPUs" without regard to placement can hand you a
job that runs several times slower for the same cost. Requesting topology —
"8 GPUs on one node", or "within one rack/NVLink domain" — is a real requirement,
and it is why ML clusters are usually specified in whole nodes rather than
individual cards.

## Queues and priority

```text
  research           preemptible, best effort, cheap
  production retrain scheduled, guaranteed, on time
  interactive/debug  small, fast to start, short-lived
  hyperparameter
  sweeps             many small jobs, individually preemptible
```

The queue discipline that works in practice:

```text
  □  GUARANTEE the production retrains — they are on a schedule
     and someone depends on them
  □  BACKFILL everything else into the gaps, preemptibly
  □  keep a small INTERACTIVE pool always available —
     otherwise a five-minute debug job waits four hours behind
     a training run, and people stop using the cluster
  □  age waiting jobs so nothing starves
  □  budget high priority, or everything becomes high priority
```

The interactive pool is the one that is usually missing and that determines
whether researchers find the cluster usable. A cluster that is 95% utilised and
takes hours to run a debug job is a cluster people work around by keeping a
private machine — which is worse for utilisation than reserving the pool would
have been.

## Job specification

```text
  □  resources: GPUs, type, CPU, memory, disk
  □  topology requirement
  □  the container image DIGEST (not a tag)
  □  the entrypoint and full config
  □  where checkpoints go
  □  a maximum runtime — a bounded lease, so a hung job
     releases its GPUs
  □  a retry policy: how many restarts, and on what
  □  priority and queue
```

**The maximum runtime is the one people omit**, and its absence is why clusters
accumulate zombie jobs — a hung collective holding 64 GPUs for a week because
nothing bounded it. A max runtime with automatic checkpoint-and-requeue converts
that from a wasted week into a restart.

## Cost visibility

```text
  a training run's cost:

    GPU-hours × price
    + storage for checkpoints and datasets
    + data transfer (cross-zone reads are billed)
    + the idle time of a reserved-but-unused reservation

  attribute this PER JOB, PER TEAM, PER EXPERIMENT.
```

Cost attribution changes behaviour more reliably than any policy. A team that can
see "this sweep cost $4,000 and the winning config was in the first ten runs"
designs better sweeps. A team that cannot see it runs the sweep again.

The specific waste to look for:

```text
  □  jobs at low MFU — paying full price for a third of the
     hardware
  □  sweeps with no early stopping — running all 200
     configurations to completion when ASHA would have killed
     150 of them in the first 10%
  □  idle reserved capacity
  □  checkpoints never deleted — terabytes of them
  □  datasets staged in every zone
```

## The developer experience question

```text
  the friction that determines whether the platform is used:

  □  how long from "submit" to "running"?
  □  can I get an interactive session on a GPU quickly?
  □  can I see logs and metrics without hunting?
  □  can I reproduce a failed run locally at small scale?
  □  is submitting a job one command, or a YAML odyssey?
```

**If submitting a job is hard, people will run training on their laptop or a
personal VM**, and you lose tracking, reproducibility, cost visibility and
sharing. Platform adoption is a function of friction, and the fix for
"nobody uses the platform" is almost always to remove steps rather than to mandate
usage.

The strongest single improvement is usually a one-command submit that takes the
current directory, builds or reuses an image, and returns a link to the logs.

## The progression

```text
  1. a script on one machine
       → correct for the first model. do not skip it.

  2. a scheduler + shared GPU nodes (Slurm, Ray, Kubernetes+Kueue)
       → when several people contend for hardware

  3. queues, priorities, quotas, cost attribution
       → when contention is routine

  4. a managed platform (SageMaker, Vertex, or an internal one)
       → when the operational load justifies it
```

Skipping to 4 before 2 is the "platform nobody asked for" anti-pattern from the
lifecycle topic. Build the platform from what actually hurt on the second and
third real jobs.

## What to take away

1. Gang scheduling is a correctness requirement for distributed training, not an
   optimisation — without it you get resource deadlock.
2. Topology matters as much as card count: eight GPUs on one NVLink node can be
   several times faster than eight spread across nodes.
3. Reserve a small interactive pool, or people keep private machines and
   utilisation gets worse than the reservation would have cost.
4. Always set a maximum runtime with checkpoint-and-requeue, or hung jobs hold
   accelerators for days.
5. Attribute cost per job, per team and per experiment — visibility changes
   behaviour more reliably than policy.
6. Platform adoption is a function of friction; a one-command submit is worth more
   than any mandate.

Next: debugging a training run that is not learning.
