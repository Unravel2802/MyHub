---
title: The log model in detail
minutes: 21
summary: Topics, partitions, replication and the settings that decide whether a message survives.
---

Kafka is the reference implementation of the log model and the vocabulary most
people use, so it is worth understanding concretely. Almost everything here
transfers to Pulsar, Kinesis and Redpanda, which differ in implementation more
than in model.

## Topics and partitions

```text
  TOPIC "orders"

  partition 0:  [0][1][2][3][4]──▶     ordered
  partition 1:  [0][1][2]──▶           ordered
  partition 2:  [0][1][2][3][4][5]──▶  ordered

  ▸ ordering is guaranteed WITHIN a partition
  ▸ NO ordering guarantee across partitions
  ▸ offsets are per-partition and start at 0 in each
```

A partition is the unit of ordering, of parallelism, of replication and of
storage. Everything about a topic's behaviour follows from how messages are
distributed across its partitions.

**Which partition a message lands in:**

```text
  key provided     →  partition = hash(key) mod partition_count
                      → all messages with the same key are ORDERED
  no key           →  round robin / sticky batching
                      → maximum throughput, NO ordering guarantee
```

**Choosing the key is choosing the ordering guarantee**, exactly as with database
partitioning. Key by `order_id` and all events for an order are ordered. Key by
`user_id` and all events for a user are ordered, including across their orders.
The right choice comes from what the consumer needs to see in order.

The two failure modes:

- **No key when you needed one.** Events for one entity spread across partitions
  and are processed out of order. `order.shipped` before `order.placed`.
- **A hot key.** One partition takes the majority of traffic — the skew problem
  from the partitioning topic, with the same tools (split the key with a suffix,
  or handle that key separately).

**Partition count is effectively one-way.** You can increase it; you cannot
decrease it. And increasing it **changes `hash(key) mod count`**, so a key that
was going to partition 3 now goes to partition 7, and its ordering across the
change is broken. Plan for a few years of growth, and know that a topic needing a
different partition count in practice means creating a new topic and migrating.

## Replication and the settings that matter

Each partition has a leader and followers:

```text
  partition 0, replication factor 3

  broker 1: LEADER    ◀── all reads and writes
  broker 2: follower  ── replicating
  broker 3: follower  ── replicating

  ISR (in-sync replicas) = the followers caught up within a threshold
```

The **ISR** is the concept to understand, because the durability guarantee is
expressed in terms of it. A follower that falls behind is removed from the ISR,
and a shrinking ISR silently reduces your durability.

Three settings, and together they decide whether an acknowledged message can be
lost:

```text
  acks=0    fire and forget. the producer does not wait.
            → messages lost on any broker hiccup

  acks=1    the LEADER has it. followers may not.
            → leader fails before replicating → MESSAGE LOST
            → this is the dangerous default in older clients

  acks=all  every in-sync replica has it
            → combined with min.insync.replicas, this is durable
```

```text
  min.insync.replicas = 2, replication.factor = 3, acks = all

  → a write needs 2 replicas
  → tolerates 1 broker down and keeps accepting writes
  → if 2 brokers are down, writes are REFUSED rather than
    silently accepted with 1 copy
```

That refusal is the point. `acks=all` alone is not enough: if the ISR has shrunk
to one replica, "all in-sync replicas" means one, and you are back to `acks=1`
without noticing. `min.insync.replicas=2` is what makes the guarantee real, and
it is the single most commonly missing setting in Kafka deployments.

**Unclean leader election** is the other one:

```text
  unclean.leader.election.enable = false   ← the safe setting

  if no in-sync replica is available, the partition goes OFFLINE
  rather than electing an out-of-date replica and silently
  discarding committed messages.

  = choosing CP. availability of that partition is sacrificed
    to avoid data loss.
```

Enabling unclean election trades correctness for availability and is almost never
right for data you care about.

## Storage: segments and retention

A partition is stored as a series of segment files:

```text
  partition 0/
    00000000000000000000.log     ← closed segment
    00000000000000000000.index   ← offset → byte position
    00000000000000000000.timeindex
    00000000000000173829.log     ← active segment, being appended
    00000000000000173829.index
```

Retention deletes whole segments, which is why it is cheap — no per-message
bookkeeping, just unlinking files.

```text
  retention.ms     = 604800000   (7 days)
  retention.bytes  = -1          (unlimited size)

  a segment is deleted when EITHER limit is exceeded.
```

**Log compaction** is the alternative retention mode, and it changes what the
topic means:

```text
  BEFORE compaction
  [k1:v1][k2:v1][k1:v2][k3:v1][k2:v2][k1:v3]

  AFTER compaction — only the LATEST value per key survives
  [k3:v1][k2:v2][k1:v3]

  → the topic becomes a durable, replayable KEY-VALUE SNAPSHOT
```

This turns a log into a changelog: a new consumer replaying from the start gets
the current state of every key without replaying the whole history. It is what
makes Kafka viable for configuration topics, for CDC streams, and for the
state-store backing of stream-processing applications.

Two details that matter: a compacted topic needs **keys on every message**
(unkeyed messages cannot be compacted), and a **tombstone** — a message with a
null value — is how you delete a key, retained for `delete.retention.ms` so
consumers have a chance to see it. That is the same tombstone-and-grace-period
design as the leaderless-replication chapter, for the same reason.

## Producing a message

What actually happens, because the batching is where the performance comes from:

```text
  send() ──▶ [ serialiser ] ──▶ [ partitioner ] ──▶ [ record accumulator ]
                                                            │
                                       batches per partition, held until
                                       batch.size OR linger.ms
                                                            │
                                                            ▼
                                                   [ sender thread ]
                                                            │
                                                     one request per
                                                     broker, many batches
```

```text
  linger.ms = 0     send immediately. lowest latency, worst throughput.
  linger.ms = 5-20  wait briefly to fill a batch.
                    → often 10x the throughput for 5 ms of latency
```

This is the same amortisation argument as consensus batching: a small,
deliberate latency cost buys a large throughput gain, and the default of zero is
tuned for latency rather than for efficiency.

**Idempotent producers** (`enable.idempotence=true`) deserve to be on by default.
A producer retry after a lost acknowledgement would otherwise append the message
twice; with idempotence the broker deduplicates using a producer ID and sequence
number, and it also preserves ordering under retry — which
`max.in.flight.requests.per.connection > 1` would otherwise break.

## Message size and what does not belong in a log

```text
  default max message size: ~1 MB

  DO NOT put large payloads in messages:
    - they blow up broker memory and replication traffic
    - they slow every consumer, including ones that do not need
      the payload
    - retention is by bytes, so large messages shorten history
```

The **claim check** pattern is the answer: put the payload in object storage and
the reference in the message.

```json
{
  "event": "document.uploaded",
  "document_id": "doc-7c3f",
  "storage_url": "s3://uploads/doc-7c3f.pdf",
  "size_bytes": 48291043
}
```

The message stays small, the log stays fast, and consumers that only need the
metadata never fetch the object.

## What to take away

1. A partition is the unit of ordering, parallelism, replication and storage;
   choosing the message key is choosing the ordering guarantee.
2. Partition count is effectively one-way, and increasing it breaks per-key
   ordering across the change.
3. `acks=all` is insufficient alone — `min.insync.replicas=2` is what makes the
   durability guarantee real when the ISR shrinks.
4. Disable unclean leader election unless you would rather lose committed
   messages than lose availability of a partition.
5. Log compaction turns a topic into a replayable key-value snapshot, and needs
   keys plus tombstones with a grace period.
6. `linger.ms` of 5–20 often multiplies throughput for a trivial latency cost;
   enable idempotent producers; keep large payloads out of messages via a claim
   check.

Next: consumers — groups, offsets, rebalancing, and the failure modes that live
there.
