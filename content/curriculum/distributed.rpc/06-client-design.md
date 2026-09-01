---
title: RPC client design
minutes: 20
summary: Connection pools, client-side load balancing, and the tracing without which none of it is debuggable.
---

Most of the reliability of a service-to-service call lives in the client, not the
server — and the client is usually the part nobody owns. A well-configured
client with pooling, sensible timeouts and load balancing will ride out failures
that a default-configured one turns into an outage. This chapter is the settings
that matter and why.

## Connection pooling

Establishing a connection costs a TCP handshake plus a TLS handshake — two to
three round trips before any application data moves. At 1 ms per round trip
within a region, that is 2–3 ms added to every request that opens a fresh
connection, which for a 5 ms call is a 50% overhead.

A pool keeps connections open and hands them out:

```text
  ┌────────────── connection pool ──────────────┐
  │  [conn 1: idle]  [conn 2: in use]           │
  │  [conn 3: idle]  [conn 4: in use]           │
  └─────────────────────────────────────────────┘
       │                    │
   acquire ──▶ use ──▶ release (NOT close)
```

The settings that matter, and the failure each one prevents:

| Setting | Typical | Prevents |
| --- | --- | --- |
| Max connections | 10–100 per host | Exhausting the *server's* connection limit |
| Max idle | ~ max connections | Reconnect churn under bursty load |
| Idle timeout | 30–90 s | Holding connections a load balancer already dropped |
| **Acquire timeout** | 1 s or less | Unbounded waiting when the pool is exhausted |
| Max connection lifetime | 5–30 min | Sticking to instances that should have rotated |

**The acquire timeout is the one people omit**, and its absence produces a
distinctive failure: the service appears to hang rather than error. Every request
is waiting for a connection, none are timing out, the thread pool fills, and
health checks fail for reasons unrelated to the actual problem. A bimodal latency
histogram — most requests fast, a cluster at exactly the acquire timeout — is the
signature of pool exhaustion.

**Max connection lifetime** is subtler and matters specifically in autoscaled
environments. A pooled connection pins you to one server instance; without a
lifetime cap, a client that connected before a scale-out event keeps talking to
the old instances forever, and the new ones sit idle.

### Sizing the pool

The instinct is "bigger is safer". It is not: a pool larger than the downstream
can serve just moves the queue from your client into the server, where it is
harder to see and where it consumes the server's memory rather than yours.

Little's Law gives the starting point:

```text
  concurrency = throughput × latency

  1,000 req/s × 5 ms = 5 concurrent requests in flight

  → a pool of ~10 is right. A pool of 200 is not "headroom",
    it is permission to overload the callee.
```

Then size the *downstream's* capacity, and set the pool below it. A pool bounded
under the callee's capacity is a form of load shedding that protects both sides.

## Client-side load balancing

Two places the choice can be made, with real consequences.

```text
  PROXY (server-side)              CLIENT-SIDE

  client ──▶ [LB] ──┬──▶ server    client ──┬──▶ server
                    ├──▶ server      (knows ├──▶ server
                    └──▶ server      all of └──▶ server
                                     them)
  + client is simple                + one fewer network hop
  + one place to configure          + per-request balancing over HTTP/2
  + works with any client           + no shared bottleneck
  - extra hop of latency            - client must discover endpoints
  - the LB is a shared failure      - configuration lives in every client
```

The decision usually turns on HTTP/2. As noted earlier, an L4 proxy balances
*connections*, and HTTP/2 uses one long-lived connection — so all requests from
a client land on a single backend. Options: an L7 proxy that understands HTTP/2
framing and balances per request, a service mesh sidecar, or client-side
balancing where the client holds connections to all backends and picks per call.

The algorithms, in increasing order of how well they behave:

| Algorithm | Behaviour |
| --- | --- |
| Round robin | Ignores that requests differ in cost and servers differ in speed |
| Random | Same, but simpler and no shared counter |
| **Least outstanding requests** | Naturally avoids slow servers; the practical default |
| **Power of two choices** | Pick two at random, choose the less loaded — nearly as good, far cheaper |
| Consistent hashing | For cache affinity, when a key should reach the same node |

**Power of two choices** deserves the emphasis. Tracking global load across all
backends is expensive and races; sampling two at random and picking the better
one gets most of the benefit with none of the coordination. The result is a
dramatic reduction in maximum load compared with pure random, and it is why it
shows up in Nginx, Envoy and most modern balancers.

**Outlier detection** belongs with this: automatically eject a backend that is
returning errors or is much slower than its peers, then probe it periodically to
see whether it has recovered. It is a circuit breaker applied per endpoint rather
than per dependency, and it is what stops one bad instance degrading a
percentage of all requests.

