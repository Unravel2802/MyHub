---
title: Capacity planning for ML
minutes: 17
summary: Planning for hardware that is scarce, slow to acquire and expensive to leave idle.
---

Capacity planning for ML differs from ordinary services in one respect that
changes everything: accelerators are frequently **unavailable at any price**.
Scaling out is not a credit-card transaction, so the planning horizon is longer
and the consequences of getting it wrong are larger.

## Scarcity is the constraint

```text
  ordinary compute       need more → provision in minutes

  accelerators           the instance type may be UNAVAILABLE
                         in your region for weeks
                         → capacity reservations, committed
                           contracts, and lead times measured
                           in months
```

```text
  the consequences

  □  plan further ahead — quarters, not weeks
  □  DIVERSIFY instance types, so one shortage does not stop
     everything
  □  reserve baseline capacity; burst on spot and on-demand
  □  keep a fallback: a smaller model or a cheaper GPU that
     can serve if the preferred type is unavailable
```

The fallback plan is the item usually missing. A service that can only run on one
instance type has a single point of failure that is outside your control.

## The purchasing options

```text
  ON-DEMAND            full price, available if capacity exists
  RESERVED / COMMITTED 30–60% cheaper, 1–3 year commitment
  SPOT                 60–90% cheaper, reclaimable
  CAPACITY BLOCKS      reserve N GPUs for a fixed window
  DEDICATED / COLO     lowest unit cost at large scale, and
                       a capital and operations commitment
```

```text
  the standard portfolio

    reserved     ──▶ steady baseline (serving floor,
                     scheduled retrains)
    on-demand    ──▶ predictable bursts
    spot         ──▶ interruptible work (batch, sweeps,
                     checkpointed training)
```

**Do not commit to more than your measured floor.** A reserved instance running at
30% utilisation is more expensive than on-demand at the hours you actually used.
The commitment should cover the capacity you are certain to use continuously, and
nothing more.

## Sizing inference capacity

```text
  1. measure THROUGHPUT per instance at your target latency
       ← not peak throughput; throughput within the p99 budget

  2. peak QPS × safety factor ÷ throughput = instances

  3. add FAILURE HEADROOM — survive losing an instance or a
     zone without exceeding the latency budget

  4. add COLD-START HEADROOM — enough to cover the ramp,
     since scale-up takes minutes
```

```text
  a worked example

    peak 1,000 QPS
    per-instance throughput within budget: 120 QPS
    → 8.3 instances for peak
    → ×1.3 for traffic variance      = 11
    → +1 for N+1 failure tolerance   = 12
    → +2 for cold-start ramp         = 14

  utilisation at peak: 1000 / (14 × 120) = 60%
  → which is the RIGHT target, per the queueing curve
```

Running at 90% to save money puts you on the steep part of the latency curve and
one traffic bump from an incident — the arithmetic from the distributed-systems
track applies unchanged, and matters more here because scale-up is slow.

## Sizing training capacity

```text
  □  how many concurrent experiments does the team need?
  □  how long is an acceptable queue wait?
  □  what is the largest single job's requirement?
     ← this sets the minimum cluster size, and gang
       scheduling means it must be available SIMULTANEOUSLY
  □  what is the utilisation target?
```

```text
  training clusters should run HOT — 70–90% — because
  queueing a batch job is acceptable in a way that queueing
  a user request is not.

  serving clusters should run at 60–70%, because a user is
  waiting.
```

That asymmetry is worth stating: the right utilisation target depends on who is
waiting. Backfilling a training cluster with preemptible work to keep it at 90% is
good engineering; doing the same to a serving fleet is an outage waiting for a
traffic spike.

## Forecasting

```text
  □  historical traffic growth, with seasonality
  □  planned launches and marketing events
  □  model roadmap — a larger model changes the per-request cost
  □  new features that add inference calls per request
     ← the one that surprises: a product change can double
       inference volume with no traffic growth at all
```

```text
  forecast a RANGE, not a number

    conservative   the reserved commitment
    expected       the on-demand plan
    aggressive     the contingency plan — what would we do?

  → and know the LEAD TIME for each option, because that
    determines how early the decision must be made
```

## Multi-region and quota

```text
  □  capacity availability differs by region, sometimes
     dramatically
  □  quotas are per-region and per-instance-type, and raising
     them takes days
  □  data residency may force a region regardless of capacity
  □  cross-region traffic is billed, and it is a real line
```

**Check quotas before you need them.** A launch blocked because a GPU quota
increase takes three business days is a self-inflicted and entirely avoidable
delay, and it happens routinely.

## Efficiency as capacity

The reframing that makes optimisation urgent rather than optional:

```text
  a 2× throughput improvement is a 50% capacity increase
  that requires NO hardware, NO quota, NO lead time.
```

```text
  when capacity is scarce, efficiency work has a much higher
  return than usual:

    batching                5–20×
    quantisation            2–4×
    a distilled model       2–10×
    caching                 varies, often large
    MFU improvement         1.5–2× on training
```

In a scarcity environment, the team that has done the efficiency work has more
effective capacity than the team that has not, regardless of allocation. That is
the strongest practical argument for treating the inference-optimization material
as a capacity strategy rather than a performance hobby.

## The review

```text
  MONTHLY
    □  spend by category, versus forecast
    □  utilisation of reserved commitments
    □  cost per 1,000 predictions — is it falling?
    □  the largest single line, and whether it is expected

  QUARTERLY
    □  reservation and commitment renewals
    □  unused resource audit
    □  build-versus-buy re-evaluation at current volume
    □  capacity forecast for the next two quarters
```

## What to take away

1. Accelerator scarcity means capacity may be unavailable at any price — plan in
   quarters, diversify instance types, and keep a fallback model.
2. Commit only to your measured floor; a reserved instance at 30% utilisation
   costs more than on-demand.
3. Size serving for peak plus variance plus failure headroom plus cold-start ramp,
   targeting 60–70% utilisation at peak.
4. Training clusters should run hot (70–90%) and serving clusters should not — the
   difference is who is waiting.
5. Forecast a range with known lead times, and check quotas before you need them.
6. When capacity is scarce, a 2× efficiency improvement is a 50% capacity increase
   with no lead time — which makes optimisation a capacity strategy.

That completes cost and capacity. Next in the track: **labelling and
human-in-the-loop** — where training data comes from.
