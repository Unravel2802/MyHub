---
title: Hybrid clocks and TrueTime
minutes: 20
summary: Getting causality and human-meaningful timestamps at once, and buying certainty by waiting.
---

Physical clocks are meaningful to humans and to other machines but cannot order
events. Logical clocks order events but mean nothing to a human and cannot be
compared with a wall time. Real systems need both — a timestamp you can put in a
`created_at` column *and* rely on for causal ordering. Two designs achieve this,
by opposite strategies.

## Hybrid Logical Clocks

An HLC timestamp is a pair: a physical component that tracks wall time, and a
logical counter that breaks ties and preserves causality when the physical part
cannot.

```text
  HLC = (l, c)
         │  └─ logical counter, incremented only when needed
         └──── physical part, tracks wall clock but never goes backward
```

The update rules:

```python
def hlc_send(state, wall_now):
    l_prev, c_prev = state
    l = max(l_prev, wall_now)
    c = c_prev + 1 if l == l_prev else 0     # tie → bump counter, else reset
    return (l, c)

def hlc_receive(state, msg, wall_now):
    l_prev, c_prev = state
    l_msg,  c_msg  = msg
    l = max(l_prev, l_msg, wall_now)         # never go backward
    if l == l_prev == l_msg:  c = max(c_prev, c_msg) + 1
    elif l == l_prev:         c = c_prev + 1
    elif l == l_msg:          c = c_msg + 1
    else:                     c = 0          # wall clock advanced past both
    return (l, c)
```

Traced:

```text
  node A, wall = 100      node B, wall = 100 (slightly behind, says 99)

  A: event      → (100, 0)
  A: event      → (100, 1)      same millisecond, counter bumps
  A: send (100,1) ───────────▶  B receives; B's wall says 99
                                l = max(99_prev, 100, 99) = 100
                                l == l_msg → c = 1 + 1 = 2
                                B: (100, 2)

  causality preserved: (100,1) < (100,2), even though B's clock was BEHIND
```

The properties that make this the pragmatic answer:

| Property | Held? |
| --- | --- |
| `a → b` implies `HLC(a) < HLC(b)` | ✅ |
| Timestamp is close to real wall time | ✅ within clock skew |
| Constant size (two integers) | ✅ |
| Detects concurrency | ❌ (like Lamport, not vector) |
| Requires special hardware | ❌ |

The logical counter absorbs skew. If a node's physical clock is behind, the
counter grows to keep ordering correct, and it resets to zero as soon as the
wall clock catches up. The counter stays small in practice — it only grows
during the window where clocks disagree.

**The failure mode** is a badly wrong clock in the *forward* direction. Because
`l = max(...)`, a node whose clock jumps an hour ahead drags every node it talks
to an hour ahead, and they cannot come back until real time catches up. This is
why HLC implementations reject messages whose timestamp is too far in the future
— CockroachDB's `max-offset` setting, typically 500 ms, and a node that detects
it has drifted past that threshold **shuts itself down** rather than corrupt the
ordering. That is the correct behaviour and worth noting: the system's safety
depends on clocks being within a bound, and it enforces the bound by crashing.

HLCs are used by CockroachDB, YugabyteDB, MongoDB (as its cluster time) and
several others. For most systems that need causally-consistent, human-readable
timestamps, this is the answer.

## TrueTime: buying certainty by waiting

Google's Spanner takes the opposite approach. Rather than working around clock
uncertainty, it **measures** it and then **waits it out**.

TrueTime's API does not return a timestamp. It returns an *interval*:

```text
  TT.now() → [earliest, latest]

  guarantee: the true absolute time is somewhere in that interval

  ε = (latest - earliest) / 2      ← the uncertainty, typically 1–7 ms
```

This is made possible by infrastructure: GPS receivers and atomic clocks in
every data centre, with a time master per rack, and armaggedon masters that
cross-check. The uncertainty is small *and known*, which is the part that
matters — an ordinary NTP setup has unknown uncertainty, and unknown is what you
cannot design against.

