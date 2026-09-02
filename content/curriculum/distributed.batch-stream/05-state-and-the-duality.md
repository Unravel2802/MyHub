---
title: State, fault tolerance and the duality
minutes: 20
summary: Making streaming state survive a crash, and why batch and streaming are the same thing.
---

A stateless stream job is easy to recover: restart it and resume from the last
committed offset. A stateful one holds aggregations, windows and join buffers
that took hours to build, and losing them means recomputing from the beginning of
retention. This chapter is how that state is kept, and the observation that
dissolves the batch/streaming distinction entirely.

## Where state lives

```text
  IN MEMORY                         LOCAL EMBEDDED STORE
                                    (RocksDB)

  + fastest access                  + state can exceed memory
  - bounded by heap                 + fast: local disk, no network
  - lost entirely on crash          - lost on crash unless replicated

  REMOTE STORE (Redis, DynamoDB)
  + survives the process
  - a network round trip PER EVENT — usually fatal for throughput
  - the store becomes a bottleneck and a failure domain
```

**Local state plus a durable changelog is the standard design**, and it is worth
understanding why rather than reaching for a remote store:

```text
  ┌─────────────────────────────────────────────┐
  │  operator                                   │
  │    local state (RocksDB) ── read/write ── fast, no network
  │           │                                 │
  │           └── every change appended to a    │
  │               COMPACTED changelog topic     │
  └─────────────────────────────────────────────┘

  on crash: a new instance replays the changelog into a fresh
            local store, then resumes
```

Reads and writes are local and fast; durability comes from an append to a log
that is already there. The changelog is compacted, so replaying it gives the
current value of every key without replaying all history. This is exactly the log
compaction from the messaging topic, doing the job it was designed for.

## Checkpointing and exactly-once

The mechanism that makes a stateful job recoverable, and it is more elegant than
it first appears.

```text
  the problem: take a CONSISTENT snapshot of a distributed pipeline
  while it keeps running — every operator's state must correspond
  to the same set of processed input
```

Flink's answer (Chandy–Lamport asynchronous barrier snapshotting):

```text
  source injects a BARRIER into the stream

  ──▶ e1 e2 [BARRIER n] e3 e4 ──▶

  when an operator receives the barrier on ALL its inputs:
    1. snapshot its own state
    2. forward the barrier downstream
    3. keep processing

  when the barrier reaches every sink, checkpoint n is COMPLETE:
  every operator's snapshot reflects exactly the events before
  the barrier.
```

Nothing stops. The pipeline keeps flowing while the snapshot is taken, and the
barrier's position defines consistency rather than a global pause.

```text
  on failure:
    1. restore every operator's state from checkpoint n
    2. rewind the source offsets to checkpoint n's positions
    3. resume — events after the barrier are reprocessed
```

That is **exactly-once state**, and the caveat from the delivery-semantics chapter
applies unchanged: events *are* reprocessed, so external side effects happen
twice unless the sink cooperates.

```text
  TRANSACTIONAL SINK    writes participate in the checkpoint;
                        committed only when the checkpoint completes
                        → Kafka transactions, or a 2PC sink

  IDEMPOTENT SINK       writing twice is harmless
                        → upsert by key. simpler, and usually better.
```

**Prefer the idempotent sink.** A transactional sink couples your checkpoint
interval to your output latency — results are invisible until the checkpoint
commits — and adds a distributed transaction to every checkpoint. An upsert keyed
by (window, key) achieves the same result with none of that.

## Checkpoint tuning

```text
  interval        frequent → less reprocessing on failure,
                             more overhead
                  rare     → cheaper, longer recovery
                  typical: 10 s to 5 min

  incremental     only changed state is uploaded (RocksDB)
                  → essential for large state

  alignment       unaligned checkpoints skip barrier alignment
                  → much better under backpressure, at the cost
                    of larger checkpoints
```

The failure mode to watch: **checkpoints taking longer than the interval.** They
begin to overlap, back up, and eventually the job stalls. Alert on checkpoint
duration relative to interval — it is the streaming equivalent of leader-change
rate, a leading indicator rather than a symptom.

