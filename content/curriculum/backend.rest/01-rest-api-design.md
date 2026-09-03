---
title: REST API design
minutes: 17
summary: Resources, verbs, and the parts of an API contract that determine how painful it is to change later.
---

REST is a set of conventions on top of HTTP, and its value is almost entirely
in consistency: an API that follows them is guessable, and one that doesn't
forces every consumer to read the docs for every endpoint. This chapter is the
decisions that are easy to get wrong, and expensive to fix once clients exist.

## Resources and verbs

```text
  GET    /orders           list
  GET    /orders/42        one
  POST   /orders           create
  PUT    /orders/42        full replace
  PATCH  /orders/42        partial update
  DELETE /orders/42        remove
```

```text
  the recurring mistake: a VERB in the URL.

    POST /orders/42/cancel        ✗  action-shaped
    PATCH /orders/42 {status: "cancelled"}   ✓ resource-shaped

  → not absolute (some actions genuinely are not a field
    update — "send this order to a different warehouse" is a
    process, not a PATCH). but reach for a resource shape
    first, because it composes with the rest of REST's
    conventions — caching, idempotency, generic clients —
    and a verb endpoint opts out of all of them silently.
```

## Nesting: how deep, and when to stop

```text
  GET /customers/42/orders           ✓ orders scoped to a
                                        customer — clear
  GET /customers/42/orders/7/items/3 ✗ three levels deep

  → an item has ONE canonical location:
      GET /items/3
    nesting is for SCOPING a collection, not for encoding a
    full ownership chain in every URL. two levels is usually
    the practical ceiling.
```

## Pagination

```text
  OFFSET-BASED
    GET /orders?page=3&limit=20
    simple, but a page shifts under you if rows are inserted
    or deleted between requests — page 2 can repeat or skip
    rows from page 1's neighbourhood

  CURSOR-BASED
    GET /orders?after=eyJpZCI6NDJ9&limit=20
    the cursor encodes a position (typically the last id or
    sort key seen) — stable under concurrent writes, and the
    only option that scales past a small offset (OFFSET
    10000 still has the database walk past 10000 rows to
    discard them)
```

```text
  → cursor-based for anything with meaningful write volume or
    scale. offset-based is fine for a small admin table that
    changes rarely — this is a place where the "more
    correct" option is the wrong default at small scale,
    because a cursor is real complexity to build a UI around
    (no jump-to-page-5).
```

## Versioning

```text
  URL        /v2/orders                explicit, cacheable,
                                        visible in every log
  HEADER     Accept: application/vnd.api.v2+json
                                        clean URLs, invisible
                                        in access logs and
                                        curl history
```

```text
  the harder problem isn't the mechanism, it's the POLICY:
  how long do v1 and v2 run in parallel, and who is
  responsible for migrating v1 callers?

  → an unversioned "just add optional fields" approach avoids
    the question entirely for ADDITIVE changes — new
    optional field, new optional query param — and is
    preferable to versioning for as long as every change is
    additive.
```

## Errors clients can act on

```text
  the useless error:
    {"error": "something went wrong"}

  the useful one:
    {
      "error": {
        "code": "INSUFFICIENT_INVENTORY",
        "message": "Only 2 units of SKU-4471 remain",
        "field": "items[0].quantity"
      }
    }
```

```text
  a MACHINE-READABLE code (INSUFFICIENT_INVENTORY) lets a
  client branch on the error type; a message alone forces
  either string-matching (fragile — the message can be
  reworded) or showing the raw string to a user who cannot
  act on it.
```

This is the client-facing edge of the rule in [CLAUDE.md](/curriculum): a store
never surfaces a raw database error to the UI. A REST error body is the same
discipline applied at the API boundary — the code is stable and documented,
the message is for a developer's console, not for parsing.

## Idempotency for POST

```text
  POST is not idempotent by the spec — but "create the order
  twice because the client's retry raced the first request's
  slow response" is a real bug, not a theoretical one.

    POST /orders
    Idempotency-Key: 3f29a1e4-...

  the server stores (key → result) for a window (e.g. 24h);
  a repeated key returns the STORED result instead of
  creating a second order.
```

[backend.api-hardening](/curriculum/backend.api-hardening) covers the storage and expiry mechanics; this is
the API-design half — the header is part of the contract, documented like any
other field.

## HATEOAS, briefly

```text
  the "purest" form of REST embeds the next valid actions in
  the response:

    {"id": 42, "status": "pending",
     "_links": {"cancel": "/orders/42/cancel"}}

  → rare in practice. most APIs are "level 2" REST — resources
    and verbs, no embedded links — and that is a reasonable,
    widely-used stopping point, not a failure to reach level 3.
```

## What to take away

1. Prefer a resource shape over an action verb in the URL — it is what makes
   caching, idempotency and generic clients work without special cases.
2. Cursor-based pagination is the only option that stays correct under
   concurrent writes and scales past a small offset; offset-based is fine only
   at small, low-churn scale.
3. Versioning is a policy problem (how long do two versions run, who migrates
   callers) more than a mechanism problem — avoid it as long as changes stay
   additive.
4. An error body needs a stable machine-readable code, not just a message —
   the same discipline as never surfacing a raw database error to a UI.
5. An idempotency key for POST solves a real retry-duplication bug; level-2
   REST (resources and verbs, no embedded links) is a reasonable stopping
   point, not an unfinished implementation.
