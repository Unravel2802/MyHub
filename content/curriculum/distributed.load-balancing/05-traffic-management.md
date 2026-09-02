---
title: Traffic management
minutes: 19
summary: Using routing deliberately — canaries, shadows, migrations and the failover that must consider data.
---

Once the routing layer can make per-request decisions, it becomes a tool for
something more valuable than balance: **controlling exposure**. Every risky
change — a deploy, a migration, a new dependency — can be rolled out to a
fraction of traffic first, and rolled back by changing a weight rather than by
redeploying.

## Progressive delivery

```text
  BLUE-GREEN                    CANARY                 ROLLING

  two full environments;        a small % to the new    replace instances
  switch all traffic at once    version, then grow      one batch at a time

  + instant rollback            + limited blast radius  + no extra capacity
  + full pre-switch testing     + real traffic signal   + the default
  - 2× capacity                 - both versions run     - both versions run
  - all users at once             simultaneously        - rollback = redeploy
```

**Canary is the one to build deliberately**, because it converts "we think this is
fine" into a measurement:

```text
  1%  ──── soak 10 min, compare metrics ────▶ 5%
  5%  ──── soak 10 min ─────────────────────▶ 25%
  25% ──── soak 20 min ─────────────────────▶ 100%

  at any stage, a regression → weight back to 0
```

The comparison is what makes it a canary rather than a slow rollout. Compare
canary against baseline on **error rate, latency percentiles, and a business
metric** — the last one catches the change that is technically healthy and
commercially catastrophic, which no infrastructure metric sees.

Two mistakes worth avoiding:

- **Too small a canary for too short a time.** 1% of traffic for two minutes may
  contain zero instances of the code path that breaks. Size the canary from the
  rate of the event you are trying to observe.
- **Comparing the canary against history rather than against a concurrent
  baseline.** Traffic patterns change hourly; the only fair comparison is against
  the old version running at the same moment.

## Shadow traffic

Send a copy of real requests to the new version and **discard the response**.

```text
  request ──┬──▶ v1 (production)  ──▶ response to the user
            │
            └──▶ v2 (shadow)      ──▶ response DISCARDED, but
                                       compared and recorded
```

Real traffic shape, real payloads, zero user risk. Excellent for validating a
rewrite, a new database, or a model change before it serves anyone.

**The mandatory caveat: the shadow must not cause side effects.** A shadowed
request that charges a card, sends an email, or writes to the production database
has just done it twice. Shadowing is safe only for read paths, or with the write
path pointed at a separate store — and this needs verifying, not assuming, because
the side effect is usually several layers down.

Also budget the load: shadowing doubles the traffic to your dependencies unless
they too are shadowed.

## Migration patterns

**Dark launch.** Ship the code disabled, enable it by flag. Separates *deploying*
from *releasing*, which means the risky moment is a config change with instant
rollback rather than a deploy.

**Dual read with comparison.** Migrating a datastore:

```text
  read ──┬──▶ OLD store  ──▶ returned to the user
         └──▶ NEW store  ──▶ compared, differences logged

  run for weeks. when the difference rate is zero, switch
  which one is authoritative.
```

This is the safest datastore migration technique there is, and it is
under-used because it requires writing the comparison. The difference log is the
entire value: it tells you precisely which cases the new store gets wrong, with
real data, before anyone depends on it.

**Strangler fig.** Route paths to a new service incrementally:

```text
  /api/orders/*     ──▶ new service
  /api/*            ──▶ legacy monolith

  move one path at a time; the routing layer is the seam
```

The routing layer is what makes this possible without changing clients, and it is
the standard approach for decomposing a monolith.

## Failover, and the two things people get wrong

```text
  primary region unreachable
     ↓
  route to secondary
```

**First: does the secondary have the data?** Sending traffic to a region without
the user's data turns a partial outage into a total one, more slowly. Failover
must be a data decision before it is a traffic decision.

**Second: can the secondary take the load?** A secondary running at 40% of the
primary's capacity will be overwhelmed by 100% of the traffic, and will then fail
too — turning a single-region outage into a global one.

```text
  ┌──────────────────────────────────────────────────────┐
  │  if failover sends 100% of traffic to a region        │
  │  provisioned for 50%, you have not failed over —      │
  │  you have moved the outage and made it larger.        │
  └──────────────────────────────────────────────────────┘
```

The correct designs: provision the secondary for the full load (expensive), fail
over partially and shed the rest, or degrade functionality in the secondary to
fit the capacity. All three are defensible; not deciding is not.

And **test it**. A failover path that has never been exercised does not work —
the same rule as the replication topic, and it is broken as often here.

## Traffic shaping

Routing is also where you shape load, and prioritisation is the part usually
missing:

```text
  RATE LIMITING     per client, per endpoint, per tenant
  PRIORITISATION    user-facing traffic above batch and retry traffic
  ADMISSION CONTROL reject early when queues are deep
  QUEUING           a bounded queue, with deadline-aware dropping
```

Prioritisation deserves emphasis because it changes what an overload looks like:

```text
  WITHOUT priority          WITH priority
  ───────────────           ─────────────
  everything degrades       batch jobs and retries are shed first
  equally; users see        interactive users still succeed
  timeouts
```

Marking retries as retries — an explicit header — lets the routing layer shed
them first, which simultaneously protects users and breaks retry amplification.
That is a small change with a disproportionate effect during an incident.

## The controls worth having before you need them

```text
  □  shift traffic by weight, per version                (canary/rollback)
  □  shift traffic by region                              (failover)
  □  a kill switch per feature                            (dark launch)
  □  per-tenant rate limits                               (noisy neighbour)
  □  a priority class per request type                    (overload)
  □  shed retries first                                   (amplification)
  □  a documented, tested failover runbook                (the real one)
```

Every one of these is a control you want to *already have* during an incident,
not one you want to build during it. The cost of building them in advance is
modest; the cost of not having them is measured in the length of an outage.

## What to take away

1. Canary releases convert "we think this is fine" into a measurement — compare
   against a concurrent baseline, on business metrics as well as technical ones.
2. Shadow traffic gives real-traffic validation at zero user risk, and is safe
   only when side effects are genuinely absent — verify rather than assume.
3. Dual-read with difference logging is the safest datastore migration technique,
   and the difference log is the whole value.
4. Failover must be a data decision before a traffic decision, and a secondary
   that cannot take the load moves the outage rather than fixing it.
5. Prioritising user traffic over batch and retry traffic changes overload from
   "everything degrades" to "users still succeed".
6. Build the traffic controls before the incident; they are cheap in advance and
   very expensive to improvise.

That completes load balancing and routing. Next in the track: **failure modes and
resilience** — how these systems actually fall over, and the patterns that stop a
local problem becoming a global one.
