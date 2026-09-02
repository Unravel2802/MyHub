---
title: Event schemas and evolution
minutes: 19
summary: The contract in a log outlives every service reading it, which changes how you design it.
---

An event schema is a contract with an unusual property: the data is **retained**,
so a schema change must be compatible not only with today's consumers but with
every message already in the topic. A field you remove today still exists in
messages from last month that someone may replay next year.

## Why this is harder than an API contract

```text
  HTTP API                          EVENT LOG
  ────────                          ─────────
  request → response → gone         messages retained for days,
                                    months, or forever

  break it → callers fail now       break it → replay fails LATER,
  and you find out immediately      possibly much later, possibly
                                    during an incident recovery
```

The failure is delayed and arrives at the worst moment: you are replaying to
rebuild a corrupted projection, and the consumer cannot parse messages from
before the schema change. Schema discipline in a log is not bureaucracy; it is
what keeps replay — the log's main value — actually available.

## Compatibility modes

A schema registry enforces one of these when a new version is registered:

```text
  BACKWARD      new consumer can read OLD data
                → safe: add optional field, delete a field
                → upgrade CONSUMERS first

  FORWARD       old consumer can read NEW data
                → safe: add a field, delete an optional field
                → upgrade PRODUCERS first

  FULL          both
                → safe: add or remove OPTIONAL fields only

  NONE          no checking. do not.
```

**`BACKWARD` is the right default for event topics**, because it is what makes
replay work: today's consumer must be able to read everything in the topic,
including the oldest messages.

The upgrade-order implication is the practical part and it is easy to get
backwards:

```text
  BACKWARD compatible change → deploy CONSUMERS first, then producers
  FORWARD compatible change  → deploy PRODUCERS first, then consumers
```

Getting this wrong produces a window where the deployed consumer cannot read what
the deployed producer is writing, which looks like a broker problem and is not.

## What is safe

| Change | Backward | Forward |
| --- | --- | --- |
| Add optional field (with default) | ✅ | ✅ |
| Add required field | ❌ | ✅ |
| Remove optional field | ✅ | ✅ |
| Remove required field | ✅ | ❌ |
| Rename a field | ❌ | ❌ |
| Widen a type (int32 → int64) | ✅ | ❌ |
| Narrow a type | ❌ | ✅ |
| Add an enum value | ❌ | ✅ |
| Change semantics of a field | ❌ | ❌ |

The last row is not detectable by any registry and is the most dangerous change
there is. Redefining `amount` from dollars to cents, or `status` from "the
customer's view" to "the warehouse's view", passes every compatibility check and
silently corrupts every consumer.

**Rule: never change what a field means. Add a new field and deprecate the old
one.** This is the expand/contract pattern, and in a log the contract phase is
gated on retention rather than on consumer deployment — you can only remove a
field once no retained message needs it.

## Designing the event itself

Three decisions that matter more than the serialisation format.

**Events are facts, in the past tense.** `OrderPlaced`, not `PlaceOrder`. An
event states something that happened and cannot be rejected; a command requests
something and can be. Naming them as commands invites consumers to treat a topic
as an RPC channel with extra steps.

**Include enough context to be self-contained.** The alternative — a thin event
that forces every consumer to call back for details — recreates the coupling the
log was meant to remove, and makes replay impossible because the current state no
longer matches the historical event.

```text
  THIN (event-carried notification)   FAT (event-carried state transfer)
  { "order_id": "ord-7c3f" }          { "order_id": "ord-7c3f",
                                        "customer_id": "cus-991",
  every consumer must call the          "total_cents": 420000,
  order service. replay gives you       "currency": "USD",
  TODAY's state, not the state at       "items": [...],
  the time of the event.                "placed_at": "..." }
```

Prefer fat events for anything that may be replayed. The cost is message size and
some duplication; the benefit is consumers that need no synchronous dependency
and a replay that reproduces history rather than the present.

**Include an envelope.** Metadata every event should carry regardless of type:

```json
{
  "event_id": "01JQ8X...",
  "event_type": "order.placed",
  "event_version": 2,
  "occurred_at": "2026-09-02T10:14:33.201Z",
  "producer": "order-service@3.14.1",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "partition_key": "ord-7c3f",
  "data": { }
}
```

Each field earns its place: `event_id` for deduplication, `occurred_at` distinct
from broker append time, `event_version` so a consumer can branch explicitly,
`producer` so you can find who emitted a malformed message, and `trace_id` so the
async half of a request appears in the same trace as the synchronous half —
which, as the RPC topic noted, is where half the latency usually is.

## Formats

| | JSON | JSON + Schema Registry | Avro | Protobuf |
| --- | --- | --- | --- | --- |
| Size | large | large | small | small |
| Human readable | ✅ | ✅ | ❌ | ❌ |
| Schema enforced | ❌ | ✅ | ✅ | ✅ |
| Evolution rules | by convention | checked | strong | strong |
| Schema travels with data | n/a | id in the payload | id in the payload | id in the payload |
| Tooling ubiquity | ✅ | ✅ | Kafka-centric | ✅ |

**Avro is the traditional choice in Kafka ecosystems** because its
reader/writer-schema resolution was designed for exactly this problem: the
consumer's schema is applied to data written with a different schema, with
explicit rules and defaults. **Protobuf is a reasonable alternative** if your
organisation already uses it for RPC, and keeps one IDL rather than two.

**Plain JSON with no registry is the choice to avoid** for internal event topics.
It works fine until the first incompatible change, which is discovered by a
consumer crashing in production rather than by a producer's build failing.

## Topic design

```text
  ONE TOPIC PER EVENT TYPE            ONE TOPIC PER AGGREGATE
  orders.placed                        orders   (placed, paid, shipped,
  orders.paid                                    cancelled — all of them)
  orders.shipped

  + consumers subscribe precisely      + ordering ACROSS event types
  + independent retention                for one order is preserved
  - ordering across types is LOST      - consumers filter what they
    unless they share a partition        do not need
```

**Prefer one topic per aggregate** when the order of different event types
matters for the same entity — which it usually does. `order.shipped` arriving
before `order.placed` is a bug that one-topic-per-type invites and that
one-topic-per-aggregate makes impossible.

Naming conventions are worth setting early, because renaming a topic is a
migration:

```text
  <domain>.<aggregate>.<version>       commerce.orders.v1
```

Putting a version in the *topic name* is the escape hatch for a change that
cannot be made compatible: create `v2`, dual-publish, migrate consumers, retire
`v1`. It is heavier than a schema evolution, and it is what you use when the
schema registry correctly refuses your change.

## What to take away

1. Event schemas outlive services because the data is retained — a break shows up
   later, often during a replay you are relying on.
2. Use `BACKWARD` compatibility for event topics, and remember it means deploying
   consumers before producers.
3. Changing what a field *means* passes every compatibility check and corrupts
   every consumer — add a new field instead.
4. Events are past-tense facts; prefer fat events carrying state so replay
   reproduces history rather than today.
5. Ship an envelope with event id, type, version, occurred-at, producer and trace
   id on every message.
6. Use a schema registry; prefer one topic per aggregate so event types stay
   ordered for one entity; put a version in the topic name as the escape hatch.

Next: the architectural patterns these enable, and the ones that go wrong.
