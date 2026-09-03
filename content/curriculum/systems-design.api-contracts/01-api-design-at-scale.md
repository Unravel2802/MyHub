---
title: API and contract design at scale
minutes: 18
summary: Interfaces that survive growth, and the design decisions that are expensive to reverse.
---

An API is the most durable thing in a system — implementations get rewritten,
databases get replaced, and the interface persists because other people depend on
it. The decisions below are the ones that are cheap now and very expensive later.

## Pagination

```text
  OFFSET                 ?page=3&limit=20
    ✗ SLOW at depth: the database must scan and discard
      everything before the offset
    ✗ INCORRECT under concurrent writes — an insert shifts
      everything, so items are skipped or repeated

  CURSOR / KEYSET        ?after=eyJpZCI6...&limit=20
    → WHERE (created_at, id) < (:ts, :id) ORDER BY ... LIMIT 20
    ✓ constant time at any depth
    ✓ stable under inserts
    ✗ no random access to "page 47"
```

**Use cursor pagination.** Offset pagination is the single most common API design
mistake that becomes unfixable: once clients depend on page numbers, changing it
is a breaking change, and by then the deep pages are timing out.

```text
  the cursor should be OPAQUE — base64 of the sort key —
  so its internals can change without breaking clients.
```

## Idempotency

```text
  every non-idempotent write should accept an
  Idempotency-Key.

  POST /payments
  Idempotency-Key: 7f3c-a91e-...

  server: seen this key?
    yes → return the STORED RESPONSE, do nothing
    no  → perform, store the response against the key
```

```text
  the two details, from the partial-failure chapter
    □  store the key IN THE SAME TRANSACTION as the effect
    □  store and replay the RESPONSE, not just a flag
```

## Rate limiting

```text
  □  limit per CLIENT, per ENDPOINT — a cheap read and an
     expensive report should not share a budget
  □  return 429 with Retry-After
  □  expose the limits in headers so clients can self-pace:
       X-RateLimit-Limit / Remaining / Reset
  □  distinguish limits from quotas: a limit is per-second,
     a quota is per-month
  □  a burst allowance is usually right — token bucket
```

## Errors

```text
  {
    "type": "https://api.example.com/errors/insufficient-funds",
    "title": "Insufficient funds",
    "status": 402,
    "detail": "Balance 12.50, required 40.00",
    "instance": "/transfers/9a1b",
    "retryable": false
  }
```

```text
  □  a STABLE machine-readable code — never string-match on
     a message
  □  say whether it is RETRYABLE; the status code alone is
     ambiguous
  □  never leak internals — a stack trace or SQL error is
     both a disclosure and a coupling
  □  and errors are part of the CONTRACT: clients branch on
     them, so adding a new one is a compatibility question
```

## Versioning, and avoiding it

```text
  the strategies
    URL path        /v2/users        visible, coarse
    header          Accept: ...v2    cleaner URLs, harder to
                                     curl
    date-based      API-Version: 2026-03-15
                                     best for large public
                                     APIs
```

```text
  PREFER NOT TO VERSION.

  a major version means running two implementations forever,
  and every subsequent change is made twice.

  most changes can be ADDITIVE, and additive changes need no
  version.
```

The compatibility rules are the messaging track's, unchanged: adding an optional
field is safe; adding a required field, removing a field, renaming, reordering,
tightening validation and adding an enum value are not.

## Bulk and batch

```text
  a single-item API forces callers into N+1 over the
  network, permanently.

  → offer a batch form from the start:
      POST /users/batch-get   {ids: [...]}

  and decide the PARTIAL FAILURE semantics explicitly:
    all-or-nothing, or per-item results?
    → per-item is usually right, and must be in the response
      shape from day one
```

Designing the batch shape later is a breaking change; designing it first costs
nothing.

## Long-running operations

```text
  when work exceeds a request timeout:

    POST /exports        → 202 Accepted
                           {job_id, status_url}
    GET  /jobs/{id}      → {status, progress, result_url}

  → and the client polls, or receives a webhook
```

```text
  webhooks, if you offer them
    □  SIGN the payload so receivers can verify it
    □  include an event id for deduplication — delivery is
       at-least-once
    □  retry with exponential backoff and a dead-letter
    □  let receivers replay missed events
```

## Consistency in the contract

```text
  say what a client can expect.

  ✗  "the resource was created" — and a subsequent GET 404s
     because it read a replica

  ✓  return the created object in the POST response
  ✓  or return a version/position token the client can pass
     to subsequent reads
  ✓  or document that reads are eventually consistent, with
     a bound
```

The read-after-write problem is the one that generates the most support tickets
for an otherwise correct system, and returning the created resource in the
response solves the common case for free.

## Designing for the client

```text
  □  fewer round trips: allow field selection and expansion
     rather than forcing N follow-up calls
  □  return what the caller needs, not your data model
  □  make the common case a single request
  □  be consistent: naming, casing, date formats, pagination
     shape — across every endpoint
  □  IDs as strings, always (JSON numbers lose precision
     above 2^53)
```

## What to take away

1. Use opaque cursor pagination — offset is slow at depth, incorrect under
   concurrent writes, and unfixable once clients depend on page numbers.
2. Accept an idempotency key on every non-idempotent write, storing the key and the
   response atomically with the effect.
3. Errors are part of the contract: stable machine-readable codes, an explicit
   retryable flag, and no leaked internals.
4. Prefer additive change to versioning — a major version means maintaining two
   implementations forever.
5. Offer batch endpoints from day one, with per-item failure semantics in the
   response shape.
6. Return the created object on write to solve read-after-write for free, and send
   IDs as strings.

Next: the trade-offs behind all of these choices.
