---
title: Contracts and versioning
minutes: 21
summary: How two services that deploy independently change without breaking each other.
---

The moment two services deploy on independent schedules, you can no longer change
both at the same instant. Any change must therefore be safe in a world where
both the old and the new version are running simultaneously — because during
every deploy, both are. Getting this wrong is how a routine field rename becomes
an incident.

## The rule that generates everything else

```text
  During any deploy, ALL FOUR of these combinations exist:

    old client ──▶ old server      ✓ was working
    old client ──▶ new server      ← must work
    new client ──▶ old server      ← must work
    new client ──▶ new server      ✓ will work

  A change is safe only if all four are correct.
```

That is the whole discipline. Every rule below is a consequence of it.

Two directions of compatibility, and you generally need both:

- **Backward compatible** — new code can read old data. A new server understands
  requests from old clients.
- **Forward compatible** — old code can read new data. An old client can handle
  a response from a new server, ignoring what it does not recognise.

Forward compatibility is the one people forget, and it is the one that requires
design rather than discipline: old code can only tolerate new fields if it was
written to *ignore unknown fields* rather than reject them. Strict schema
validation that rejects unknown properties makes forward compatibility
impossible, which is why "additionalProperties: false" is a much bigger decision
than it looks.

## What is safe and what is not

| Change | Safe? | Note |
| --- | --- | --- |
| Add an **optional** field | ✅ | The canonical safe change |
| Add a **required** field | ❌ | Old clients do not send it |
| Remove a field | ❌ | Someone still reads it |
| Rename a field | ❌ | This is a remove plus an add |
| Change a type (`int` → `string`) | ❌ | Parsers break |
| Widen a type (`int32` → `int64`) | ⚠️ | Safe in Protobuf, not in JSON→JS |
| Add an enum value | ⚠️ | Only if consumers handle unknown values |
| Remove an enum value | ❌ | Old data still contains it |
| Make an optional field required | ❌ | Old clients omit it |
| Make a required field optional | ⚠️ | Old *clients* fine; old *readers* may assume presence |
| Add a new endpoint | ✅ | |
| Relax validation | ✅ | Accepting more is safe |
| Tighten validation | ❌ | This is the sneaky one |

The last row deserves attention because it does not look like a schema change.
Adding "email must be lowercase" or "quantity must be ≤ 100" is a breaking change
for any client currently sending values you just outlawed — and it will not show
up in a schema diff.

**Adding an enum value** is the most common accidental break. A client with an
exhaustive `switch` over `status` throws when it receives `PARTIALLY_REFUNDED`
for the first time. The defence has to be built in from the start: every consumer
of an enum needs a default branch, and every producer should treat "add an enum
value" as requiring a check that consumers tolerate unknowns.

## Expand and contract

The general procedure for any change that is not purely additive. Four deploys,
each individually safe.

```text
  Goal: rename `name` → `full_name`

  ┌────────────────────────────────────────────────────────────┐
  │ 1. EXPAND      server writes BOTH fields, reads either      │
  │                clients unchanged                            │
  │                ▸ old client ✓  new client ✓                 │
  ├────────────────────────────────────────────────────────────┤
  │ 2. MIGRATE     backfill full_name for existing data         │
  │                clients updated to READ full_name            │
  ├────────────────────────────────────────────────────────────┤
  │ 3. MIGRATE     clients updated to WRITE full_name           │
  │                (server still accepts both)                  │
  ├────────────────────────────────────────────────────────────┤
  │ 4. CONTRACT    remove `name` — only once telemetry shows    │
  │                nothing has read or written it for N days    │
  └────────────────────────────────────────────────────────────┘
```

Step 4's condition is the one that gets skipped, and skipping it is how you
discover a batch job that runs monthly. **Instrument the old field**: log or
count every read and write of it, and remove it only when the counter has been
zero for longer than your longest-period consumer.

The same four steps apply to database columns, event schemas, config keys and
API fields. It is one pattern, not four.

## Schema formats and what they enforce

**Protobuf** encodes field *numbers*, not names, which makes several of these
rules structural rather than conventional:

```protobuf
message User {
  string id = 1;
  string full_name = 2;
  reserved 3;                    // was `nickname`, deleted
  reserved "nickname";           // name reserved too, so it can't be reused
  optional string email = 4;
}
```

