---
title: Chaos engineering
minutes: 18
summary: Verifying that resilience mechanisms work, since every one of them is untested until it is exercised.
---

Every mechanism in this topic — the fallback, the circuit breaker, the failover,
the bulkhead — is code that runs only when something is broken. That means it is
the least-exercised code in the system, and by default it does not work. Chaos
engineering is the practice of breaking things deliberately, while you are
watching, to find out.

## It is an experiment, not vandalism

The framing that makes it defensible and useful:

```text
  1. STEADY STATE     define a measurable normal
                      "checkout success rate ≥ 99.5%"
                      NOT "CPU is fine" — a business metric

  2. HYPOTHESIS       "killing one of three payment-service
                       instances will not change checkout
                       success rate"

  3. EXPERIMENT       inject the failure, in the smallest
                      blast radius that can test the hypothesis

  4. OBSERVE          did the steady state hold?

  5. CONCLUDE         hypothesis held → confidence increased
                      hypothesis failed → you found a bug BEFORE
                                          a customer did
```

The hypothesis is what distinguishes this from randomly breaking production. You
are asserting a belief about the system and testing it. A failed experiment is
the *point*, not an accident — it is a bug found under controlled conditions with
everyone watching, rather than at 3am.

## What to inject

Ordered roughly by how often each finds something:

```text
  LATENCY           add 500 ms to a dependency
                    → finds missing timeouts, exhausted pools,
                      cascading slowness.  THE HIGHEST-YIELD ONE.

  ERRORS            return 500s from a dependency at some rate
                    → finds missing fallbacks and retry storms

  PROCESS PAUSE     SIGSTOP for longer than the lease TTL
                    → finds broken leader election and lock
                      assumptions. simulates a GC pause exactly.

  INSTANCE KILL     terminate a node
                    → finds failover gaps and warm-up problems

  NETWORK PARTITION split the cluster
                    → finds split brain and consistency violations

  RESOURCE PRESSURE fill a disk, exhaust memory, saturate CPU
                    → finds unbounded queues and missing limits

  CLOCK SKEW        shift a node's clock
                    → finds lease and timestamp assumptions

  DEPENDENCY DOWN   remove a service entirely
                    → tests the degradation you designed
```

**Latency injection finds more bugs than instance termination**, which is the
opposite of where most teams start. Killing a node is the failure systems handle
best, because it is obvious and everything is designed for it. A dependency that
becomes slow rather than dead is the case that exposes missing timeouts,
unbounded pools and the "slow is worse than dead" dynamic — and almost nothing is
designed for it.

**SIGSTOP is the most under-used and highest-value injection** for anything using
leases: it reproduces the pause that breaks lock and leadership assumptions
exactly, deterministically, and with no special tooling.

## Blast radius, and earning the right to production

```text
  1. a local test        one process, mocked failures
  2. a staging test      a full environment, real injections
  3. production, 1%      one instance, or 1% of traffic
  4. production, 1 cell  a full cell, during business hours
  5. production, region  a full region — the game-day scale
```

The rule at every level: **have an abort button and a blast radius you can state
in advance.** An experiment you cannot stop is not an experiment.

And the precondition people skip: **do not run chaos experiments on a system you
cannot observe.** If you cannot tell whether the steady state held, you learn
nothing from the experiment and take the risk for free. Observability is a
prerequisite, not a parallel effort.

## Game days

The human half, and often more valuable than the automation.

```text
  a scheduled exercise where a team deliberately breaks something
  and practises responding

  what it tests that automation cannot:
    □  can the on-call engineer find the problem?
    □  are the dashboards useful, or decorative?
    □  is the runbook accurate, or aspirational?
    □  does the alert fire, and does it say anything useful?
    □  does escalation work at 3am?
    □  can two teams coordinate, or do they both wait?
```

A game day almost always finds that a runbook references a tool that was
decommissioned, a dashboard was broken by a migration, or an alert routes to
someone who left. Those are outage-lengthening defects that no automated test
detects, and finding them costs an afternoon.

**Run them in production.** Staging does not have production's traffic, data
volume, or dependencies, and a runbook that works in staging is a runbook that
has not been tested.

## Where to start

The honest progression for a team that has not done this:

```text
  1. Can you observe? Dashboards, alerts, distributed tracing.
     If not, start there.

  2. Table-top exercise. No injection at all — talk through a
     failure and see whether anyone can say what would happen.
     This finds a surprising amount for zero risk.

  3. Staging injections. Latency first, then errors.

  4. Production, smallest possible radius, during business hours,
     with the team watching and an abort ready.

  5. Automate the experiments that have passed, so they keep
     passing as the system changes.
```

Step 2 is genuinely valuable and universally skipped. Asking "what happens if the
cache is empty?" in a room often produces "I don't know" from everyone, which is
the finding.

Step 5 is what makes it durable: a resilience property verified once decays. An
automated experiment running weekly is a regression test for the failure paths.

## The prerequisites, stated plainly

Chaos engineering is not the first thing to do. Before it is useful:

```text
  □  you can measure a business-level steady state
  □  you have alerting that works
  □  you have timeouts, retries with backoff, and circuit breakers
  □  you have deliberate degradation paths
  □  you can roll back quickly
```

Injecting failure into a system with none of these tells you what you already
know: it breaks. The value comes from testing mechanisms that are supposed to
handle it.

## What to take away

1. Chaos engineering is a hypothesis-driven experiment against a measurable
   business-level steady state — the hypothesis is what distinguishes it from
   breaking things.
2. Latency injection finds more bugs than instance termination, because systems
   are designed for the obvious failure and not for the slow one.
3. SIGSTOP reproduces the GC pause that breaks lease and leadership assumptions,
   deterministically and with no tooling.
4. Always have a stated blast radius and an abort button; never run experiments on
   a system you cannot observe.
5. Game days find broken runbooks, decorative dashboards and misrouted alerts —
   defects no automated test catches — and must be run in production.
6. Start with a table-top exercise; automate the experiments that pass, because a
   verified resilience property decays.

That completes failure modes and resilience. Next in the track: **batch and
stream processing** — computing over data at rest and in motion, and the duality
between them.
