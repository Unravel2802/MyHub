---
title: Event-driven patterns
minutes: 20
summary: What a log lets you build, and the two designs that turn into distributed spaghetti.
---

A durable, replayable, multi-consumer log enables a set of architectural patterns
that are genuinely powerful, and a couple that look similar and are traps. The
difference is usually about who owns a decision, and whether a consumer is
reacting to a fact or being told what to do.

## Event notification versus state transfer versus sourcing

Three distinct things get called "event-driven", and they have different
consequences.

```text
  1. EVENT NOTIFICATION
     "something happened, go look"
     { "type": "order.placed", "order_id": "ord-7c3f" }

     + tiny messages
     - every consumer must call back → coupling and load
     - replay gives you TODAY's state, not the state at the time

  2. EVENT-CARRIED STATE TRANSFER
     "something happened, here is what you need"
     { "type": "order.placed", "order_id": ..., "customer": ...,
       "items": [...], "total_cents": 420000 }

     + consumers are autonomous; no synchronous dependency
     + replay reproduces history correctly
     - larger messages, duplicated data

  3. EVENT SOURCING
     the event log IS the source of truth. current state is a
     fold over the events.

     + complete audit trail, time travel, rebuildable projections
     - every read is a fold or a maintained projection
     - schema evolution is permanent — you can never rewrite history
```

Most systems want (2). It is the one that makes consumers independent and replay
meaningful, at the cost of message size.

**Event sourcing is a much bigger commitment than it looks**, and it is
frequently adopted for the audit trail alone when an append-only audit table
would have done. Its real costs: every query needs a projection, the events are
immutable so a modelling mistake is permanent, and GDPR-style deletion is
genuinely hard when your source of truth is append-only. Adopt it where the event
history *is* the domain — ledgers, trading, version control, collaborative
editing — and not because it sounds like the modern approach.

## CQRS, and when it earns its place

Separate the write model from the read models:

```text
  commands ──▶ WRITE MODEL ──▶ events ──▶ ┬──▶ read model: search index
                                          ├──▶ read model: dashboard
                                          └──▶ read model: API cache

  each read model is shaped for ONE query pattern and rebuilt by replay
```

The genuine benefits: read models are independently scalable, individually
optimised, and rebuildable from the log when one is corrupted or when a new one
is needed.

The genuine cost: **the read models are eventually consistent with the write
model**, and the user who just did something will read from a projection that may
not have caught up. That is the read-your-writes problem from the replication
topic, and CQRS makes it structural rather than incidental. The usual mitigations
apply — return the new state in the command's response, or have the client hold a
version and wait for the projection to reach it.

Use CQRS when read and write patterns genuinely diverge. Do not use it because
the diagram is appealing; a single model that serves both is simpler and correct
for most services.

## Change data capture

Publish a database's own change log as events:

```text
  ┌──────────┐    ┌──────────┐    ┌───────┐    ┌──────────────┐
  │ Postgres │──▶│ Debezium │──▶ │ Kafka │──▶ │ search index │
  │   WAL    │    │          │    │       │    │ warehouse    │
  └──────────┘    └──────────┘    └───────┘    │ cache        │
                                               └──────────────┘
```

The virtue is that it is impossible to forget: the events come from the same log
the database uses for durability, so any committed change produces an event by
construction. No application code can bypass it, which is exactly the failure
mode dual writes have.

The costs are real:

- **Events are row changes, not domain events.** `orders.status changed from
  'paid' to 'shipped'` is not `OrderShipped`, and consumers end up reconstructing
  intent from table diffs.
- **Your schema becomes a public contract.** A column rename breaks every
  downstream consumer, which is a surprising and unwelcome coupling.
- **Replication slots are an operational hazard.** A stalled CDC consumer means
  the database retains WAL indefinitely and eventually fills its disk. This is a
  genuine, recurring outage; monitor slot lag as a first-class metric.

**CDC is excellent for data synchronisation** — keeping a warehouse, search index
or cache in step. It is a poor substitute for deliberately designed domain
events, and using it that way exports your schema to the whole organisation. The
outbox pattern is the middle path: CDC reads the *outbox table*, so delivery is
guaranteed by the log while the event shape stays deliberate.

## The patterns that go wrong

**The distributed monolith via events.** Services that must be deployed together
because an event schema change ripples through all of them, or where a business
process is spread across six services with no one able to describe it. This is
the choreography problem from the sagas chapter, and the symptom is that
answering "what happens when X?" requires reading every service.

**Events as RPC.** Publishing `order.created` and waiting for
`order.created.completed` is a request/response call built out of two topics, with
worse latency, worse error handling and worse debuggability than an HTTP call.
If the producer needs an answer, it should make a call.

```text
  the test:
    Does the producer care WHO consumes this, or WHETHER anyone does?
       └─ YES ──▶ it is a command or a call. do not use an event.
       └─ NO  ──▶ it is a fact. an event is right.
```

**Chatty event chains.** `A` emits, `B` reacts and emits, `C` reacts and emits,
`D` reacts. Each hop adds latency and a failure point, nobody owns the flow, and
a cycle is easy to create by accident (`D` emits something `A` consumes) — which
produces an infinite loop with no obvious cause.

**The shared event bus with no ownership.** One topic that every service publishes
to and consumes from, with no schema and no owner. It becomes an integration
database with worse tooling.

## Idempotence, one more time

Every consumer in every pattern above must be idempotent. The three mechanisms,
in increasing order of robustness:

```text
  1. NATURAL IDEMPOTENCE
     the operation is inherently repeatable
     "set status = shipped", "add to a set", "upsert by id"

  2. DEDUPLICATION TABLE
     record processed event_ids in the same transaction as the effect
     (the inbox pattern)

  3. VERSION CHECK
     ignore anything not newer than what you have applied
     → also makes the handler ORDER-INSENSITIVE, which is stronger
```

(3) is worth preferring where the domain allows it, because it removes the
ordering requirement as well as the duplication requirement:

```python
def apply(event):
    current = store.get(event.entity_id)
    if current and current.version >= event.version:
        return                       # duplicate OR out of order — ignore
    store.upsert(event.entity_id, event.data, version=event.version)
```

That handler is correct under duplication, under reordering, and under
concurrent delivery to two workers. It is the most robust shape available and it
costs one column.

## Choosing a shape

```text
  Does the producer need an answer to continue?
    └─ YES ──▶ synchronous call. not an event.

  Do several independent consumers need this fact?
    └─ YES ──▶ event, fat, on a log

  Is this one specific job for one specific worker?
    └─ YES ──▶ command on a queue

  Do you need to rebuild a read model, or add a consumer later?
    └─ YES ──▶ log with retention long enough to replay

  Is the event history itself the domain?
    └─ YES ──▶ event sourcing. otherwise, do not.
```

## What to take away

1. Event notification, event-carried state transfer and event sourcing are three
   different things; most systems want state transfer.
2. Event sourcing is a large commitment — immutable history, projections for every
   query, hard deletion — and is right when the history *is* the domain.
3. CQRS makes read-your-writes a structural problem; adopt it when read and write
   patterns genuinely diverge, not by default.
4. CDC guarantees delivery because it reads the durability log, but exports your
   schema as a contract — CDC over an outbox table is the middle path.
5. If the producer cares who consumes it or whether anyone does, it is a command,
   not an event.
6. A version-checked handler is idempotent *and* order-insensitive, which is the
   most robust consumer shape available.

Next: operating this in production — the numbers to watch and the failure modes
that recur.
