---
title: Stream processing
minutes: 19
summary: Event time vs processing time — the distinction that makes "what happened, when" a genuinely hard question for data that arrives late or out of order.
---

Batch processing asks "compute this over all the data that exists right
now." Stream processing asks the harder question: "compute this
continuously, as data arrives, possibly late, possibly out of order, with
no defined 'all the data' to wait for." That shift is where nearly every
genuine difficulty in this chapter comes from.

## Event time vs processing time: the distinction everything else depends on

```text
  EVENT TIME        when something ACTUALLY happened (a
                    purchase made at 10:00:00, timestamped by
                    the device/service that recorded it)

  PROCESSING TIME     when the stream processor actually
                    RECEIVES and handles that event (10:00:47,
                    say — arriving late due to a network delay,
                    a mobile device that was briefly offline,
                    an upstream queue's own processing lag)
```

```text
  → these are NOT the same, and the GAP between them is neither
    fixed nor predictable — a mobile app that was offline for
    twenty minutes sends a burst of "old" events, stamped with
    their TRUE event time, arriving all at once, much LATER in
    processing time. a stream processor that naively groups by
    PROCESSING time (when it happened to arrive) attributes
    those events to the WRONG time bucket entirely — "what
    happened between 10:00 and 10:05" needs to be answered using
    EVENT time, not whenever the data for that window happened
    to physically arrive.
```

## Windows: grouping an unbounded stream into finite chunks

```text
  TUMBLING WINDOW    fixed, NON-OVERLAPPING chunks — [0-5min),
                    [5-10min), [10-15min) — each event belongs
                    to EXACTLY one window

  SLIDING WINDOW       fixed size, but OVERLAPPING, advancing by
                    a smaller step than the window's own size
                    — a 5-minute window sliding every 1 minute
                    — each event can belong to MULTIPLE windows
                    simultaneously

  SESSION WINDOW         boundaries defined by a GAP in activity
                    (close the window after 30 minutes with NO
                    new events for this specific user/key) —
                    genuinely variable LENGTH, unlike the other
                    two's fixed sizing
```

```text
  → an unbounded stream has no natural "end" to aggregate over
    — windows are what turn "sum this forever" (meaningless,
    since it never actually finishes) into a well-defined,
    FINITE computation: "sum this specific 5-minute chunk,"
    repeated, continuously, as new chunks close.
```

## Watermarks: deciding when a window is "done enough" to emit a result

```text
  the genuinely hard problem event time creates: a window for
  [10:00-10:05) needs to eventually EMIT a result — but late-
  arriving data (event time 10:03, arriving in processing time
  at 10:47, from that offline mobile device) COULD still show
  up for that window, arbitrarily far into the future.

  → a WATERMARK is an explicit, deliberate POLICY: "assume no
    event with event-time earlier than X will arrive from this
    point forward" — this lets the processor emit a result for
    [10:00-10:05) once the watermark passes 10:05, accepting a
    REAL, EXPLICIT trade-off: SOME genuinely late data (arriving
    after the watermark already passed) will be EXCLUDED from
    that window's result, in exchange for the window actually
    being able to close and emit SOMETHING, ever, rather than
    waiting indefinitely for data that might never arrive at
    all.
```

```text
  → choosing the watermark's LATENESS tolerance is a genuine,
    deliberate trade-off between RESULT LATENCY (a tighter
    watermark emits results sooner) and RESULT COMPLETENESS
    (a looser watermark waits longer, catching more genuinely
    late data before finalizing) — there is no watermark
    setting that's simultaneously instant AND perfectly
    complete; the two pull directly against each other.
```

## State stores: remembering across events in an unbounded stream

```text
  → some stream computations genuinely need STATE that persists
    ACROSS events (a running count, a session's accumulated
    total, a join between two DIFFERENT streams that need to
    correlate events arriving at different times) — a STATE
    STORE is local, durable storage the stream processor
    maintains PER KEY, checkpointed periodically so a machine
    failure doesn't lose accumulated state that's been building
    for hours.

  → this is a genuinely different shape from batch processing's
    STATELESS transformations, which simply recompute FRESH
    from all the input data every single run — a stream
    processor's state, by contrast, must SURVIVE across
    individual events and across the processor's own restarts,
    which is real, durable, checkpointed state management, not
    a value that just lives in memory during one job's run.
```

## Exactly-once sinks: the output-side version of a familiar problem

```text
  → the Queues and Async Jobs chapter's at-least-once delivery
    limit applies to stream INPUT the same way it applies to
    any message queue — but the OUTPUT side has its own,
    related challenge: a stream processor that CRASHES and
    RESTARTS might REPROCESS some already-processed events
    (replaying from its last checkpoint), and a naive SINK
    (writing results to a downstream database) would then
    WRITE those results a second time.
```

```text
  → "exactly-once" sinks achieve the OUTCOME (not the delivery
    mechanism, which remains fundamentally at-least-once, the
    same limit that applies everywhere else) via either
    IDEMPOTENT writes (an upsert keyed on event id — the SAME
    pattern that's recurred constantly throughout this entire
    curriculum, from a payment handler to a CDC consumer) or
    TRANSACTIONAL writes that atomically commit BOTH the
    "processed up to here" checkpoint AND the actual output
    TOGETHER, so a crash between the two is structurally
    impossible rather than merely unlikely.
```

## What to take away

1. Event time (when something happened) and processing time (when it was
   received) are genuinely different, with an unpredictable gap — grouping
   by processing time attributes late-arriving events to the wrong time
   bucket entirely.
2. Tumbling, sliding, and session windows are three different ways to turn
   an unbounded stream into finite, computable chunks — differing in
   overlap and in whether boundaries are fixed or activity-defined.
3. A watermark is an explicit policy trading result latency against result
   completeness — there's no setting that's simultaneously instant and
   guaranteed to catch every late event.
4. A stream processor's state must survive across individual events and
   across its own restarts via durable, checkpointed storage — a genuinely
   different shape from batch processing's stateless, recompute-fresh-every-
   run transformations.
5. Exactly-once sinks achieve the outcome, not the delivery mechanism (which
   stays fundamentally at-least-once) — via the same idempotent-upsert
   pattern that recurs throughout this curriculum, or via a transactional
   write that commits the checkpoint and the output atomically together.
