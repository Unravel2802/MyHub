---
title: Why physical clocks lie
minutes: 20
summary: Drift, NTP, leap seconds, and why you must never use wall-clock time to measure a duration.
---

Every machine has a clock, every clock is wrong, and they are wrong in different
directions by amounts that change. That would be a curiosity except that
distributed systems constantly want to answer "which of these two events
happened first", and the obvious way to answer it — compare timestamps — is
unsound. This chapter is about exactly how unsound, and about the two clocks
every operating system gives you and which one to use when.

## Two clocks, and the one you are probably misusing

Every OS exposes two fundamentally different clocks, and conflating them is the
most common time bug in production code.

```text
  WALL CLOCK (real time)            MONOTONIC CLOCK
  ────────────────────              ───────────────
  "what time is it?"                "how much time has passed?"

  time.time()                       time.monotonic()
  System.currentTimeMillis()        System.nanoTime()
  clock_gettime(CLOCK_REALTIME)     clock_gettime(CLOCK_MONOTONIC)

  ▸ meaningful across machines      ▸ meaningless across machines
  ▸ can JUMP — forward or BACKWARD  ▸ never goes backward
  ▸ adjusted by NTP, admins, DST    ▸ unaffected by clock adjustments
  ▸ use for: timestamps, logs,      ▸ use for: timeouts, durations,
    expiry, anything a human reads    rate limits, benchmarks, retries
```

The rule is absolute:

> **Never measure a duration with the wall clock.**

```python
# WRONG — an NTP correction mid-request produces nonsense
start = time.time()
do_work()
elapsed = time.time() - start          # can be NEGATIVE

# RIGHT
start = time.monotonic()
do_work()
elapsed = time.monotonic() - start     # always >= 0
```

A negative elapsed time is not hypothetical. It happens whenever NTP steps the
clock backwards during your measurement, and the downstream effects are
memorable: a cache TTL that never expires, a rate limiter that lets everything
through, a retry loop that sleeps for what it computes as a negative duration and
therefore does not sleep at all — a busy loop, discovered at 3am.

The monotonic clock's counterpart limitation: it measures from an arbitrary
origin (often boot), so a monotonic value from one machine means nothing on
another, and it cannot be stored and compared across a restart.

## How wrong is the wall clock?

**Quartz drift.** A typical crystal oscillator drifts 10–100 parts per million
with temperature. At 50 ppm:

```text
  50 ppm = 50 µs per second
         = 4.3 seconds per day
         = ~2 minutes per month
```

An unsynchronised server is minutes wrong within weeks. Temperature matters
measurably — a machine under heavy load runs warmer and drifts differently from
an idle one beside it.

**NTP corrects this, imperfectly.** The Network Time Protocol estimates offset
by measuring round trips to a reference:

```text
  client                              server
    │  t1: send ─────────────────────▶ │ t2: receive
    │                                  │
    │  t4: receive ◀───────────────── │ t3: send

  round trip delay = (t4 - t1) - (t3 - t2)
  offset           = ((t2 - t1) + (t3 - t4)) / 2
```

The offset calculation assumes the network delay is **symmetric** — that the
outbound and return legs took equally long. When they do not, the error is half
the asymmetry, and asymmetry is routine under congestion, with asymmetric routes,
and across virtualised networks.

Realistic accuracy:

| Environment | Typical clock error |
| --- | --- |
| Same LAN, good NTP | 0.1–1 ms |
| Public NTP over the internet | 1–50 ms |
| Virtualised / cloud VM under load | 10–100 ms, occasionally worse |
| Untuned or failing NTP | seconds to minutes |
| PTP with hardware timestamping | sub-microsecond |
| AWS Time Sync / GPS-disciplined | tens of microseconds |

The number to hold: **assume tens of milliseconds of clock error between two
cloud machines, and do not be shocked by seconds.** Any logic whose correctness
depends on two machines' clocks agreeing more closely than that is broken; it
just has not failed yet.

## The ways the wall clock moves unexpectedly

**Slewing versus stepping.** NTP prefers to *slew* — speed the clock up or slow
it down slightly until it converges — because that keeps it monotonic. But if the
offset is large (over 128 ms by default), it *steps*: sets the clock directly,
which can jump backwards.

```text
  SLEW                              STEP
  ────                              ────
   │      ╱                          │      ╱
   │    ╱                            │    ╱  ┆
   │  ╱   ← runs slightly fast       │  ╱    ┆
   │╱       until corrected          │╱      ↓ jumps back
   └──────────────                   └──────────────
   monotonic preserved               time goes BACKWARD
```

A freshly booted VM, or one resumed from a snapshot, will typically step. So will
one whose NTP daemon has been unable to reach a server for a while.

