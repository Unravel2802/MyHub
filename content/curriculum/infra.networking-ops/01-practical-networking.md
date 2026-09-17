---
title: Practical networking
minutes: 18
summary: TLS certificates, load balancers, and reading a traceroute — the Computer Networking chapter's stack, operated rather than just understood.
---

The Computer Networking chapter covered what each layer guarantees. This
chapter is the operational side: the tools and artifacts (a certificate, a
load balancer's health check, a traceroute) that an engineer actually
configures and debugs when a networked system misbehaves in production.

## TLS certificates: the chain of trust, made concrete

```text
  your server's certificate
       ↓ signed by
  an INTERMEDIATE certificate authority
       ↓ signed by
  a ROOT certificate authority (pre-installed, trusted by
  every browser/OS by default)

  → a browser verifies your certificate by walking this chain
    UP to a root it already trusts — this is why a server must
    send its FULL chain (leaf + intermediate), not just the
    leaf certificate: a browser that doesn't already have the
    intermediate cached can't verify the chain without it,
    producing a confusing "certificate not trusted" error even
    though the certificate itself is perfectly valid.
```

```text
  → EXPIRY is the most common real-world TLS incident: a
    certificate silently expiring (often because a manual
    renewal process was forgotten) takes a service from working
    to completely broken for every client, instantly, at a
    specific known moment — which is exactly why automated
    renewal (Let's Encrypt's ACME protocol, a managed cloud
    certificate) has become the default rather than a nice-to-
    have: it removes a human's memory from a failure mode with
    zero warning and total impact.
```

## Load balancers: distributing traffic, and detecting failure

```text
  ROUND ROBIN            each request to the NEXT server in
                        sequence — simple, ignores each
                        server's actual current load

  LEAST CONNECTIONS         route to whichever server currently
                        has the FEWEST active connections —
                        better for requests with very
                        different durations

  HEALTH CHECKS              the load balancer periodically
                        pings each backend; a server that
                        stops responding correctly is
                        REMOVED from rotation automatically
```

```text
  → a health check needs to check something MEANINGFUL, not
    just "is the process running" — a server whose process is
    alive but whose DATABASE CONNECTION has died can still pass
    a naive TCP-connect health check while returning 500s to
    every real request; a proper health check endpoint verifies
    the actual DEPENDENCIES a request needs, not just that the
    port is open.
```

## Reading a traceroute

```text
  traceroute example.com

   1  192.168.1.1        1.2 ms   (your own router)
   2  10.20.30.1          8.4 ms   (your ISP)
   3  * * *                          (a hop that doesn't
                                       respond to traceroute's
                                       probes — NOT necessarily
                                       a problem, many routers
                                       are configured to ignore
                                       them deliberately)
   4  203.0.113.5        45.1 ms
   5  example.com         46.3 ms
```

```text
  → traceroute works by sending packets with an increasing TTL
    (Time To Live) — each router that forwards a packet
    decrements TTL, and when it hits zero, that router sends
    back an error, REVEALING itself as one hop on the path.
    reading it: a SUDDEN latency jump between two specific hops
    localizes WHERE a slowdown is happening; a chain of "* * *"
    timeouts at the END (never reaching the destination) means
    the path itself is broken, not just slow — genuinely
    different problems, and traceroute distinguishes them.
```

## CDNs: caching at the edge, and cache invalidation's real cost

```text
  origin server (one location) → CDN edge nodes (MANY
  locations, geographically close to users) → users

  → a CDN serves cached content from a LOCATION close to the
    requesting user, dramatically cutting the round-trip
    latency the Computer Architecture and Computer Networking
    chapters' numbers already established matters — this is
    the same "cache at every level" idea, applied at the
    geographic/network scale instead of the CPU/memory scale.
```

```text
  → invalidating a CDN cache across EVERY edge location isn't
    instant — this is the same reason the Backend Engineering
    track's "prefer versioned keys over invalidation" advice
    exists at this exact layer: a content-hashed URL (a new
    version gets a NEW url) sidesteps invalidation entirely,
    where purging a cached URL across a global edge network can
    take real, visible time to fully propagate.
```

## VPCs and network isolation

```text
  a VPC (Virtual Private Cloud) is a logically isolated network
  within a cloud provider — PRIVATE subnets (no direct internet
  route) for databases and internal services, PUBLIC subnets
  (with an internet gateway) for anything that needs to be
  externally reachable.

  → this is a real, enforced security boundary, not just
    organizational tidiness: a database in a private subnet is
    UNREACHABLE from the public internet regardless of any
    application-level auth — an attacker who compromises
    credentials still can't reach it without also being INSIDE
    the VPC (via a bastion host, VPN, or a compromised service
    that's already inside), which is exactly the layered
    "defense in depth" the Security Foundations chapter covers
    in principle.
```

## Firewalls: allow-lists as the safer default

```text
  DEFAULT DENY     block everything, explicitly ALLOW only
                   what's needed — the safer default: a
                   forgotten rule means something that SHOULD
                   work doesn't, which is annoying but visible
                   and safe

  DEFAULT ALLOW      allow everything, explicitly BLOCK what's
                   dangerous — a forgotten rule means something
                   DANGEROUS is silently allowed through,
                   which is a security gap that may not be
                   noticed until it's exploited
```

```text
  → default-deny's failure mode is annoying but SAFE; default-
    allow's failure mode is invisible and DANGEROUS — this
    asymmetry is why default-deny is the standard recommendation
    for any genuinely security-sensitive boundary, even though
    it means more upfront configuration work to explicitly
    allow legitimate traffic.
```

## What to take away

1. A server must send its full certificate chain, not just the leaf — a
   browser without the intermediate cached can't verify an otherwise
   perfectly valid certificate.
2. Certificate expiry is the most common real-world TLS incident precisely
   because it's a zero-warning, total-impact failure — which is why
   automated renewal has replaced manual processes as the default.
3. A load balancer's health check needs to verify actual dependencies, not
   just that a port is open — a server with a dead database connection can
   pass a naive TCP check while failing every real request.
4. Traceroute localizes a network problem by revealing which hop introduces
   a latency jump or where the path stops responding entirely — two
   genuinely different problems it distinguishes.
5. Default-deny fails safely (annoying but visible); default-allow fails
   dangerously (invisible until exploited) — this asymmetry is why
   default-deny is the standard for a security-sensitive network boundary.
