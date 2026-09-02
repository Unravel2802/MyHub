---
title: Tail latency and why averages lie
minutes: 19
summary: Percentiles, fan-out amplification, and the reason your p99 is most users' typical experience.
---

"Average response time: 45 ms" is one of the most misleading sentences in
operations. It is compatible with 99% of requests taking 20 ms and 1% taking
2.5 seconds, and it is compatible with every request taking 45 ms. Those are
completely different systems, and only one of them has a problem — but you
cannot tell which from the average, and the average is what most dashboards show
by default.

## Why the mean is the wrong statistic

Latency distributions are not normal. They are heavily right-skewed with a long
tail: a large cluster of fast responses and a thin smear of very slow ones.

```text
  count
    │ ███
    │ █████
    │ ███████
    │ █████████
    │ ███████████▁▁▁
    │ ██████████████▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁▁
    └──────────────────────────────────────────────────────────
      10ms      50ms                                    3000ms
       ▲          ▲                                        ▲
      p50        mean                                    p99.9
```

For a distribution with this shape, the mean sits somewhere in the empty space
between the bulk and the tail, describing neither. It is dragged upward by
outliers while remaining far below them — the worst of both.

**Use percentiles.** p50 is the typical experience, p99 is the bad experience,
p99.9 is the experience of your most active users (see below), and max tells you
what the system is capable of doing to someone.

## The tail is not rare

The instinct is that p99 affects 1% of requests, so it is a rounding error.
That is wrong twice over.

**First: a page is many requests.** If loading a screen makes 20 backend calls,
the chance that *at least one* hits the p99 is:

```text
  1 - 0.99^20 = 18%
```

Nearly one in five page loads contains a p99 request. And the page is only as
fast as its slowest call, so **the p99 of your services is roughly the p82 of
your pages**.

**Second: your heaviest users hit it most.** A user who makes 100 requests in a
session has a `1 - 0.99^100 = 63%` chance of hitting the p99 at least once.
The people most engaged with your product are the ones most likely to see its
worst behaviour — which is exactly backwards from what you would choose.

```text
  requests per session   chance of hitting p99 at least once
        1                          1%
       10                         10%
       20                         18%
      100                         63%
      500                         99%
```

This is why Google's guidance is to look at p99 and p99.9 rather than p95, and
why "the average is fine" is not a defence when users are complaining.

## Fan-out amplification

The effect gets dramatically worse when one request must wait for many parallel
sub-requests — a search that queries 100 shards, a feed that assembles from
dozens of services.

The parent's latency is the **maximum** of the children, and the maximum of many
samples lands far into the tail.

```text
  1 backend at p99=1s:   parent p99 ≈ 1s
  100 backends, each with a 1% chance of exceeding 1s:

    P(at least one is slow) = 1 - 0.99^100 = 63%

  → the parent exceeds 1s on 63% of requests
  → the backend's ONE-PERCENT case is the parent's TYPICAL case
```

This is the single most important consequence of tail latency, and it is why
large fan-out systems obsess over the tail in a way that services with no
fan-out do not need to.

The defences:

- **Hedged requests.** Send to a second replica if the first has not answered by
  p95, and take whichever returns first. Costs ~5% extra load, and can cut p99
  by an order of magnitude. Requires idempotent reads.
- **Tied requests.** Send to two replicas immediately, each told about the
  other; whichever starts work first cancels the twin. Lower latency than
  hedging, more coordination.
- **Return partial results.** If 98 of 100 shards have answered by the deadline,
  return those and mark the response incomplete. Search engines do this
  constantly; you are seeing partial results more often than you think.
- **Reduce the fan-out.** Fewer, larger shards have a better tail than many
  small ones, because there are fewer chances to draw from the tail.

## Where the tail comes from

The slow requests are usually not slow *code*. The usual causes, roughly in
order of how often they turn out to be the answer:

| Cause | Signature |
| --- | --- |
| Queueing | Latency rises non-linearly with utilisation |
| GC pause | Periodic spikes correlated across a process |
| Lock contention | Spikes correlated with concurrency, not with load |
| Connection pool exhaustion | A latency floor equal to the acquire timeout |
| Cold cache | Spikes after deploys and restarts |
| Noisy neighbour | Random, uncorrelated with your own metrics |
| Retry / backoff | A step function at exactly your backoff interval |
| Slow path in code | The same for every request that takes it |

The last row is the one people look for first and it is rarely the answer. The
top rows are systemic — properties of the environment, not the algorithm — which
is why tail latency is usually fixed by capacity, concurrency limits and
isolation rather than by making code faster.

A specific, common one: **connection pool exhaustion produces a bimodal
distribution**. Most requests get a connection immediately; the rest wait for
the acquire timeout and then either succeed or fail. If your latency histogram
has two humps, look at pool sizing before anything else.

## Measuring it correctly

Three ways people get this wrong even when they are using percentiles.

**Averaging percentiles.** The p99 of an hour is not the mean of sixty per-minute
p99s. Percentiles do not average. You need to merge the underlying
distributions — which is why metrics systems store histograms (HDR histograms,
DDSketch, Prometheus buckets) rather than pre-computed percentiles.

**Coordinated omission.** A load generator that waits for a response before
sending the next request stops sending during a stall, so the stall is measured
once instead of affecting every request that should have been sent during it.
The result understates the tail, sometimes by orders of magnitude. Load
generators must send at a fixed *rate*, not a fixed concurrency, and must record
latency from the time a request *should* have been sent.

**Measuring at the wrong place.** Server-side latency excludes DNS, connection
setup, network transit, and the client's own queueing. The number a user
experiences is often 2–5× the number your service reports. Real user monitoring
exists for this reason.

## Setting targets that mean something

An SLO on latency needs three parts, and dropping any one makes it unenforceable:

```text
  99% of requests complete in under 300 ms, measured over 28 days
  ▲                        ▲                          ▲
  percentile               threshold                  window
```

Guidance worth holding:

- **Threshold from human perception, not from current performance.** ~100 ms
  feels instant, ~1 s keeps attention, >10 s loses it. Setting the target to
  "whatever we do now plus 10%" measures nothing.
- **Percentile from fan-out.** If a page makes 20 calls, a p99 service target
  gives an ~82nd-percentile page. Aim higher on the services than you need on the
  page.
- **Window long enough to be stable.** 28 days is a common choice; an hourly SLO
  is mostly noise.
- **Track the error budget, not just the number.** "We may exceed 300 ms for
  1% of requests" is a budget you can spend deliberately — on a risky deploy, a
  migration — rather than a line you must never cross.

## What to take away

1. Latency distributions are right-skewed, so the mean describes neither the
   typical nor the bad case. Use p50, p99 and p99.9.
2. The tail is not rare from a user's perspective: 20 requests per page makes the
   service p99 roughly the page p82, and heavy users hit it constantly.
3. Fan-out turns a backend's 1% case into the parent's typical case. Hedged
   requests, partial results and lower fan-out are the defences.
4. Tail latency usually comes from queueing, GC, contention and pool exhaustion —
   not from slow code.
5. Percentiles cannot be averaged, and load generators that wait for responses
   silently hide stalls (coordinated omission).
6. An SLO needs a percentile, a threshold and a window, and the threshold should
   come from what a human perceives.

That completes Distributed Fundamentals. Next in the track: **RPC and service
communication** — what actually happens when one service calls another, and why
the abstraction of a "remote function call" is a lie worth understanding
precisely.
