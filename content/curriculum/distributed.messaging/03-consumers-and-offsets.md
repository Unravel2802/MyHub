---
title: Consumers, groups and offsets
minutes: 21
summary: Where the subtle bugs live — commit timing, rebalancing, and the poison message that stops everything.
---

Producing to a log is mostly a matter of configuration. Consuming correctly is
where the real difficulty is, because the consumer owns its position, and every
decision about *when* to record that position is a decision about what happens
after a crash.

## Consumer groups

```text
  topic "orders", 4 partitions

  GROUP "billing"                    GROUP "analytics"
  ┌──────────────────┐               ┌──────────────────┐
  │ consumer 1 → P0  │               │ consumer 1 → P0  │
  │ consumer 1 → P1  │               │ consumer 1 → P1  │
  │ consumer 2 → P2  │               │ consumer 1 → P2  │
  │ consumer 2 → P3  │               │ consumer 1 → P3  │
  └──────────────────┘               └──────────────────┘

  ▸ within a group, each partition goes to exactly ONE consumer
  ▸ different groups are independent — both see every message
  ▸ each group tracks its OWN offsets
```

Two rules follow, and both are commonly discovered the hard way:

**Consumers cannot exceed partitions.** Five consumers on four partitions leaves
one permanently idle. Scaling a consumer means having planned enough partitions.

**One slow consumer blocks its partitions only.** Its partitions fall behind; the
others are unaffected. This makes lag *per partition* the metric that matters,
not lag averaged over the group.

## Offset commit: the decision that defines your semantics

The consumer records how far it has processed. When it does so decides everything.

```text
  COMMIT BEFORE PROCESSING          COMMIT AFTER PROCESSING

  poll ──▶ commit ──▶ process       poll ──▶ process ──▶ commit
                        │                                  │
                     crash                               crash
                        ▼                                  ▼
              message never reprocessed          message reprocessed
              = AT MOST ONCE                     = AT LEAST ONCE
              (message LOST)                     (message DUPLICATED)
```

The same fork as the delivery-semantics chapter, and the same answer: **commit
after processing, and make processing idempotent.** Losing messages is almost
never the right trade.

**Auto-commit is the trap.** `enable.auto.commit=true` commits on a timer,
independent of whether processing finished:

```text
  t=0.0  poll returns messages 100–200
  t=0.5  processing is at message 140
  t=5.0  AUTO-COMMIT fires, records offset 200   ← nothing knows
  t=5.1  crash

  → messages 141–200 were never processed and never will be.
    silent data loss, with no error anywhere.
```

Turn auto-commit off for anything that matters, and commit explicitly after the
batch is handled.

The stronger version is the **inbox pattern** from the transactions topic, which
removes the gap entirely:

```python
with db.transaction():
    db.insert_processed(message.id)      # unique constraint = dedup
    apply(message)                        # the effect
    db.save_offset(partition, offset)     # position, same transaction
# a crash anywhere rolls back all three together
```

Storing the offset in *your own database* alongside the effect is what makes it
atomic. Committing to the broker is a separate system and can never be atomic
with your write — which is the two-writes problem again, and this is its answer.

## Rebalancing

When group membership changes, partitions are reassigned. This is routine — a
deploy, a scale-up, a crash — and it is where most consumer bugs surface.

```text
  consumer 2 leaves

  BEFORE                          AFTER
  c1 → P0, P1                     c1 → P0, P1, P2
  c2 → P2, P3                     c3 → P3
  c3 → (none)

  during the rebalance:
    ▸ processing STOPS (in the eager protocol)
    ▸ uncommitted work is redone by the new owner
    ▸ any local state for a moved partition must be rebuilt
```

**The stop-the-world problem.** The classic ("eager") protocol revokes *all*
partitions from *all* consumers and reassigns from scratch — so one consumer
joining pauses the entire group. With slow state rebuilding, a rolling deploy of
ten instances triggers ten full rebalances and can take the group offline for
minutes.

Two fixes worth knowing and enabling:

```text
  COOPERATIVE (INCREMENTAL) REBALANCING
    only the partitions that actually MOVE are revoked.
    consumers keep processing everything else throughout.
    → CooperativeStickyAssignor. use it.

  STATIC MEMBERSHIP
    each consumer has a stable group.instance.id, so a restart
    within session.timeout.ms does NOT trigger a rebalance at all.
    → makes rolling deploys nearly free
```

