---
title: Ordering in practice
minutes: 19
summary: Choosing a scheme for IDs, event logs and conflict resolution, and the traps in each.
---

The theory of the previous chapters becomes a small number of concrete
decisions: what to use as an identifier, how to order an event log, how to
resolve two writes that arrived without knowledge of each other, and how to make
a distributed trace tell the truth. This chapter is those decisions.

## Choosing an identifier

The ID scheme is an ordering decision disguised as a naming decision, and it is
very expensive to change later.

| Scheme | Sortable by time? | Coordination | Size | Leaks info? |
| --- | --- | --- | --- | --- |
| Auto-increment | ✅ | **central** | 8 B | volume, sequence |
| UUIDv4 (random) | ❌ | none | 16 B | no |
| **UUIDv7** | ✅ ms precision | none | 16 B | creation time |
| ULID | ✅ ms precision | none | 16 B | creation time |
| Snowflake | ✅ | node ID assignment | 8 B | time, node |
| Hash of content | ❌ | none | 32 B | no |

**UUIDv7 is the modern default** for a distributed system. It puts a 48-bit
millisecond timestamp in the high bits followed by randomness, so IDs sort
chronologically while needing no coordination at all:

```text
  UUIDv7 layout

  ┌──────────────────────────┬────┬──────────────────────────────┐
  │ unix_ts_ms (48 bits)     │ver │ random (74 bits)             │
  └──────────────────────────┴────┴──────────────────────────────┘
   sorts chronologically       7    collision-resistant
```

The reason this matters is not aesthetics — it is **database index locality**.
Random UUIDv4 primary keys scatter inserts across the whole B-tree, dirtying
pages everywhere and destroying write throughput on a large table:

```text
  UUIDv4 inserts              UUIDv7 inserts
  ──────────────              ──────────────
  ┌─┬─┬─┬─┬─┬─┬─┬─┐           ┌─┬─┬─┬─┬─┬─┬─┬─┐
  │▓│ │▓│ │ │▓│ │▓│           │ │ │ │ │ │ │▓│▓│
  └─┴─┴─┴─┴─┴─┴─┴─┘           └─┴─┴─┴─┴─┴─┴─┴─┘
  random pages dirtied        appends to the rightmost page
  poor cache hit rate         hot page stays in memory
```

The counter-consideration: sequential IDs concentrate writes on one page, which
under very high concurrency becomes a contention hotspot, and they leak creation
time. Snowflake IDs additionally leak your node topology and, historically, let
observers estimate a company's volume by watching ID growth.

**Never expose an auto-increment integer in a public URL** for anything
non-public. It tells an attacker exactly how many records you have and lets them
enumerate them — this is the "insecure direct object reference" class, and it is
consistently among the most common real-world API vulnerabilities.

## Ordering an event log

The question is always "ordered with respect to what?", and the answer should be
the smallest scope that satisfies the requirement.

```text
  GLOBAL ORDER            every event totally ordered
                          → one sequencer, no horizontal scaling
                          → almost never actually required

  PER-PARTITION ORDER     ordered within a key, unordered across
                          → scales linearly
                          → what you almost always want

  CAUSAL ORDER            respects happens-before, concurrent events unordered
                          → scales, preserves what users notice
                          → needs HLC or vector clocks

  NO ORDER                handlers are order-insensitive
                          → simplest and most robust where achievable
```

Choosing the partition key *is* choosing the ordering guarantee, and that is the
design decision worth being deliberate about:

```text
  partition by user_id     → all events for a user are ordered
                             events across users are not
                             ✓ right for user timelines, per-account ledgers

  partition by order_id    → all events for an order are ordered
                             ✓ right for order state machines

  partition by region      → ordered within a region
                             ✗ wrong if one entity's events span regions
```

The trap: **a hot key breaks the scaling** that partitioning bought you. One
enormous customer's events all land on one partition, and that partition becomes
the bottleneck while the rest sit idle. Detect it by monitoring per-partition
throughput, and handle it either by splitting the key (`user_id:bucket`, giving
up ordering within the user) or by handling that key separately.

## Conflict resolution: the four strategies

When two writes to the same thing happen without knowledge of each other, one of
four things happens.

**1. Last-write-wins.** Keep the one with the higher timestamp.

```text
  cheap, simple, always terminates
  SILENTLY DISCARDS one write — and under clock skew,
  possibly the one that really happened later
```

