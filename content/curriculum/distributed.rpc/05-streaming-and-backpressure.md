---
title: Streaming and backpressure
minutes: 20
summary: What changes when a call is not one request and one response, and why a fast producer is a hazard.
---

A unary call has a natural flow-control mechanism: the caller waits, so it
cannot get ahead of the callee. Streaming removes that, and the moment a
producer can outpace a consumer you have a new failure mode — one that shows up
as memory exhaustion rather than as an error, and therefore kills the process
rather than returning a 503.

## Why stream at all

Three reasons, and they are different:

**Unbounded results.** An endpoint returning "all orders for this account" has no
upper bound on response size. Unary means the server materialises the whole set
in memory, then the client does too. One large customer turns a working endpoint
into an OOM.

**Time to first byte.** A search that takes 3 seconds to complete can return its
first results in 50 ms. Streaming lets the user see something immediately, which
is a completely different perceived experience for the same total time.

```text
  UNARY                      STREAMING
  ─────                      ─────────
  [────── 3s ──────]▉        ▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉▉
  nothing, then all          first result at 50ms, rest arriving
```

**Continuous data.** Notifications, live updates, log tails, telemetry. There is
no "response" because the interaction does not end.

## The producer/consumer speed mismatch

The core problem, in one picture:

```text
  producer: 10,000 msg/s ──▶ [ buffer ] ──▶ consumer: 1,000 msg/s

  after 1 second:     9,000 messages buffered
  after 10 seconds:  90,000 messages buffered
  after 100 seconds: 900,000 messages buffered
                     ▲
                     memory grows without bound → OOM
```

An unbounded buffer converts a throughput mismatch into a crash. And it does so
*silently* — the metrics look fine, latency looks fine, and then the process
dies. The only way to avoid it is to make the mismatch visible and act on it,
which is what backpressure means.

## The four responses to a full buffer

There are exactly four things a system can do when the consumer cannot keep up.
Every real design picks one, explicitly or by accident.

```text
  1. BUFFER      keep accepting, store the excess
                 → bounded: fine. unbounded: OOM.

  2. DROP        discard messages
                 → correct for telemetry. catastrophic for orders.
                   (drop newest, or drop oldest — different semantics)

  3. BLOCK       stop the producer until there is room
                 → true backpressure. propagates upstream.

  4. FAIL        reject with an error
                 → load shedding. the caller decides what to do.
```

Choosing by accident means choosing 1-with-unbounded, because that is what
happens if you never think about it.

**Blocking is the one that composes**, because it propagates. If the consumer
slows, the buffer fills, the producer blocks, *its* upstream buffer fills, and
the pressure travels all the way back to the source — which might be a socket
whose TCP window closes, telling the remote sender to stop. The whole pipeline
slows to the rate of its slowest stage, and nothing accumulates anywhere.

```text
  source ◀── blocked ── stage A ◀── blocked ── stage B ◀── slow consumer
     │
     └─ TCP window closes; the remote sender stops sending

  the entire chain now runs at the consumer's rate. no buffer grows.
```

That is the property to aim for. A pipeline where every stage exerts
backpressure has a stable memory profile at any load; one where a single stage
buffers without bound has a memory profile that depends on the worst mismatch
that ever occurs.

## Flow control in the protocols you already use

Backpressure is not something you always have to build — several layers provide
it, and knowing which do is what tells you where the gap is.

**TCP** has a receive window. The receiver advertises how much buffer space it
has; the sender may not exceed it. If the application stops reading, the window
shrinks to zero and the sender stalls. This is real, automatic backpressure —
*provided your application actually stops reading*. Code that eagerly drains the
socket into an in-process queue has defeated it.

**HTTP/2 and gRPC** add per-stream and per-connection windows on top, because
many streams share one connection and one slow stream must not stall the others.
gRPC exposes this: a server streaming handler that writes faster than the client
reads will block on `Send`, which is the API telling you about backpressure.