**Commit wait** is what turns the interval into a guarantee:

```text
  transaction wants to commit at time s = TT.now().latest

  ┌──────────────────────────────────────────────────────┐
  │  s = TT.now().latest                                 │
  │  ... do the commit work ...                          │
  │  WAIT until TT.now().earliest > s                    │
  │  ── only now, release locks and acknowledge ─────────│
  └──────────────────────────────────────────────────────┘

  by waiting out the uncertainty, the transaction guarantees that
  every clock everywhere now reads later than s.
```

The consequence is remarkable: any transaction that *starts* after this one
commits is guaranteed a larger timestamp, on any machine, with no communication
between them. Spanner gets **external consistency** (linearizability) globally,
and timestamps that are directly comparable across continents.

The price is explicit and it is latency: every write waits ~2ε, so commit
latency has a floor of roughly 2–14 ms *added* to everything else. Google's
engineering response was to attack ε directly, because ε is now a number on a
dashboard rather than an unknown — which is itself the lesson.

```text
  HLC                              TrueTime
  ───                              ────────
  works on any hardware            needs GPS + atomic clocks
  no added latency                 commit wait of ~2ε on every write
  causal consistency               EXTERNAL consistency (linearizable)
  unknown clock error, bounded     KNOWN, measured clock error
    by a config threshold
  crashes if skew exceeds bound    waits out the measured uncertainty
```

Cloud providers have since made tight, *measured* time available without a
private GPS network — AWS Time Sync with clock-bound APIs offers microsecond
accuracy with a published error bound, which lets non-Google systems consider
this design. It is a genuine shift: the uncertainty being *knowable* is the
enabling property, more than it being small.

## Where each belongs

```text
  Do you need a timestamp a human reads AND causal ordering?
   │
   ├─ and you run on ordinary cloud hardware
   │     ──▶ HYBRID LOGICAL CLOCK
   │         (CockroachDB, Yugabyte, MongoDB cluster time)
   │
   ├─ and you need EXTERNAL consistency globally, and can pay
   │  commit-wait latency and time infrastructure
   │     ──▶ TRUETIME-style bounded uncertainty
   │         (Spanner, and now buildable on cloud clock-bound APIs)
   │
   └─ and you only need ordering within one partition
         ──▶ a plain sequence number. do not over-engineer this.
```

The last branch is worth its own emphasis. **Most ordering problems are
single-partition problems**, and a monotonically increasing sequence assigned by
a single leader — a Kafka offset, a WAL LSN, an auto-increment column — is
simpler, cheaper and completely correct there. Reach for HLC when ordering must
hold *across* partitions or nodes without a single sequencer.

## The practical checklist

Whatever you choose, these apply:

```text
  □  Monitor clock offset, and alert well before your skew bound.
  □  Decide what happens when the bound is exceeded — crash, refuse
     writes, or degrade — and make it explicit. Silently continuing
     means silently corrupting order.
  □  Use monotonic clocks for every duration, regardless.
  □  Store the logical component alongside the physical one if you
     persist timestamps you will later compare.
  □  Do not compare timestamps from systems using different schemes.
     An HLC value and a wall-clock value are not the same kind of thing.
```

## What to take away

1. HLC pairs a physical component with a logical counter, giving causal ordering
   and near-wall-clock timestamps in two integers on ordinary hardware.
2. HLC's counter absorbs skew and resets when the wall clock catches up; its
   danger is a clock that jumps *forward*, which is why implementations enforce a
   maximum offset and crash rather than exceed it.
3. TrueTime returns an interval rather than an instant, making the uncertainty
   *known* — and commit wait pays that uncertainty in latency to buy global
   external consistency.
4. The enabling property of TrueTime is that ε is measured, not that it is small;
   cloud clock-bound APIs now make similar designs possible outside Google.
5. Most ordering problems are single-partition and need only a sequence number —
   reach for these mechanisms when ordering must hold across nodes without a
   single sequencer.

Next: what all of this means for real system behaviour — the consistency
guarantees you can actually offer, and what each one costs.
