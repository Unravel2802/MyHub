---
title: Balancing algorithms
minutes: 19
summary: Why round robin is the wrong default, and why sampling two servers beats tracking all of them.
---

Given a set of healthy backends, which one gets the next request? The choice
matters more than it looks, because the failure it produces — one overloaded
backend beside idle ones — is exactly what load balancing was supposed to
prevent.

## Round robin, and why it fails

```text
  request 1 → A    request 4 → A
  request 2 → B    request 5 → B
  request 3 → C    request 6 → C
```

Round robin assumes **requests cost the same** and **servers are equally fast**.
Both assumptions fail routinely:

```text
  request costs vary enormously
    GET /health          →   1 ms
    GET /report?year=all → 4,000 ms

  server speed varies
    a GC pause, a noisy neighbour, a cold cache, an older
    instance type in the same pool
```

The failure mode this produces is the important part:

```text
  server B enters a 2-second GC pause.
  round robin keeps sending it every third request.
  B's queue grows. requests to B time out.
  → a third of all traffic fails, and the balancer
    does not notice anything is wrong
```

Round robin is **actively harmful under partial degradation**, because it sends
work to a struggling server at exactly the same rate as to healthy ones. Its only
virtues are simplicity and statelessness.

## Least outstanding requests

Track how many requests are in flight to each backend; send the next one to the
smallest.

```text
  A: ███ 3 in flight
  B: ████████ 8 in flight     ← slow or handling expensive work
  C: ██ 2 in flight           ← next request goes here
```

This is **self-correcting** and it is the property that makes it the right
default. A slow backend accumulates in-flight requests, so it automatically
receives fewer. It needs no knowledge of request cost, no health data, and no
configuration — the queue depth *is* the signal.

The cost is state: the balancer must track in-flight counts, which is trivial in
one process and awkward across a fleet of balancers, each of which sees only its
own requests.

## Power of two choices

The result that resolves that cost, and it is a genuinely surprising one.

```text
  instead of checking ALL backends:
    pick TWO at random, send to whichever has fewer in flight
```

```text
  maximum load relative to average, with n servers

    random choice          →  O(log n / log log n)
    power of two choices   →  O(log log n)      ← exponentially better
    full least-loaded      →  O(1), at O(n) cost per decision
```

Sampling two gets nearly all the benefit of checking every server, at constant
cost and with no global state. The intuition: with pure random assignment,
imbalance compounds because nothing corrects it; with two samples, the *worse* of
the two is consistently avoided, and that small amount of selection pressure is
enough to keep the maximum close to the mean.

It also works when several independent balancers each have partial information,
which the exact algorithm does not. This is why it appears in Nginx, Envoy,
HAProxy and most modern client-side libraries, and it is the algorithm to choose
if you are choosing one.

## The full menu

| Algorithm | State needed | Adapts to slow servers | Notes |
| --- | --- | --- | --- |
| Round robin | none | ❌ | Only for uniform, fast requests |
| Weighted round robin | static weights | ❌ | For heterogeneous hardware |
| Random | none | ❌ | Simpler than RR, similar behaviour |
| **Least outstanding** | in-flight counts | ✅ | The best single choice |
| **Power of two choices** | two samples | ✅ | Nearly as good, no global state |
| Least response time | latency EWMA | ✅ | Can oscillate; needs damping |
| Peak EWMA | latency + in-flight | ✅ | Envoy/Finagle; strong under variance |
| Consistent hashing | ring | ❌ | For affinity, not for balance |
| Maglev hashing | lookup table | ❌ | Consistent hashing with better spread |

**Least response time needs care.** Picking the fastest backend sends it more
traffic, which makes it slower, which sends traffic elsewhere — an oscillation.
Exponentially weighted moving averages plus in-flight counts (Peak EWMA) damp
this, which is why the naive version is not recommended.

## Consistent hashing: affinity, not balance

Route by a key so the same key reaches the same backend:

```text
  hash(user_id) → backend

  ✓  cache locality — that backend already has this user's data
  ✓  sticky sessions without shared session storage
  ✗  a hot key overloads one backend
  ✗  cannot adapt to a slow backend at all
```

This is a **different objective**, and mixing it up with balancing causes
problems. Use it when locality is worth more than evenness — an in-process cache
with a high hit rate, or a stateful shard owner — and accept that balance is
sacrificed.

**Bounded-load consistent hashing** is the refinement worth knowing: keep the
affinity, but if a backend exceeds a threshold (say 1.25× the average), overflow
to the next one on the ring. You keep most of the cache locality and cap the
damage from a hot key.

## Slow start

A newly added backend is cold — empty caches, an unwarmed JIT, unfilled
connection pools. Sending it a full share immediately makes it slow, which under
a load-aware algorithm makes it look overloaded, which is correct but unhelpful.

```text
  slow start: ramp a new backend's weight from 0 to 100%
              over 30–60 seconds
```

Without it, an autoscaling event or a rolling deploy produces a latency spike
every time an instance joins. This is a small setting with a large effect on how
deploys feel.

## Retries and their interaction with balancing

A retry should go to a **different** backend than the failed attempt — retrying
the same instance that just failed is usually wasted.

```text
  request → A → 503
  retry   → B      ← not A
```

And every retry is additional load applied to a system that is already
struggling, which is the amplification problem from the fundamentals topic. The
balancer is where a **retry budget** belongs, because it is the component that
can see the ratio:

```text
  retries may not exceed 10% of total requests in the last minute
```

Under normal conditions the budget is never touched; under widespread failure it
caps the amplification cluster-wide, which no per-request attempt limit can do.

## Choosing

```text
  Do you need cache affinity or session stickiness?
    └─ YES ──▶ bounded-load consistent hashing

  Do requests vary widely in cost, or servers in speed?
    └─ YES ──▶ least outstanding, or power of two choices

  Are you balancing across many independent balancers?
    └─ YES ──▶ power of two choices (no global state needed)

  Is everything uniform and fast?
    └─ round robin is fine — but the others are not worse
```

The practical recommendation is short: **default to power of two choices**, add
slow start, add a retry budget, and use consistent hashing only where you
deliberately want affinity.

## What to take away

1. Round robin assumes uniform request cost and uniform server speed, and it
   keeps feeding a degraded server at full rate.
2. Least outstanding requests is self-correcting because queue depth is the
   signal — no health data or configuration needed.
3. Power of two choices gets nearly the same result at constant cost and with no
   global state, which is why it is the default in modern balancers.
4. Least-response-time balancing oscillates without damping; use in-flight counts
   alongside latency.
5. Consistent hashing optimises affinity, not balance; bounded-load variants cap
   the damage from a hot key.
6. Add slow start for new backends, and put the retry budget in the balancer,
   where the ratio is visible.

Next: health checking — deciding which backends are eligible at all.
