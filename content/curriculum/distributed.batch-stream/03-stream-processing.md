---
title: Stream processing
minutes: 20
summary: Computing over data that never ends, and the two different times every event has.
---

Batch processing has a comfortable property: the dataset is complete. You can
sort it, count it, and know when you are done. Stream processing gives that up —
the data never ends, results must be emitted before all the input has arrived,
and events show up late and out of order. Almost every difficulty follows from
those three facts.

## What changes when the data is unbounded

```text
  BATCH                             STREAM

  input is complete                 input never ends
  you know when you're done         "done" is not defined
  can sort the whole dataset        cannot — it doesn't fit and
                                    doesn't end
  results computed once             results updated continuously
  a failure re-runs the job         a failure resumes from state
  latency: minutes to hours         latency: milliseconds to seconds
```

The two that cause the real difficulty:

**You must emit results before seeing all the input.** "Count events per hour"
has no complete answer until the hour is over — and even then, an event from that
hour might arrive tomorrow.

**State must be maintained and made durable.** A batch job holds intermediate
state in memory for its duration and discards it. A streaming job's state lives
forever, must survive restarts, and grows unless bounded.

## Event time versus processing time

The distinction that everything else in this topic rests on.

```text
  EVENT TIME       when the event actually HAPPENED
                   (a timestamp in the event itself)

  INGESTION TIME   when it arrived at the system

  PROCESSING TIME  when the operator got to it
```

```text
  a phone loses signal in a tunnel at 14:03, buffering user actions.
  it reconnects at 14:31 and uploads.

  event time:      14:03    ← what the user did, and when
  processing time: 14:31    ← 28 minutes later

  "how many purchases happened at 14:00–14:05?"
     answered by EVENT time. processing time gives the wrong answer.
```

```text
  PROCESSING TIME                   EVENT TIME
  ───────────────                   ──────────
  + simple; no watermarks           + correct results
  + results are always "complete"   + reprocessing gives the SAME answer
  + lowest latency                  - needs watermarks and late-data
  - results depend on when you        handling
    happened to run it              - higher latency (you must wait)
  - reprocessing gives a DIFFERENT
    answer
```

The reproducibility point decides it for most analytics: **a processing-time
result cannot be reproduced.** Re-run the job tomorrow and events land in
different windows, so the numbers change. Event time gives the same answer every
time, which is a requirement for anything anyone reports on.

Use processing time only when the question genuinely is about the system's own
behaviour — throughput monitoring, rate limiting, "how much are we ingesting
right now".

## The skew between them

```text
  processing
     time
       │                                  ╱ ideal (no lag)
       │                              ╱
       │                          ╱ ┄┄┄ actual
       │                      ╱  ┄
       │                  ╱ ┄
       │              ╱┄
       │          ╱┄        the vertical gap is the SKEW:
       │      ╱┄            how far behind real time the system is
       └────────────────────────────────▶ event time
```

The skew is unbounded in principle — an event can arrive arbitrarily late — and
bounded in practice by whatever you decide to wait for. That decision is the
watermark, which is the next chapter.

## The operators

```text
  STATELESS                         STATEFUL

  map, filter, flatMap              aggregations (count, sum, avg)
  → each event independently        windows
  → trivially parallel              joins
  → no recovery concerns            deduplication
                                    pattern detection
                                    → needs durable, recoverable state
```

The stateless/stateful split is the one that determines operational difficulty. A
stateless pipeline is close to trivial: partition it, restart on failure, done. A
stateful one needs everything in the fault-tolerance chapter.

## Streaming joins, which are genuinely hard

Joining two unbounded streams raises a question batch never has: **how long do
you keep a record waiting for its partner?**

```text
  stream A: order placed        (14:03)
  stream B: payment received    (14:07)

  when A arrives, B does not exist yet.
  A must be BUFFERED. for how long?

  forever  ──▶ unbounded state growth
  10 min   ──▶ a payment at 14:20 finds nothing to join to
```

The three shapes, in increasing order of practicality:

```text
  STREAM-STREAM       both sides buffered within a time window
                      → bounded state, and joins outside the
                        window silently produce nothing

  STREAM-TABLE        one side is a materialised, compacted view
                      → the common and comfortable case:
                        enrich an event stream with reference data

  TEMPORAL JOIN       join against the table's value AS OF the
                      event's time
                      → the correct one for reprocessing: an order
                        from March joins March's price, not today's
```

**Stream-table is what most real pipelines want**, and it is exactly what log
compaction (from the messaging topic) provides: a compacted topic replayed into
local state gives you the current value of every key, locally, with no remote
lookup per event.

The temporal join is the subtle one and worth knowing exists. Joining an old
event against the *current* dimension table gives a different answer on every
re-run — the same reproducibility failure as processing time, one level up.

## Backpressure

Covered in the RPC topic, and it returns here because a streaming pipeline is a
chain of stages with different speeds:

```text
  source ──▶ parse ──▶ enrich ──▶ aggregate ──▶ sink
   fast      fast       SLOW        fast        fast
                      (remote
                       lookup)
```

Without backpressure, everything upstream of `enrich` buffers until memory is
gone. With it, the whole pipeline runs at `enrich`'s rate and nothing accumulates.
Flink propagates it natively; Kafka Streams gets it from the consumer's own poll
loop.

The signal to watch: **the slowest operator's utilisation, not the pipeline's
throughput.** A pipeline whose throughput looks fine while one operator is at
100% is one traffic increase away from unbounded lag.

## Choosing an engine

```text
  Kafka Streams   a LIBRARY, not a cluster. runs inside your app.
                  + no separate infrastructure to operate
                  + scales by running more instances
                  - Kafka-only, JVM-only

  Flink           a cluster with real event-time support, strong
                  state management, exactly-once sinks
                  + the most capable; the reference implementation
                    of the dataflow model
                  - a cluster to operate

  Spark Structured Streaming
                  micro-batches over the Spark engine
                  + one engine for batch and streaming
                  - higher latency floor (batch interval)

  Cloud-native    Dataflow, Kinesis Analytics
                  + managed
                  - lock-in, less control
```

**Start with Kafka Streams if you are already on Kafka and the logic is simple**
— it removes a whole cluster from your operational surface. Move to Flink when
you need proper event-time semantics, large state, or complex windowing.

And the honest first question: **do you need streaming at all?** A batch job
running every five minutes is dramatically simpler to build, test, reason about
and recover, and it satisfies a large fraction of "real-time" requirements. Reach
for streaming when the latency requirement is genuinely seconds, or when the
state is genuinely continuous.

## What to take away

1. Unbounded input means emitting results before seeing all the data, and state
   that lives forever rather than for one job.
2. Event time is when it happened; processing time is when you saw it. Only event
   time gives reproducible results.
3. The skew between them is unbounded in principle and bounded in practice by how
   long you choose to wait.
4. The stateless/stateful split determines operational difficulty far more than
   the engine choice.
5. Stream-table joins over a compacted topic are what most pipelines actually
   want; temporal joins are what reprocessing correctness needs.
6. Ask whether a five-minute batch job would do — it is dramatically simpler and
   satisfies many "real-time" requirements.

Next: windowing and watermarks — deciding when a result is complete enough to
emit.
