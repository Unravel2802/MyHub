---
title: Delivery semantics
minutes: 20
summary: At-most-once, at-least-once, and why exactly-once is a claim to interrogate rather than believe.
---

Every system that sends a message across a network makes one of three promises
about how many times it will be delivered. Two of them are achievable. The third
is the most misunderstood term in distributed systems, and the confusion is not
academic — it is the difference between a payments system that double-charges
and one that does not.

## The three semantics

```text
  AT MOST ONCE          send, do not retry
                        ├─ delivered 0 or 1 times
                        └─ messages CAN BE LOST

  AT LEAST ONCE         send, retry until acknowledged
                        ├─ delivered 1 or more times
                        └─ messages CAN BE DUPLICATED

  EXACTLY ONCE          delivered precisely 1 time
                        └─ not achievable as stated (see below)
```

The choice between the first two is forced, and it is a direct consequence of
partial failure. When you send a message and get no acknowledgement, you have
exactly two options — retry or do not — and each one gives up something:

```text
  no ack received. the message may or may not have arrived.

        DON'T RETRY ─────▶ if it was lost, it is gone forever
                           = at most once

        RETRY ───────────▶ if it arrived, it now arrives twice
                           = at least once
```

There is no third option, because the information needed to choose correctly —
did it arrive? — is precisely the information that did not come back.

## At-most-once: when losing is acceptable

Fire and forget. Send it, do not wait, do not retry.

Appropriate when the data is high-volume and individually worthless:

- Metrics samples. Losing one data point out of a thousand changes no
  dashboard.
- Cache invalidation *hints* where a TTL is the real correctness mechanism.
- Log lines from a debug-level stream.
- UDP-based telemetry, game state updates where a newer update supersedes.

The trap is using it for something that *looks* low-value and is not. Audit
events, billing events and security logs all feel like telemetry and are
absolutely not: a missing audit record is a compliance failure, and a missing
usage event is money you did not bill.

## At-least-once: the default, and what it obliges you to do

Retry until acknowledged. This is what almost every message broker, task queue
and well-built RPC client does, because losing messages is usually worse than
duplicating them.

The obligation it creates is absolute: **every consumer must be idempotent.**
Not "should be", not "usually is" — the system will deliver duplicates, and a
consumer that cannot handle them is broken by construction.

Where the duplicates come from is worth knowing, because they are not rare:

```text
  1. the ack is lost              producer retries a message that arrived
  2. the consumer crashes         after processing, before acking
     mid-processing               → redelivered on restart
  3. the consumer is slow         visibility timeout expires, broker
                                  redelivers to another consumer, and now
                                  TWO consumers are processing it
  4. rebalancing                  a partition moves between consumers and
                                  uncommitted offsets are reprocessed
```

Case 3 is the one that surprises people. A consumer that takes longer than the
broker's visibility timeout has its message handed to someone else *while it is
still working*. Two workers now process the same message concurrently — not
sequentially — so an idempotency check of "have I seen this before?" can pass in
both, because neither has finished writing yet.

That is why the check must be atomic with the effect, not a read followed by a
write:

```python
# WRONG — a race between the check and the insert
if not db.exists(event_id):
    process(event)
    db.mark_processed(event_id)

# RIGHT — the database decides, once
try:
    with db.transaction():
        db.insert_processed(event_id)   # unique constraint on event_id
        process(event)                  # same transaction as the marker
except UniqueViolation:
    return                              # someone else has it. done.
```

The unique constraint is doing the concurrency control. This shape — insert a
deduplication row in the same transaction as the effect, and let the database
reject the second one — is the workhorse pattern for at-least-once consumers.

## "Exactly once" — what it can and cannot mean

The claim in its literal form is impossible. A message is delivered by sending
bytes; the sender cannot know they arrived; therefore it must either risk loss
or risk duplication. No protocol escapes this, and the two generals problem is
the proof.

What systems that advertise "exactly-once" actually provide is one of two much
narrower things.

**Exactly-once *processing* (effectively-once).** The message may be *delivered*
many times, but its *effect* is applied once, because the effect and the record
of having applied it commit atomically.

```text
  delivery:  ──▶ ──▶ ──▶      three times
  effect:    ─────█─────      once

  achieved by: at-least-once delivery + idempotent, atomic processing
```

This is genuinely achievable and is what you want. Note what it requires: the
deduplication state and the side effect must be in **one transactional store**.
If your consumer reads from Kafka, writes to Postgres, and calls Stripe, then
Stripe's effect is outside the transaction and only Stripe's own idempotency
keys can make that leg safe.