Legitimate for caches, sensor readings, presence status, user preferences. Not
legitimate for anything where losing the write is a defect: comments, cart
contents, financial records.

**2. Application merge.** Surface both versions and let code decide.

```text
  correct, keeps everything, requires the store to expose siblings
  and a merge function on every read path
```

**3. CRDTs.** Encode the merge in the data type so it is automatic, commutative
and associative — any order of merging gives the same answer.

```text
  G-Counter    grow-only counter: merge = max per replica, then sum
  G-Set        grow-only set: merge = union
  OR-Set       add/remove set with unique tags per add
  LWW-Register single value with a timestamp — LWW, formalised
```

Covered properly later in the track. The relevant point here is that a CRDT is
not magic: it makes *some* merges automatic by constraining what operations you
may express.

**4. Reject the conflict.** Optimistic concurrency: require the writer to state
which version it read, and fail if it has moved.

```text
  UPDATE orders SET status='shipped', version=version+1
  WHERE id=7 AND version=3;
  -- 0 rows → someone else wrote; re-read and retry
```

No data is lost and no merge function is needed — the caller retries against the
new state. This is the right default for anything with a single logical owner,
and it is dramatically under-used compared with how well it works.

## Ordering inside a trace

A practical case that catches people. Distributed traces assembled from
wall-clock timestamps routinely show a child span starting before its parent, or
finishing after it, because the two services' clocks differ by more than the
span duration.

```text
  what the clocks say              what actually happened

  parent  ├─────────────┤          parent  ├─────────────┤
  child ├───┤                      child     ├───┤
        ▲                                    ▲
  starts BEFORE its parent —       correct: the child is contained
  impossible
```

The fix is not better clocks. Tracing systems record the **parent-child
relationship explicitly** in the span, and renderers should lay out from that
structure and use timestamps only for relative durations *within* a service. If
your tracing UI is drawing purely from timestamps, it will show impossible
pictures, and the answer is to trust the causal structure over the numbers.

## Idempotency keys and time

A detail that bites in production: idempotency keys need an expiry, and the
expiry interacts with retry policy.

```text
  dedup window too SHORT ──▶ a client retrying after a long backoff
                             gets a second execution
  dedup window too LONG  ──▶ unbounded storage growth

  rule of thumb: dedup window > (max retry attempts × max backoff)
                                × a comfortable safety factor
```

With three retries capped at 20 s of backoff, the last retry can arrive about a
minute after the first attempt — but a client that crashed and resumed from a
durable queue might retry an hour later. Twenty-four hours is a common window for
payments, and it should be a deliberate number derived from the longest possible
retry path, not a default.

Compute the expiry with a **monotonic-safe** method: store an absolute wall-clock
expiry timestamp (fine, it is a point in time, not a duration) but never
implement the window as "start a timer for N seconds" in a process that may
restart.

## The decision summary

```text
  Need                                  Use
  ──────────────────────────────────    ─────────────────────────────
  Identifier, distributed, sortable     UUIDv7 (or ULID)
  Identifier, single writer             auto-increment, internal only
  Order events for one entity           partition by entity id
  Order across entities                 ask why — usually you do not
  Order across nodes, no sequencer      HLC
  Detect concurrent writes              vector clock / version vector
  Resolve concurrent writes safely      optimistic concurrency, or CRDT
  Resolve concurrent writes cheaply     LWW — and document what it loses
  Measure a duration                    monotonic clock, always
  Show a time to a human                wall clock, UTC, with offset
```

## What to take away

1. The ID scheme is an ordering decision. UUIDv7 gives time-sortable, coordination
   -free IDs and preserves database index locality that UUIDv4 destroys.
2. Never expose sequential integer IDs publicly — they enumerate and they leak
   volume.
3. Choosing a partition key *is* choosing the ordering guarantee; pick the
   smallest scope that satisfies the requirement, and watch for hot keys.
4. Conflict resolution has four options — LWW, application merge, CRDT, or reject
   — and optimistic concurrency is under-used relative to how well it works.
5. Traces must be laid out from recorded parent-child structure, not from
   timestamps, or they will draw impossible pictures.
6. An idempotency dedup window must exceed the longest possible retry path, and
   should be a derived number rather than a default.

That completes Clocks, Order and Causality. Next in the track: **replication** —
keeping several copies of data, and the guarantees each arrangement can offer.