**Reactive Streams** (RxJava, Project Reactor, and the JDK's `Flow`) make it
explicit in the API: the consumer *requests* n items, and the producer may not
send more than were requested. Pull-based rather than push-based, which is the
cleanest formulation of the idea.

```text
  PUSH (no backpressure)          PULL (backpressure built in)

  producer ──▶ ──▶ ──▶ consumer   producer ◀── request(10) ── consumer
  "here, take it"                 producer ──▶ 10 items ──▶
                                  producer ◀── request(10) ── consumer
```

**Message brokers** provide it by decoupling: the queue *is* the buffer, it is
durable and bounded by disk rather than RAM, and consumers pull at their own
rate. This is why "put a queue in front of it" works — it converts an
unbounded-memory problem into a bounded-disk problem, and gives you a visible
metric (queue depth) for the mismatch.

**Where the gap usually is:** application-level in-process queues. A
`Channel`, a `BlockingQueue`, an `asyncio.Queue` — created with no capacity
argument, defaulting to unbounded. This is the single most common place
backpressure is lost.

```python
queue = asyncio.Queue()              # UNBOUNDED. this is the bug.
queue = asyncio.Queue(maxsize=1000)  # put() now awaits when full
```

## Bounded queues and what to do at the boundary

Once a queue is bounded, filling it forces a decision. Make it explicitly:

```python
async def publish(event):
    try:
        queue.put_nowait(event)
    except asyncio.QueueFull:
        # THE decision. all four options are defensible; pick one on purpose.
        #
        # (a) await queue.put(event)   → block: backpressure to the caller
        # (b) drop_oldest(queue); queue.put_nowait(event)
        #                              → newest-wins, for live telemetry
        # (c) metrics.increment("dropped"); return
        #                              → drop newest, cheapest
        # (d) raise ServiceOverloaded  → shed, let the caller retry
        metrics.increment("queue_full")
        raise ServiceOverloaded()
```

The important part is not which branch you take — it is that the branch exists
and is instrumented. `queue_full` as a counter is one of the most useful
saturation signals a service can emit, because it fires *before* anything is
broken.

## Long-lived streams and their failure modes

A stream that lives for hours has problems a 50 ms request does not.

**They break, and the break can be silent.** A load balancer idle timeout, a NAT
table eviction, a mobile network handoff. The connection is gone but neither side
has been told, so both sit waiting. **Application-level heartbeats** are the
answer — a periodic ping in both directions, with a "no ping in N intervals →
declare it dead" rule. Do not rely on TCP keepalive; its default interval is
measured in hours.

**Reconnection needs to be a designed feature.** A stream that reconnects
immediately on failure creates a reconnection storm when a server restarts and
ten thousand clients notice simultaneously. The same three ingredients as retries
apply: exponential backoff, full jitter, a cap.

**Resumption requires a cursor.** After reconnecting, where do you resume? If the
client has no position token, it either replays everything (expensive, and
possibly duplicated) or misses whatever happened while disconnected.

```text
  client ──── subscribe(since: "evt-88213") ────▶ server
         ◀─── evt-88214, evt-88215, ...  ────────

  the client persists the last id it PROCESSED, not the last it received
```

Server-Sent Events builds this in with `Last-Event-ID`; Kafka has consumer
offsets; a bespoke stream needs the equivalent, and needs the server to retain
enough history to serve it.

**Stateful connections complicate deploys.** A rolling restart drops every
stream. With ten thousand connected clients, they all reconnect at once, which is
a self-inflicted thundering herd. Graceful shutdown that sends a "please
reconnect, with this jittered delay" message before closing is worth building
before you need it.

## Choosing a streaming transport

| Need | Choice | Note |
| --- | --- | --- |
| Server → browser, one-way | **Server-Sent Events** | HTTP, auto-reconnect, `Last-Event-ID` built in |
| Bidirectional, browser | **WebSocket** | You implement heartbeats and resumption yourself |
| Service → service | **gRPC streaming** | Flow control included |
| Durable, replayable, many consumers | **Kafka / log** | Not a connection — a stored log |
| Large file transfer | **Chunked HTTP + range requests** | Resumable without a stream |

SSE is consistently underrated. For "server pushes updates to a browser" — which
is most real-time needs — it is plain HTTP, works through every proxy, reconnects
automatically, and carries its own resumption mechanism. WebSocket is the right
answer only when the client genuinely needs to push at high frequency too.

## What to take away

1. Streaming removes the natural flow control of request/response, so a fast
   producer becomes a memory hazard rather than a latency problem.
2. There are exactly four responses to a full buffer — buffer, drop, block, fail
   — and not choosing means choosing unbounded buffering.
3. Blocking is the response that composes, because it propagates upstream until
   the whole pipeline runs at the consumer's rate.
4. TCP, HTTP/2 and Reactive Streams provide backpressure; unbounded in-process
   queues are where it is usually lost. Always pass a capacity.
5. `queue_full` is a saturation signal that fires before anything breaks —
   instrument it.
6. Long-lived streams need heartbeats, jittered reconnection and a resumption
   cursor, and the client should persist the last id it *processed*.

Next: the client side — pooling, load balancing, and the observability that makes
any of this debuggable.