## Bounding state

Streaming state grows forever unless something removes it. Every stateful
operator needs an answer:

```text
  □  WINDOWS        cleaned up after allowed lateness expires.
                    unbounded allowed lateness = unbounded state.
  □  JOIN BUFFERS   bounded by the join window.
  □  DEDUP KEYS     need a TTL, sized like an idempotency window.
  □  SESSION STATE  a user who never returns holds state forever —
                    needs a maximum session duration.
  □  KEY SPACE      an unbounded key space (e.g. keyed by request id)
                    grows without limit even with per-key TTLs.
```

The last one is the subtle one and it is a common design error: keying state by
something with unbounded cardinality means the state size tracks total traffic
rather than active entities, and no per-key expiry helps until it fires.

## The batch/stream duality

Here is the observation that unifies the whole topic:

```text
  a TABLE is the accumulated result of a STREAM of changes
  a STREAM is the sequence of changes between successive TABLE states

           ─────────── aggregate over time ───────────▶
  STREAM                                                TABLE
           ◀────────── observe the changes ─────────────
```

A database table is a stream of inserts and updates, folded. A changelog is a
table, unfolded. Neither is more fundamental — they are two views of the same
information, and the operation converting each into the other is standard.

This is why:

- **Log compaction turns a stream into a table.** It is the fold, materialised.
- **CDC turns a table into a stream.** It is the unfold.
- **A stream-table join** is joining a stream against a folded stream.
- **Batch is streaming over a bounded input.** Flink and Spark both run batch
  jobs on their streaming engine, because a bounded stream is just a stream that
  ends.

Once you see it, "should this be a batch job or a streaming job?" becomes a
question about latency requirements and input boundedness, not about two
different paradigms.

## Lambda and Kappa

The two architectures that followed from this, and how the argument resolved.

```text
  LAMBDA                            KAPPA

  ┌─── batch layer ────┐            ┌── stream layer only ──┐
  │  slow, accurate,   │            │  reprocess by         │
  │  reprocesses all   │──┐         │  REPLAYING the log    │
  └────────────────────┘  ├─ serve  │  with a new version   │
  ┌─── speed layer ────┐  │         └───────────────────────┘
  │  fast, approximate │──┘
  └────────────────────┘
   TWO implementations of the       ONE implementation
   same logic, kept in sync
```

Lambda's fatal flaw was maintaining the same business logic twice, in two
frameworks, and keeping them consistent forever. Every change is made twice, and
the two drift.

Kappa replaces the batch layer with **replay**: to reprocess, start a new job
from offset 0 with the new code, let it catch up, and switch the serving layer to
its output.

```text
  reprocessing in Kappa

  1. deploy v2 of the job, reading from offset 0, writing to a
     NEW output table
  2. let it catch up to the live position
  3. switch readers to the new table
  4. delete the old one
```

This requires retention long enough to replay, which is a storage cost — and
storage is cheap compared with maintaining two implementations. **Kappa won**, and
modern practice is a single engine handling both bounded and unbounded input,
with reprocessing done by replay.

The one place a separate batch path survives legitimately: correcting data older
than your retention, or joining against datasets that were never in the stream.

## What to take away

1. Local state plus a compacted changelog is the standard design — local reads
   and writes for speed, log append for durability.
2. Barrier-based checkpointing snapshots a running pipeline consistently without
   stopping it; the barrier's position defines consistency.
3. Exactly-once state does not mean exactly-once side effects; prefer an
   idempotent upsert sink over a transactional one.
4. Alert on checkpoint duration relative to interval — overlapping checkpoints
   stall the job.
5. Every stateful operator needs a bound, and keying by an unbounded-cardinality
   value defeats per-key TTLs.
6. Streams and tables are two views of the same information; batch is streaming
   over bounded input, and Kappa's replay-based reprocessing removed the need to
   implement the logic twice.

That completes batch and stream processing. Next in the track: **membership and
failure detection** — how a cluster agrees on which nodes exist and which are
alive.
