---
title: HTTP and the web platform
minutes: 18
summary: The protocol underneath every API — methods, status codes, and the caching semantics most services get wrong.
---

Every backend topic that follows sits on top of HTTP, so its guarantees and its
gaps are worth knowing precisely rather than by feel. Most production bugs in
this area are not exotic — they are a status code used loosely, or a caching
header nobody set on purpose.

## Methods and idempotency

```text
  METHOD    SAFE   IDEMPOTENT   BODY
  GET       yes    yes          no
  HEAD      yes    yes          no
  PUT       no     yes          yes   (full replace)
  DELETE    no     yes          no
  POST      no     no           yes   (create / non-idempotent action)
  PATCH     no     no*          yes   (partial update)
```

```text
  SAFE        does not change server state (a GET that logs
              analytics is still "safe" in the HTTP sense —
              safety is about the RESOURCE, not side effects)

  IDEMPOTENT  calling it N times has the same effect as
              calling it once

              → PUT /users/5 {name: "Ana"} twice leaves the
                same state
              → POST /orders twice creates TWO orders
```

```text
  why this matters operationally:

  a client that times out does not know if the request
  arrived. retrying is only SAFE automatically for an
  idempotent method — a load balancer, a proxy, and a
  browser's own retry-on-connection-reset all rely on this.
```

That distinction is what the Rate Limiting & Resilience chapter
builds idempotency keys on top of, for the POST case where the method itself
gives no guarantee.

## Status codes as a contract

```text
  2xx  SUCCESS
    200 OK              — has a body
    201 Created         — plus a Location header
    204 No Content       — succeeded, nothing to return

  3xx  REDIRECTION
    301 Moved Permanently — caches the redirect, changes bookmarks
    304 Not Modified       — conditional GET, no body

  4xx  CLIENT ERROR — retrying unchanged will not help
    400 Bad Request        — malformed
    401 Unauthorized        — not authenticated
    403 Forbidden            — authenticated, not permitted
    404 Not Found
    409 Conflict              — state clash (version, unique key)
    422 Unprocessable Entity  — well-formed, fails validation
    429 Too Many Requests     — rate limited

  5xx  SERVER ERROR — retrying MAY help
    500 Internal Server Error
    502 Bad Gateway           — upstream returned garbage
    503 Service Unavailable   — overloaded, try later
    504 Gateway Timeout
```

```text
  the 401 vs 403 mistake, seen constantly:

  401 = "I don't know who you are"
  403 = "I know who you are, and no"

  returning 403 for a missing token leaks that the RESOURCE
  exists to an unauthenticated caller. return 401 first,
  403 only once identity is established.
```

A client that branches on status code family (2xx / 4xx / 5xx retry-or-not) is
depending on this table being followed consistently — an API that returns 200
with `{"error": "not found"}` in the body breaks every generic HTTP client,
proxy, and monitoring tool built on that contract.

## Headers that carry meaning

```text
  CONTENT NEGOTIATION
    Accept: application/json         client states preference
    Content-Type: application/json   body states what it is

  CACHING  (see below)
    Cache-Control, ETag, Last-Modified

  CONDITIONAL REQUESTS
    If-None-Match: "abc123"     → 304 if ETag still matches
    If-Match: "abc123"          → 412 if it does NOT
                                   (optimistic concurrency
                                    over HTTP, see
                                    backend.transactions)
```

## Caching semantics — the part most services get wrong

```text
  Cache-Control: max-age=300, public
                          │      │
                          │      └─ shared caches (CDN) may store it
                          └──────── fresh for 300s, no revalidation needed

  Cache-Control: no-cache          MUST revalidate every time (it is
                                    still cached, just always checked —
                                    the name is famously misleading)

  Cache-Control: no-store          never cache this, anywhere
```

```text
  the response you must get right: an authenticated,
  per-user response cached as `public` — served to the NEXT
  user who hits the same URL.

  → any response whose body depends on identity needs
    `private` or `no-store`, and a CDN in front of the API
    needs to be told this explicitly. it will not infer it
    from the presence of an Authorization header.
```

```text
  ETag revalidation avoids re-sending an unchanged body:

    client:  GET /products/42
             If-None-Match: "v7"
    server:  304 Not Modified          (no body — cheap)
       or:   200 OK, ETag: "v8"        (changed — full body)
```

## HTTP/1.1, HTTP/2, HTTP/3

```text
  HTTP/1.1   one request per TCP connection at a time
             → browsers open 6 connections per host to
               compensate (head-of-line blocking)

  HTTP/2     multiplexed streams over ONE TCP connection
             → head-of-line blocking moves to TCP itself:
               one lost packet stalls every stream

  HTTP/3     runs over QUIC (UDP), each stream has its own
             loss recovery
             → a lost packet stalls only its own stream
```

```text
  → mostly a transport concern the framework and CDN handle.
    the exception: HTTP/2 makes "domain sharding" (splitting
    assets across cdn1/cdn2/cdn3 to dodge the 6-connection
    cap) actively COUNTERPRODUCTIVE — it now forces multiple
    connections where one multiplexed one was faster.
```

## Statelessness, and where state actually lives

```text
  HTTP is stateless: the server holds nothing between
  requests BY THE PROTOCOL'S OWN DESIGN.

    → "session state" is an illusion built on top, via a
      cookie carrying an id that looks up server-side state,
      or a self-contained token (see backend.auth)

  → this is what makes horizontal scaling straightforward:
    any request can go to any server, PROVIDED the server
    does not keep request-local memory that the next request
    from the same client depends on.
```

## What to take away

1. Idempotency is a real guarantee, not a convention — it is what makes
   automatic retry safe, and only some methods have it.
2. Status codes are a contract multiple layers depend on; 401 vs 403 leaks
   whether a resource exists, so check authentication before authorization.
3. Cache-Control's `public`/`private` distinction is the one that causes
   incidents — an identity-dependent response cached as public leaks across
   users.
4. HTTP/2 moves head-of-line blocking from the application layer to TCP;
   HTTP/3's QUIC removes it by giving each stream independent loss recovery.
5. Statelessness is a design constraint, not a description of reality — every
   session mechanism is built on top of it, deliberately.