**Leap seconds.** UTC is occasionally adjusted by one second to track the
Earth's rotation. Historically this meant a repeated or skipped second — 23:59:60
— which broke software that assumed minutes have 60 seconds. The 2012 leap
second caused a livelock in the Linux kernel's high-resolution timer code that
took down Reddit, Mozilla and others simultaneously.

The modern mitigation is **leap smearing**: spreading the extra second over
hours as a tiny slowdown, so no discontinuity ever appears. Google, AWS and
Cloudflare all do this. The catch worth knowing: **smearing implementations
differ**, so during a smear window a Google-synced machine and an AWS-synced
machine disagree by up to a second. If you run across clouds, that is a real
window of increased skew. (The international timekeeping bodies have agreed to
stop issuing leap seconds by 2035, which will eventually retire this whole
problem.)

**Virtualisation.** A VM's clock can pause when the host deschedules it. Live
migration moves a VM to a host with a different clock. Snapshot restore resumes
a machine whose clock is stale by however long the snapshot sat.

**Human error.** A misconfigured timezone, an NTP server pointing at itself, a
container inheriting UTC while the app assumes local. Common and mundane.

## What breaks when you trust wall clocks

**Last-write-wins by timestamp.** Two nodes accept concurrent writes; the one
with the higher timestamp wins.

```text
  node A (clock 10 ms fast)     node B (clock accurate)

  t=100.000 real                t=100.005 real
  writes x=1, stamps 100.010    writes x=2, stamps 100.005

  → A's write has the higher timestamp and wins
  → but B's write happened LATER in reality
  → B's write is silently discarded
```

No error is raised anywhere. Data is lost, and the only trace is that a value
someone wrote is not there. This is a real and frequently-hit failure in systems
that use timestamp-based LWW, and it is why Cassandra's documentation warns about
clock skew so prominently.

**Distributed locks with TTL expiry.** A lock is held until timestamp T. Node A's
clock runs fast, so it believes the lock expired and takes it — while node B, on
an accurate clock, still holds it. Two holders of a mutual exclusion lock, which
is the one thing a lock exists to prevent.

**Token and certificate expiry.** A JWT with a 5-minute lifetime, issued by a
server whose clock is 30 seconds ahead, is rejected as "not yet valid" by a
verifier whose clock is 30 seconds behind. This is why libraries include a
**clock skew allowance** (typically 30–300 seconds) — and why very short token
lifetimes get fragile.

**Ordering events in logs.** Merging logs from several services by timestamp
produces an order that can show an effect before its cause. Anyone who has read
a distributed trace assembled purely from wall-clock timestamps has seen a span
that appears to start before its parent.

## The defences

1. **Use monotonic clocks for every duration.** Timeouts, TTLs, rate limits,
   benchmarks, retry delays, circuit-breaker windows. No exceptions.
2. **Never order distributed events by wall clock.** Use logical clocks — the
   subject of the next two chapters — which is the actual answer.
3. **Allow explicit skew tolerance** where wall clocks must be compared, and make
   the tolerance a named constant with a comment, not a magic number.
4. **Monitor clock offset as a first-class metric**, and alert on it.
   `node_timex_offset_seconds` from the Prometheus node exporter is the usual
   source. An unmonitored NTP failure is invisible until it corrupts something.
5. **Store timestamps as UTC with an explicit offset**, never as naive local
   times. Local times are ambiguous during a DST fall-back — that hour happens
   twice.
6. **Where the ordering must be right and must be global**, pay for it: a
   sequencer, a consensus log, or a system with bounded-uncertainty clocks like
   Spanner's TrueTime (covered later in this topic).

## The one honest use of wall clocks

Wall clocks are correct for what they are for: **communicating a point in time to
a human or across a boundary**. Log timestamps, `created_at` columns, "your order
shipped at" — all fine, because approximate agreement to within tens of
milliseconds is far better than the human-relevant resolution.

The error is not using wall clocks. It is using them as an **ordering
mechanism** or a **duration measurement** — two jobs they cannot do.

## What to take away

1. There are two clocks: wall (meaningful across machines, can jump backwards)
   and monotonic (meaningless across machines, never goes backwards). Durations
   always use monotonic.
2. Assume tens of milliseconds of skew between two cloud machines, and seconds
   when NTP is unhealthy. NTP's offset estimate assumes symmetric network delay,
   which is often false.
3. NTP steps the clock backwards for large corrections; VMs step on boot,
   migration and snapshot restore.
4. Timestamp-based last-write-wins silently loses data under skew, and TTL-based
   distributed locks can be held by two nodes at once.
5. Monitor clock offset as a metric — an NTP failure is otherwise invisible until
   it corrupts something.
6. Wall clocks are for telling humans when something happened, not for ordering
   events or measuring elapsed time.

Next: what to use instead — happens-before, and clocks that count events rather
than seconds.