- Renaming a field is free on the wire — the number is what matters. (It still
  breaks generated code, so it is a source change, not a wire change.)
- Removing a field requires `reserved`, and this is not optional bookkeeping:
  reusing field number 3 for a different type would make old messages decode as
  garbage rather than fail. `reserved` is what prevents that.
- Unknown fields are preserved through a decode/encode round trip in proto3, so
  a proxy running an old schema does not silently strip new data.

**Avro** takes a different approach: reader and writer schemas are both present
at decode time, and the reader's schema is applied to the writer's data with
explicit resolution rules and defaults. This makes it strong for long-lived data
at rest, which is why it dominates in data lakes.

**JSON Schema / OpenAPI** describes but does not enforce. Nothing stops a server
returning a response that violates its own spec; you need contract tests to
catch that.

## Contract testing

Integration testing every pair of services is quadratic and slow. **Consumer-
driven contract testing** inverts it:

```text
  1. each CONSUMER writes what it needs from the provider:
       "when I GET /users/7, I need a 200 with `id` and `full_name` as strings"

  2. these expectations are published to a broker

  3. the PROVIDER's CI verifies every published expectation against
     its real implementation

  4. a provider change that breaks any consumer fails the PROVIDER's build
     — before it ships, without running the consumers
```

The key property is that the provider learns it is breaking someone *at build
time*, and it learns which consumer and which field. Pact is the common tool.
This is the practical answer to "how do we know who depends on this field",
which is otherwise unanswerable in a system of any size.

## API versioning: the four options

When a change genuinely cannot be made compatible.

| Strategy | Example | Verdict |
| --- | --- | --- |
| URL path | `/v2/users` | Most common, most visible, coarse |
| Header | `Accept: application/vnd.api.v2+json` | Cleaner URLs, harder to test with curl |
| Query param | `/users?version=2` | Easy, tends to be forgotten by callers |
| Date-based | `Stripe-Version: 2026-03-15` | Best for large public APIs |

**Prefer not versioning at all.** A new major version means running two
implementations, and every subsequent change must be made twice. Most changes
can be additive, and additive changes need no version.

When you must, date-based versioning as Stripe does it is the most humane at
scale: a client pins the date it was written against, the server applies a chain
of transformations from that version to current, and clients upgrade on their own
schedule. The cost is maintaining that transformation chain — real work, and the
reason it only pays off for APIs with many external consumers.

The rules that make versioning survivable:

- **Version the whole API, not individual endpoints.** Per-endpoint versions
  produce a combinatorial mess nobody can reason about.
- **Set a deprecation policy before you need one**, and state it publicly:
  minimum support window, notice period, sunset headers.
- **Measure usage per version.** You cannot retire what you cannot see, and
  "nobody uses v1" is a claim that is wrong surprisingly often.

## Errors are part of the contract

A frequently-missed piece. Callers branch on errors, so error *shapes* are as
much a contract as success shapes.

```json
{
  "type": "https://api.example.com/errors/insufficient-funds",
  "title": "Insufficient funds",
  "status": 402,
  "detail": "Account 7c3f has a balance of 12.50, required 40.00",
  "instance": "/transfers/9a1b",
  "retryable": false
}
```

That is RFC 9457 (problem details), and its useful property is the stable `type`
URI — a machine-readable identity that lets a client branch without parsing
prose. Three rules:

- **Stable machine-readable codes**, never string matching on messages. A
  message is for humans and may be reworded or translated at any time.
- **Say whether it is retryable.** The caller cannot always tell from the status
  code, and guessing wrong causes either lost work or retry storms.
- **Never leak internals.** A stack trace or a SQL error in an error body is an
  information disclosure and couples callers to your schema.

## What to take away

1. Independently deployed services always run mixed versions during a deploy, so
   every change must be correct for all four old/new combinations.
2. Forward compatibility requires consumers to ignore unknown fields — strict
   "reject unknown properties" validation forecloses it.
3. Adding an optional field is safe; adding an enum value, tightening validation
   and making a field required are the breaks people do not see coming.
4. Expand/contract is the general procedure, and the contract step must be gated
   on telemetry showing the old field is unused.
5. Consumer-driven contract tests tell the provider it is breaking someone at
   build time, and say who.
6. Prefer additive change over versioning; error shapes are part of the contract
   and need stable machine-readable codes.

Next: streaming and backpressure — what changes when a call is not a single
request and response.