## Health checks: the distinction that matters

Two different questions, and conflating them is a common production defect:

```text
  LIVENESS   "is this process functioning?"
             failure → RESTART it
             must NOT check dependencies

  READINESS  "can this instance serve traffic right now?"
             failure → remove from the load balancer, do not restart
             SHOULD check dependencies it cannot serve without
```

Putting a database check in the **liveness** probe is the classic mistake. The
database has a blip, every instance fails liveness, every instance restarts
simultaneously, the restarts hammer the database while it is already struggling,
and a five-second blip becomes a twenty-minute outage. Liveness answers "is this
process wedged", nothing more.

Readiness should also report *not ready* during startup — before caches are warm,
before the JIT has compiled anything, before connection pools are filled. A newly
started instance that is immediately given full traffic will serve it slowly and
may fall over, which is why slow-start ramping exists in serious load balancers.

## Distributed tracing

Without it, a request that touched eight services is eight unrelated log streams
whose timestamps disagree. With it, it is one waterfall.

```text
  trace 4bf92f3577b34da6 ────────────────────────────────── 177 ms

    gateway            ├──────────────────────────────────┤
      auth             │  ├───┤ 12 ms
      order-service    │      ├──────────────────────────┤ 155 ms
        db: SELECT     │        ├─┤ 8 ms
        product-svc    │           ├────────────────────┤ 140 ms  ◀── here
          db: SELECT ×70│          ├┤├┤├┤├┤├┤├┤├┤├┤...            N+1
      serialise        │                                  ├┤ 4 ms
```

The waterfall makes the N+1 visible in a way that no amount of log reading does.
This is the single highest-value observability investment in a service
architecture.

The mechanics are simple enough to implement by hand if you have to:

- A **trace ID** generated at the edge, propagated unchanged through every call.
- A **span ID** per operation, with the parent's span ID recorded, forming a
  tree.
- Propagation via the W3C `traceparent` header, which is now the standard and is
  what OpenTelemetry emits.

```text
  traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
               │  └──────────── trace id ─────────┘ └── span id ──┘ │
               version                                            flags
```

Three practical points that decide whether tracing is useful or merely present:

- **Propagate the trace ID everywhere, including into logs.** A trace ID field on
  every log line lets you pivot from a trace to the logs of any span, which is
  where the actual error message lives.
- **Sample, but sample intelligently.** 100% tracing is expensive at volume;
  head-based sampling at 1% will miss the errors you care about. **Tail-based
  sampling** — decide after the trace completes, keeping all errors and all slow
  traces plus a small percentage of normal ones — is what you want.
- **Propagate across async boundaries too.** A trace that stops at the queue
  boundary loses the half of the work you most need to see. Put the traceparent
  in the message headers.

## A defensible default client

Pulling this chapter and the timeouts chapter together:

```text
  connection pool     size from Little's Law, under the callee's capacity
                      acquire timeout ≤ 1 s   ← do not omit
                      max lifetime 5–30 min in autoscaled environments
  timeouts            ~2× dependency p99, propagated as a deadline
  retries             ≤3, transient errors only, full jitter, retry budget
  circuit breaker     per endpoint, with outlier ejection
  load balancing      least-outstanding or power-of-two-choices
  health checks       liveness without dependencies; readiness with them
  tracing             W3C traceparent, trace ID in every log line,
                      tail-based sampling
  metrics             per dependency: rate, errors, duration, pool saturation,
                      retry count, circuit state
```

Configure this **once, in a shared client library**, rather than per service.
Every service that configures its own HTTP client will get at least one of these
wrong, and the one it gets wrong will be different each time.

## What to take away

1. Connection pooling removes 2–3 round trips per call; the acquire timeout is
   the setting people omit, and its absence turns saturation into a hang.
2. Size pools from Little's Law and below the callee's capacity — an oversized
   pool moves the queue into the server where you cannot see it.
3. HTTP/2's single connection defeats L4 balancing; balance at L7 or in the
   client. Power-of-two-choices gets most of least-loaded's benefit for none of
   the coordination.
4. Liveness must not check dependencies, or a downstream blip restarts your whole
   fleet at once.
5. Distributed tracing turns eight log streams into one waterfall; propagate the
   trace ID into logs and across queue boundaries, and sample on the tail.
6. Put all of this in one shared client library, because per-service
   configuration will be wrong in a different way each time.

That completes RPC. Next in the track: **clocks, order and causality** — why two
machines cannot agree on what time it is, and what you use instead.