**Exactly-once within a closed system.** Kafka's transactional producer, and
Flink's checkpointing, achieve it *inside their own boundary*: read offsets,
processing state and output are committed atomically because one system owns all
three.

```text
  Kafka exactly-once (read-process-write):

    ┌──────────────────────────────────────────────┐
    │  ONE Kafka transaction                       │
    │    consume from topic A (offset commit)      │
    │    produce to topic B                        │
    │  commit  ← both, or neither                  │
    └──────────────────────────────────────────────┘

  the moment you add an HTTP call or an external DB write,
  it is no longer in the transaction, and the guarantee stops there
```

The questions to ask anyone claiming exactly-once:

```text
  □  Exactly-once DELIVERY, or exactly-once PROCESSING?
  □  Within what boundary?  What crosses it?
  □  What is the deduplication window, and what happens after it expires?
  □  Where is the dedup state stored, and is it atomic with the effect?
  □  What happens when the consumer restarts / rebalances / scales?
```

The fourth question exposes most of the weak claims. Deduplication that relies
on an in-memory set, or a Redis key with a one-hour TTL, is exactly-once for an
hour and at-least-once after that — which may be fine, but should be a decision
rather than a surprise.

## Ordering, which is a separate promise

Delivery count and delivery order are independent, and conflating them causes
real design errors.

```text
  what you usually get:

    ┌──────────────────────────────────────────────┐
    │  ordered within a PARTITION / KEY / SESSION  │
    │  unordered across them                       │
    └──────────────────────────────────────────────┘
```

Kafka orders within a partition. SQS FIFO orders within a message group. A
single TCP connection orders within itself. **Global ordering across a
distributed system is expensive and almost never what you need** — it requires
funnelling everything through one place, which is the thing you distributed to
avoid.

What you usually need is ordering *per entity*: all events for order #4711 in
order, with no constraint between order #4711 and order #8823. Partitioning by
entity ID gives you exactly that, and scales, which is why it is the standard
design.

Two hazards worth naming:

- **Retries break ordering.** If message 1 fails and is retried while message 2
  succeeds, 2 lands before 1. A producer that allows more than one in-flight
  request per partition can reorder on retry — Kafka's
  `max.in.flight.requests.per.connection` and idempotent-producer settings exist
  for precisely this.
- **Concurrent consumers break ordering.** Scaling a consumer group past one
  worker per partition means messages for the same partition may be processed
  concurrently. If order matters, concurrency must be bounded per key.

The robust alternative, where you can manage it: **make handlers
order-insensitive.** Carry a version or timestamp in the event and ignore
anything older than what you have already applied. Then reordering is harmless
and you have removed a whole class of constraint:

```python
def apply(event):
    current = store.get(event.entity_id)
    if current and current.version >= event.version:
        return                    # stale or duplicate — ignore
    store.put(event.entity_id, event, version=event.version)
```

That handler is idempotent *and* order-insensitive, and it needs neither a
transaction across systems nor a single-threaded consumer.

## Choosing, in practice

| Workload | Semantics | Why |
| --- | --- | --- |
| Metrics, traces | At most once | Volume is high, individual samples worthless |
| Cache invalidation | At most once + TTL | The TTL is the real correctness mechanism |
| Order placed, payment | At least once + idempotent | Cannot lose; must not double-apply |
| Email / notification | At least once, deduped | A lost email is worse than a rare duplicate |
| Search index update | At least once, order-insensitive | Version field makes reorder harmless |
| Financial ledger | At least once + atomic dedup + reconciliation | And still reconcile |

The last row is the practical summary of this whole chapter. Even with correct
semantics, systems that handle money run a reconciliation job that compares
independent records and repairs differences — because the guarantees hold only
as far as the code implementing them is correct, and reconciliation is what
catches the case where it was not.

## What to take away

1. When an acknowledgement does not arrive you may retry or not, and that choice
   *is* the choice between at-least-once and at-most-once. There is no third
   option.
2. At-least-once is the right default, and it obliges every consumer to be
   idempotent — not as good practice, but as a correctness requirement.
3. The idempotency check must be atomic with the effect; a read-then-write check
   races against a concurrent redelivery.
4. "Exactly-once delivery" is impossible. Exactly-once *processing* is
   achievable within a boundary where dedup state and effect commit together —
   always ask where that boundary ends.
5. Ordering is a separate promise from delivery count, is normally per-partition
   only, and is broken by both retries and concurrent consumers.
6. An order-insensitive handler with a version check is more robust than any
   ordering guarantee you can buy.

Next: contracts and versioning — how two services that deploy independently
avoid breaking each other.
