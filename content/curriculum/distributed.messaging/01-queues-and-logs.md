---
title: Queues and logs
minutes: 19
summary: Two fundamentally different models that both get called "message brokers".
---

"We'll put a queue in front of it" covers two designs that behave differently in
almost every respect. One deletes a message once someone handles it; the other
keeps an ordered, replayable record that many independent consumers read at their
own pace. Choosing the wrong one is a design mistake that surfaces months later
as "we need to reprocess everything and we can't".

## The two models

```text
  QUEUE (RabbitMQ, SQS, ActiveMQ)      LOG (Kafka, Pulsar, Kinesis)

  producer ──▶ [m1 m2 m3] ──▶ consumer  producer ──▶ [m1 m2 m3 m4 m5 ...]
                    │                                 ▲     ▲       ▲
              message REMOVED                         │     │       │
              when acknowledged                    group A  B    group C
                                                   offset 2  4    offset 1

  a message goes to ONE consumer        every consumer reads EVERYTHING
  and is then gone                      at its own position; nothing is
                                        removed on read
```

The defining difference is **who owns the position**. In a queue, the broker
tracks what has been delivered and deletes it. In a log, the *consumer* tracks
its own offset, and the data stays until a retention policy removes it.

That single difference produces everything below.

## The comparison

| | Queue | Log |
| --- | --- | --- |
| Message after consumption | deleted | retained |
| Consumers per message | one (per queue) | any number, independently |
| Replay | impossible | rewind the offset |
| Ordering | best-effort, broken by redelivery | strict per partition |
| Adding a new consumer | sees only new messages | can read from the beginning |
| Per-message ack | yes | no — offsets only |
| Selective retry | yes, requeue one message | no — you cannot skip and come back |
| Scaling consumers | add workers freely | bounded by partition count |
| Natural fit | task distribution | event distribution |

Two rows deserve expansion because they are the ones that decide real designs.

**Selective retry.** A queue lets you nack a single message and have it
redelivered while everything else proceeds. A log cannot: offsets advance
monotonically, so a message you cannot process either blocks the partition or is
skipped and lost. Handling failures in a log-based consumer therefore requires
sending the failure somewhere else (a retry topic or a dead-letter topic) and
advancing the offset anyway — which is more machinery than a queue's nack.

**Consumer scaling.** In a queue, ten workers on one queue simply take a third
each. In a log, parallelism is bounded by partitions: eleven consumers on ten
partitions means one consumer sits idle forever. Partition count is a capacity
decision made at topic creation, which is a different planning discipline.

## The insight behind the log

A log is the simplest possible storage abstraction: an append-only, ordered,
immutable sequence.

```text
  offset:  0    1    2    3    4    5    6
         ┌────┬────┬────┬────┬────┬────┬────┐
         │ m0 │ m1 │ m2 │ m3 │ m4 │ m5 │ m6 │──▶ appends here
         └────┴────┴────┴────┴────┴────┴────┘
                       ▲              ▲
                  consumer A      consumer B
                  offset 3        offset 6
```

Appending is sequential I/O — the fastest thing a disk does, including an SSD.
Reading is sequential too, and the operating system's page cache serves recent
data without touching the disk at all. This is why a log-based broker sustains
throughput that surprises people: it is not doing anything clever, it is doing
the one thing storage is best at.

And the model recurs everywhere once you notice it: a database's write-ahead log,
a replication stream, git's commit history, an event-sourced aggregate. **"The
log is the source of truth, everything else is a derived view"** is one of the
more powerful architectural ideas available, and Kafka's contribution was making
that log a piece of shared infrastructure rather than an internal detail of one
database.

```text
                 ┌──────────────────────────────────┐
  writes ──────▶ │  THE LOG (ordered, durable)      │
                 └───────────────┬──────────────────┘
                                 │  everything downstream is
                                 │  a projection of it
          ┌──────────────┬───────┴───────┬──────────────┐
          ▼              ▼               ▼              ▼
      database      search index      cache        warehouse

  rebuild ANY of them by replaying from offset 0
```

That last line is the property worth paying for. A derived store that is corrupt,
schema-changed, or newly added can be rebuilt from the log. With a queue, the
messages are gone and there is nothing to rebuild from.

## Choosing

```text
  Do multiple independent consumers need the same message?
    └─ YES ──▶ LOG

  Might you need to REPLAY history — rebuild a projection,
  backfill a new service, recover from a bad deploy?
    └─ YES ──▶ LOG

  Do you need strict ordering per entity?
    └─ YES ──▶ LOG (partition by that entity)

  Do you need per-message retry, priorities, or delayed delivery?
    └─ YES ──▶ QUEUE

  Is this task distribution to interchangeable workers,
  with wildly varying task durations?
    └─ YES ──▶ QUEUE

  Otherwise, and especially if unsure ──▶ LOG
```

The "if unsure" default toward a log is deliberate: a log can emulate a queue
badly, but a queue cannot emulate a log at all, because the data is gone. Choosing
a log preserves the option to add a consumer later, and that option is worth more
than most teams expect at design time.

The counterargument, honestly stated: a log is heavier operationally. Kafka is a
cluster with brokers, partitions, replication and retention to manage; SQS is an
API call. For a system whose only need is "run this job later", a queue is the
right amount of machinery.

## Where each fits, concretely

```text
  QUEUE                              LOG
  ─────                              ───
  resize an uploaded image           order.placed
  send a password reset email        payment.captured
  generate a PDF                     user.profile.updated
  run a nightly report               inventory.adjusted
  retry a failed webhook             page.viewed

  → COMMANDS: do this thing          → EVENTS: this happened
     one handler, may be retried        many interested parties,
     individually                       replayable
```

That framing — **commands go on queues, events go on logs** — is a reliable
heuristic. A command names an action and has one intended handler. An event
states a fact and has any number of interested consumers, none of whom the
producer needs to know about.

## Priority, delay and the log's weaknesses

Two things queues do that logs genuinely cannot:

**Priority.** A log is strictly ordered by arrival, so an urgent message cannot
jump ahead. The workaround is separate topics per priority with consumers that
poll the high-priority one first — which works, and is more machinery than a
queue's priority field.

**Delayed delivery.** "Deliver this in four hours" is native to SQS and
RabbitMQ. In a log it requires either a scheduler that publishes at the right
time, or the consumer pausing the partition — which blocks everything behind it.
Delayed work is a genuinely poor fit for a log, and the usual answer is a
separate scheduler component.

Conversely, the thing queues do badly: **a queue used as an event bus by
attaching a queue per consumer** works, and then diverges — each consumer's queue
has a different depth and a different failure history, with no shared position to
reason about, and no way to add a consumer that needs history.

## What to take away

1. The defining difference is who owns the position: a queue's broker deletes on
   ack, a log's consumer tracks its own offset and nothing is removed.
2. A log gives replay, many independent consumers and strict per-partition
   ordering; a queue gives per-message retry, priority and delayed delivery.
3. Log consumer parallelism is bounded by partition count — a planning decision
   made at topic creation.
4. A log's speed comes from sequential I/O and the page cache, not from
   cleverness.
5. "The log is the source of truth, everything else is a derived view" lets you
   rebuild any projection by replaying; a queue leaves nothing to rebuild from.
6. Commands go on queues, events go on logs — and when unsure, choose the log,
   because it preserves the option to add a consumer later.

Next: the log's model in detail — topics, partitions, replication and what
actually happens when you produce a message.
