---
title: Operating a log in production
minutes: 19
summary: The failure modes that recur, the numbers to watch, and what to do when you are hours behind.
---

Log-based systems fail in a small number of characteristic ways, and they are
different from the ways a database fails. This chapter is the operational
knowledge: what to monitor, what the common incidents look like, and what to do
during the one that will actually happen to you — a consumer that is hours behind
and falling further.

## The metrics that matter

```text
  PER PARTITION (not averaged — an average hides a stuck partition)
    □  consumer lag, in messages AND in time
    □  produce rate and consume rate
    □  ISR size            ← shrinking means durability is degrading
    □  under-replicated partitions

  PER BROKER
    □  disk usage and growth rate    ← the most common hard failure
    □  request handler idle ratio    ← saturation before latency shows it
    □  network throughput

  PER CONSUMER GROUP
    □  rebalance rate       ← should be near zero
    □  commit failure rate
    □  processing time p99 vs max.poll.interval.ms
    □  dead-letter rate

  END TO END
    □  time from produce to consume, measured with a synthetic probe
```

Two of these deserve special mention because they predict incidents rather than
report them:

**ISR size.** A partition whose ISR has silently shrunk from 3 to 1 has the
durability of a single node while all the configuration still says 3. This is a
gradual failure that nothing alerts on unless you ask it to.

**Rebalance rate.** A group that rebalances repeatedly is a group about to have an
outage. As with leader-change rate in consensus, near-zero is the only acceptable
value in steady state.

## The recurring incidents

**Disk fills.** The most common hard failure in Kafka operations. Retention is
per topic, so one topic with a mistaken `retention.ms=-1` or a burst of traffic
fills a broker, and a broker with a full disk stops accepting writes for *every*
topic on it.

```text
  prevention:
    □  a default retention that is not "infinite"
    □  quotas per producer
    □  alert on disk at 70%, page at 85% — a full disk is not
       recoverable by waiting
    □  know which topics are largest, and check after every new one
```

**Consumer falls behind and cannot catch up.** Consumption rate is below
production rate, so lag grows monotonically. If the lag exceeds retention, data is
lost permanently — the messages are deleted before the consumer reaches them.

```text
  lag in TIME approaching retention.ms = an approaching deadline
  after which you are LOSING data, not merely delayed
```

**Rebalance storm.** Covered in the consumer chapter: processing exceeds
`max.poll.interval.ms`, the coordinator evicts the consumer, the rebalance slows
everyone, and it repeats. Symptom: high rebalance rate, near-zero throughput.

**Poison message stalls one partition.** Symptom: one partition's lag climbing
while the others are flat. The most distinctive signature in this list, and the
reason per-partition lag matters.

**Hot partition.** One key dominates traffic; that partition's consumer is
saturated while others idle. Symptom: skewed produce rate per partition.

**A new consumer group with `auto.offset.reset=earliest`** replays the entire
history. Harmless for a projection; an incident for anything that sends
notifications or calls a paid API.

## When a consumer is hours behind

The incident you will actually have. In order:

```text
  1. STOP THE BLEEDING
     is lag still growing, or draining? if growing, consumption is
     below production and nothing else matters until that changes.

  2. IS IT ONE PARTITION OR ALL?
     one   → poison message, or a hot key
     all   → under-provisioned, or a slow downstream dependency

  3. HOW LONG UNTIL DATA LOSS?
     lag in time vs retention.ms. if that gap is closing,
     EXTEND RETENTION FIRST — it is a config change and it buys
     you the time to fix everything else.

  4. INCREASE THROUGHPUT, in order of speed:
     a. scale consumers — but only up to the partition count
     b. increase max.poll.records / batch size
     c. remove slow work from the consume path (write to a
        buffer, process asynchronously)
     d. scale the downstream dependency, which is usually the
        real bottleneck

  5. IF NONE OF THAT IS ENOUGH
     consider skipping ahead deliberately: reset the offset to
     latest, and BACKFILL the gap separately from the retained log.
     serving fresh data while backfilling old data is usually
     better than being uniformly hours stale.
```

Step 3 is the one people miss under pressure, and it is the cheapest action on
the list. Extending retention costs disk and converts a data-loss deadline into a
performance problem.

Step 5 is a real technique and worth having pre-authorised: for many workloads,
being current on new events and repairing history in the background is far better
than processing a queue in order while falling further behind.

## Capacity planning

```text
  storage per topic = produce_rate × avg_message_size
                      × retention_seconds
                      × replication_factor
                      × 1.3            ← indexes and headroom

  example: 5,000 msg/s × 2 KB × 7 days × 3 × 1.3
         = 5,000 × 2,048 × 604,800 × 3 × 1.3
         ≈ 24 TB
```

That number surprises people, and it is why retention is a cost decision rather
than a default. Halving retention to three days halves the bill.

**Partition count** from the throughput you need per consumer:

```text
  partitions >= target_throughput / per_consumer_throughput

  and remember: it can only go UP, and going up breaks per-key
  ordering across the change. plan for a few years.
```

**Do not create tens of thousands of partitions.** Each one costs file handles,
memory, and time in leader elections and rebalances. A cluster with a hundred
thousand partitions has slow, risky failover.

## Multi-region

```text
  ACTIVE-PASSIVE                     ACTIVE-ACTIVE
  ──────────────                     ─────────────
  region A: primary                  both regions produce
  region B: mirrors A                each mirrors the other

  + simple, clear ordering           + local produce latency
  - failover needs offset            - loop prevention required
    translation                      - no global ordering
```

Mirroring tools (MirrorMaker 2, and its equivalents) copy topics between clusters
asynchronously. **Offsets do not match between clusters** — the mirrored topic
has its own offsets — so a consumer failing over cannot simply reuse its
position, and needs offset translation or a timestamp-based reset. Test that
procedure before you need it, because "we failed over and every consumer replayed
from the beginning" is a recoverable but memorable incident.

Active-active needs loop prevention: mark each message with its origin cluster
and refuse to mirror a message back to where it came from, or two clusters will
copy the same message to each other forever.

## The runbook worth writing in advance

```text
  □  how to reset a consumer group to a timestamp
  □  how to skip a specific offset
  □  how to increase retention on a live topic
  □  how to add partitions, and what breaks when you do
  □  how to drain and replay a dead-letter topic
  □  how to fail over a consumer to another region
  □  who to tell when you skip messages
```

The last line is not a technical step and belongs in the runbook anyway. Skipping
messages is a decision with data-loss consequences, and it should be recorded,
communicated, and followed by a backfill plan — not performed quietly at 3am and
forgotten.

## What to take away

1. Monitor lag per partition in *time*, ISR size, and rebalance rate — the last
   two predict incidents rather than reporting them.
2. A full disk stops writes for every topic on that broker; retention defaults
   and disk alerts at 70% are the prevention.
3. Lag in time approaching retention is a data-loss deadline — extending retention
   is the cheapest first action in that incident.
4. One partition lagging means a poison message or a hot key; all partitions
   lagging means capacity or a slow downstream dependency.
5. Serving fresh data while backfilling history separately is usually better than
   processing in order while falling further behind.
6. Storage is produce rate × size × retention × replication; halving retention
   halves the bill, and offsets do not translate across mirrored clusters.

That completes messaging and event streaming. Next in the track: **coordination
and locking** — the primitives built on consensus that services use to agree on
who does what.
