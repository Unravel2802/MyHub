---
title: Where load balancing happens
minutes: 19
summary: Five layers that all balance traffic, what each can see, and why HTTP/2 broke the traditional one.
---

Load balancing happens at several layers simultaneously, and each one sees
something different. A decision made at the DNS layer cannot know about a
backend's queue depth; a decision made in the client can. Knowing which layer can
see what is how you diagnose "why is all the traffic going to one server?".

## The layers

```text
  user
   │
   ├── DNS                    returns one of several IPs
   │     sees: nothing but the query. no health, no load.
   │
   ├── ANYCAST                the network routes to the nearest POP
   │     sees: network topology only
   │
   ├── L4 (transport)         balances TCP CONNECTIONS
   │     sees: IP, port. not the request.
   │
   ├── L7 (application)       balances REQUESTS
   │     sees: path, headers, method, cookies, response codes
   │
   └── CLIENT-SIDE            the caller picks a backend per call
         sees: its own latency and error history per backend
```

The rule that falls out: **the closer to the request, the better the decision;
the closer to the network, the cheaper and more global.** Real systems use
several together — anycast to a region, L7 within it, client-side between
services.

## DNS

The oldest and coarsest. Return multiple A records and let clients pick.

```text
  api.example.com → 203.0.113.10
                    203.0.113.11
                    203.0.113.12
```

Its problems are all the same problem — **DNS has no idea what is happening**:

- No health awareness. A dead server keeps being returned until the record is
  updated *and* every cache expires.
- TTLs are advisory. Resolvers and runtimes routinely ignore them; some cache
  forever unless configured otherwise.
- No load awareness at all. Round-robin over addresses, regardless of capacity.
- Clients often use only the first record returned.

DNS is therefore appropriate for **coarse geographic steering** — send European
users to the European load balancer — and unsuitable as the mechanism for
distributing load across instances. Use short TTLs (30–60 s), and never rely on a
DNS change to take a failing instance out of service quickly.

## Anycast

The same IP address announced from many locations; BGP routes each user to the
topologically nearest one.

```text
  198.51.100.1 announced from London, Virginia, Singapore

  a user in Berlin ──▶ London (fewest AS hops)
  a user in Boston ──▶ Virginia
```

Zero client latency cost, automatic failover if a site withdraws its
announcement, and it is the standard mechanism for CDNs and DNS resolvers. Its
limits: routing follows BGP's notion of "near", which is about topology rather
than geography or load, and a re-route mid-connection breaks TCP — which is why
anycast is most comfortable with UDP and short connections, and why QUIC's
connection IDs help.

## L4 versus L7

The distinction that matters most in practice.

```text
  L4 (transport)                    L7 (application)

  balances CONNECTIONS              balances REQUESTS
  forwards packets                  terminates and re-originates
  cannot see the request            sees path, headers, body
  cannot retry                      can retry, rewrite, split
  very high throughput              more CPU per request
  TLS passes through                TLS terminated here
```

```text
  L4:  connection ──▶ backend A  ── every request on it goes to A
  L7:  request 1 ──▶ backend A
       request 2 ──▶ backend B    ── same connection, different backends
```

**This is where HTTP/2 changes everything.** HTTP/1.1 opened many short
connections, so balancing connections approximated balancing requests. HTTP/2
multiplexes everything over one long-lived connection:

```text
  client ══════ ONE HTTP/2 connection ══════▶ [L4 LB] ──▶ backend A
                                                            ▲
       10,000 requests/second, all of them, to one backend.
       backends B and C are idle. the LB is "working correctly".
```

This is a real and common production incident, and it looks like a mystery until
you know the mechanism. The fixes:

```text
  □  use an L7 proxy that understands HTTP/2 framing (Envoy, nginx)
  □  or balance in the client, which holds connections to all backends
  □  or set a max connection age/requests so connections rotate
```

That last one — `MAX_CONNECTION_AGE` in gRPC, `max_requests_per_connection` in
Envoy — is the pragmatic mitigation when you cannot change the topology: force
connections to be re-established periodically so they redistribute.

## Client-side load balancing

The client holds a list of backends and picks one per request.

```text
  client (knows all backends, tracks per-backend latency and errors)
     ├──▶ backend A
     ├──▶ backend B
     └──▶ backend C
```

```text
  + no extra network hop, so lower latency
  + per-REQUEST balancing over HTTP/2 without a proxy
  + the client sees its OWN latency, which is the number that matters
  + no shared component to become a bottleneck

  - the client needs the backend list (service discovery)
  - a library per language, and they must agree
  - configuration lives in every client, so a change is a fleet rollout
```

**The service mesh is the compromise**: a sidecar proxy per instance does
client-side balancing on the application's behalf, so the logic is written once
and the application speaks plain HTTP to localhost. You pay a process per pod and
a small latency cost for something that would otherwise be N language libraries.

## Global server load balancing

Steering users to a region:

```text
  □  GEO         nearest region by IP geolocation
  □  LATENCY     lowest measured latency, from real user measurements
  □  WEIGHTED    a percentage split, for migrations and canaries
  □  FAILOVER    primary region, with automatic fallback
  □  CAPACITY    respects per-region limits, overflows when full
```

Latency-based beats geo-based in practice, because network distance and physical
distance diverge — a user physically closer to one region may route better to
another. Providers that collect real-user measurements (as CDNs do) make better
decisions than any geolocation table.

The trap: **regional failover must consider data, not just traffic.** Sending
European users to a US region because the European one is degraded is only
correct if the US region has their data and can serve them. A GSLB that fails
traffic over to a region without the data turns a partial outage into a total
one, more slowly.

## Choosing a topology

```text
  internet → your edge          anycast + L7 (or a CDN doing both)
  edge → services               L7 proxy
  service → service             client-side or a service mesh
  service → database            client-side, with a connection pool
  anything over HTTP/2          NOT L4
```

The most common mistake is the last line. The second most common is putting an
L7 proxy on a service-to-service path where a client-side library would have
avoided a hop and a shared failure domain.

## What to take away

1. Each layer sees something different; the closer to the request, the better the
   decision and the more expensive it is.
2. DNS has no health or load awareness and its TTLs are advisory — use it for
   coarse geographic steering, never to remove a failing instance quickly.
3. L4 balances connections, L7 balances requests, and HTTP/2's single long-lived
   connection makes L4 send everything to one backend.
4. When you cannot change the topology, bounded connection age forces
   redistribution.
5. Client-side balancing removes a hop and sees the latency that actually matters;
   a service mesh gives you that without a library per language.
6. Latency-based global steering beats geo-based, and regional failover is only
   correct if the target region has the data.

Next: the algorithms, and why the obvious one is the wrong default.
