---
title: Windows and watermarks
minutes: 20
summary: Slicing an endless stream into finite pieces, and deciding when to stop waiting.
---

You cannot aggregate an infinite stream — there is no "end" at which to emit a
total. Windows carve it into finite pieces, and watermarks answer the question
that makes windows possible: **when have I probably seen everything for this
window?**

## Window types

```text
  TUMBLING — fixed size, non-overlapping
  ├─────┤├─────┤├─────┤├─────┤
   0-5    5-10   10-15  15-20
  each event in exactly ONE window
  "revenue per hour"

  SLIDING — fixed size, overlapping by a slide interval
  ├───────────┤
        ├───────────┤
              ├───────────┤
  each event in SEVERAL windows  (size/slide of them)
  "moving average over 10 minutes, updated every minute"

  SESSION — dynamic, defined by a gap of inactivity
  ├──────┤        ├───┤              ├─────────┤
   activity  gap   act.   long gap    activity
  boundaries depend on the DATA, not the clock
  "one user's browsing session"

  GLOBAL — one window, forever
  emitted on a custom trigger
  "running total since the beginning of time"
```

**Sliding windows multiply state.** A 24-hour window sliding every minute means
1,440 open windows, and every event belongs to all of them. This is a common
cause of unexpected memory usage, and the mitigation is either a coarser slide or
an incremental aggregation that does not retain the events themselves.

**Session windows are the operationally awkward one**, because a window's end
cannot be known until the gap has elapsed, and two sessions merge when a late
event bridges them. Every engine supports them; few support them cheaply.

## Watermarks

A watermark is an assertion flowing through the pipeline:

> "I believe I have seen all events with event time ≤ T."

```text
  events arriving (by event time):
    10:00  10:02  10:01  10:04  10:03  10:07  10:05
                    ▲             ▲
                out of order   out of order

  watermark = max event time seen − allowed lateness

  with allowed lateness of 3 minutes:
    after seeing 10:07, watermark = 10:04
    → the 10:00–10:04 window can now be CLOSED and emitted
```

The trade is stark and unavoidable:

```text
  AGGRESSIVE watermark (small lateness)
    + low latency: results emitted quickly
    - more late data, dropped or requiring correction

  CONSERVATIVE watermark (large lateness)
    + more complete results
    - higher latency: you wait before emitting anything
    - more state held open
```

**There is no correct value.** There is a measurement: look at the actual
distribution of event lateness in your data and choose a percentile.

```text
  observed lateness distribution
    p50:   0.2 s
    p95:   4 s
    p99:  45 s
    p99.9: 25 min      ← the mobile clients in tunnels
    max:    6 days     ← a device whose clock was wrong

  choosing p99 (45 s) drops ~1% of events from their correct window
  choosing p99.9 (25 min) means every result is 25 minutes late
```

Most systems pick around p95–p99 and handle the remainder as late data rather
than waiting for it.

**Watermarks are per-partition, and the pipeline's watermark is the minimum
across them.** That produces a specific and confusing failure: an idle partition
never advances its watermark, so the whole pipeline stalls and no window ever
closes. Every engine has an idle-source timeout for this; if your windows stop
emitting after a quiet period, this is the first thing to check.

## Handling late data

An event arrives after its window's watermark has passed. Four options:

```text
  1. DROP        simplest; you lose data. count it, at minimum.

  2. ALLOWED LATENESS   keep the window open a bit longer past the
                        watermark and update the result
                        → a second, corrected emission

  3. SIDE OUTPUT        route late events to a separate stream for
                        separate handling — batch correction,
                        or a dead-letter for investigation

  4. REPROCESS          let the batch layer produce the correct
                        answer later (see the next chapter)
```

**Always count dropped events**, whichever you choose. A pipeline silently
discarding 3% of events is producing wrong numbers that look right, and nothing
else will reveal it.

## Triggers

Windows say *what* to aggregate; triggers say *when* to emit. Separating them is
the key insight of the Beam/Dataflow model.

```text
  WATERMARK TRIGGER    emit once, when the window is believed complete
                       → one correct result, higher latency

  EARLY TRIGGERS       emit speculative results before completion
                       → "count so far", updated every minute

  LATE TRIGGERS        re-emit when late data arrives
                       → corrected results

  combined:
    every 1 min while the window is open   (early, speculative)
    at the watermark                       (the main result)
    on each late event                     (correction)
```

This gives you low latency *and* eventual correctness, at the cost of downstream
consumers receiving multiple results for the same window. Which means they must
handle refinements:

```text
  ACCUMULATING    each emission REPLACES the previous
                  window 10:00–10:05 = 100, then 105, then 107
                  → the sink must UPSERT by window key

  DISCARDING      each emission is a DELTA
                  window 10:00–10:05 = 100, then +5, then +2
                  → the sink must SUM
```

Getting this wrong is a classic double-counting bug: an accumulating stream
written to an appending sink produces 100 + 105 + 107 = 312.

## Windowing in practice

```text
  □  Prefer TUMBLING windows unless you specifically need overlap —
     they are cheapest and easiest to reason about.
  □  Set allowed lateness from MEASURED lateness, not a guess.
  □  Always emit a metric for dropped-late events.
  □  Watch for idle partitions stalling the watermark.
  □  Decide accumulating vs discarding explicitly and make the sink
     match.
  □  Bound session-window state — an unbounded gap keeps state alive
     for a user who never returns.
```

## A worked example

```text
  requirement: revenue per 5-minute window, updated as it comes in,
               correct within an hour

  window        tumbling, 5 minutes, EVENT time
  watermark     max event time − 30 s   (from measured p99)
  early trigger every 10 s while the window is open
  allowed
  lateness      1 hour   → late events update the result
  side output   events later than 1 hour → a topic for batch repair
  accumulation  ACCUMULATING; the sink upserts by window key
  metrics       dropped_late_events, watermark_lag, window_state_size
```

That configuration serves a dashboard within seconds, converges to a correct
figure within 30 seconds, corrects for an hour, and repairs the rest offline —
which is the shape most "real-time analytics" requirements actually have.

## What to take away

1. Tumbling windows are the default; sliding windows multiply state by
   size/slide; session windows are data-defined and operationally awkward.
2. A watermark asserts "I have seen everything up to T", and the completeness
   versus latency trade has no correct answer — only a measured percentile.
3. Watermarks are the minimum across partitions, so an idle partition stalls the
   whole pipeline; that is the first thing to check when windows stop emitting.
4. Always count dropped late events, or you will produce wrong numbers that look
   right.
5. Triggers separate *when to emit* from *what to aggregate*, giving speculative
   early results plus corrections.
6. Decide accumulating versus discarding explicitly and make the sink match, or
   you double-count.

Next: state, fault tolerance, and the relationship between batch and streaming.