**The rebalance-storm failure mode:** processing a batch takes longer than
`max.poll.interval.ms`, so the coordinator decides the consumer is dead and
rebalances. The rebalance makes everyone slower, so another consumer exceeds the
interval, and the group spends its time rebalancing rather than working.

```text
  symptoms: lag climbing, throughput near zero, constant rebalances
  causes:   max.poll.records too high, or slow processing
  fixes:    reduce max.poll.records, raise max.poll.interval.ms,
            move slow work off the poll thread
```

The `max.poll.records` / processing-time relationship is the specific number to
get right: the consumer must be able to process a whole poll batch comfortably
within `max.poll.interval.ms`.

## Poison messages

A message that cannot be processed — malformed, referencing deleted data,
triggering a bug — will be retried forever, and because offsets advance
monotonically, **it blocks its entire partition**.

```text
  partition 2:  [.. 998 ][ 999 ✗ ][ 1000 ][ 1001 ] ...
                             ▲
                  fails every time. offset never advances.
                  everything behind it waits. forever.
```

This is the single most common production incident with log-based consumers, and
it looks like "one partition's lag is growing and the others are fine".

The standard handling:

```python
MAX_ATTEMPTS = 3

def handle(message):
    for attempt in range(MAX_ATTEMPTS):
        try:
            process(message)
            return
        except TransientError:
            sleep(backoff(attempt))
        except PermanentError:
            break                      # do not waste attempts

    # give up: move it aside and ADVANCE, or the partition stalls
    dead_letter_topic.send(message, reason=..., original_offset=...)
    metrics.increment("dead_lettered")
```

Three requirements for this to work:

- **Advance the offset after dead-lettering.** The whole point is to unblock the
  partition.
- **Alert on the dead-letter rate.** A DLQ nobody watches is a data-loss
  mechanism with extra steps — this is precisely one of the cases the
  reconciliation chapter listed.
- **Have a replay path.** Fixing the bug should let you reprocess the DLQ, which
  means the DLQ must retain enough context (the original topic, partition, offset
  and headers) to do so.

A refinement for transient failures that need longer than an in-line retry: a
**retry topic** with a delay. Failed messages go to `orders.retry.5m`, a consumer
of that topic waits and republishes to the main topic. This keeps the main
partition flowing while genuinely transient problems get more time.

## Lag: the metric that matters

```text
  lag = (latest offset in partition) - (consumer's committed offset)
```

```text
  ▸ measure PER PARTITION, not per group — one stuck partition is
    invisible in an average
  ▸ alert on lag TREND, not absolute value; a spike that drains is
    fine, a monotonic climb is not
  ▸ lag in TIME is more meaningful than in messages: "12 minutes
    behind" tells you something "48,000 messages" does not
  ▸ zero lag with zero throughput means the consumer is stopped,
    not caught up — alert on both
```

That last line catches a real and embarrassing failure: a consumer that crashed
cleanly shows no lag growth if the producer also stopped, and dashboards look
perfect while nothing is happening.

## Reading from the right place

```text
  auto.offset.reset = earliest    a new group replays ALL history
                    = latest      a new group starts from now
                    = none        error if no committed offset
```

`earliest` on a large topic means a new consumer group processes months of
history — which is exactly right for building a projection, and exactly wrong for
a notification service that would email everyone about every historical order.
This is a genuine incident pattern: deploying a new consumer group with the
wrong reset policy and sending a decade of notifications.

Deliberate offset manipulation is a legitimate operational tool: reset to a
timestamp to reprocess a day, or forward past a corrupt range. Both should be
runbook procedures rather than improvised during an incident.

## What to take away

1. Within a group each partition has exactly one consumer, so consumers cannot
   exceed partitions and lag must be measured per partition.
2. Commit after processing, never before; auto-commit fires on a timer regardless
   of progress and silently loses messages.
3. Storing the offset in your own database in the same transaction as the effect
   is what makes processing atomic — broker commits never can be.
4. Enable cooperative rebalancing and static membership; a batch that takes longer
   than `max.poll.interval.ms` causes rebalance storms.
5. A poison message blocks its whole partition forever — dead-letter it, advance
   the offset, alert on the rate, and keep a replay path.
6. Alert on lag trend per partition *and* on throughput, because a stopped
   consumer can show zero lag.

Next: operating a log — schemas, evolution, and the patterns that make an
event-driven system maintainable.
