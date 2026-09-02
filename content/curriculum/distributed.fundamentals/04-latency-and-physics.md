---
title: Latency, bandwidth and physics
minutes: 19
summary: The numbers worth memorising, which of them are improvable, and which are the speed of light.
---

Some latency is an engineering problem you can fix. Some of it is the speed of
light and will still be there in fifty years. Knowing which is which stops you
from optimising something that cannot move, and stops you from accepting
something that can.

## The numbers

Jeff Dean's "latency numbers every programmer should know", updated for 2026
hardware. Memorise the orders of magnitude, not the digits.

| Operation | Time | Relative |
| --- | --- | --- |
| L1 cache reference | 1 ns | 1× |
| Branch mispredict | 3 ns | 3× |
| L2 cache reference | 4 ns | 4× |
| Mutex lock/unlock | 17 ns | 17× |
| Main memory reference | 80 ns | 80× |
| Compress 1 KB (zstd) | 2 µs | 2,000× |
| Send 1 KB over 10 Gbps | 800 ns | 800× |
| NVMe random read | 20 µs | 20,000× |
| Round trip, same data centre | 300 µs | 300,000× |
| Read 1 MB sequentially from NVMe | 100 µs | 100,000× |
| Round trip, same region (cross-AZ) | 1 ms | 1,000,000× |
| Round trip, cross-continent | 70–200 ms | ~10⁸× |
| Disk seek (spinning rust) | 5 ms | 5,000,000× |

The scaled-up version is easier to hold. If an L1 reference were one second:

```text
  L1 cache            1 second
  main memory         1.5 minutes
  NVMe read           5.5 hours
  same-DC round trip  3.5 days
  cross-AZ            11 days
  cross-continent     2–6 years
```

The gap between "the same machine" and "another continent" is the gap between a
second and half a decade. Architectural decisions are decisions about which of
these rows a request has to visit, and how many times.

## What the speed of light actually costs

Light travels 300,000 km/s in vacuum, and about **200,000 km/s in fibre** —
roughly two-thirds, because of the refractive index of glass. That gives 5 µs
per kilometre, one way.

```text
  New York ⇄ London          5,600 km   →  56 ms round trip minimum
  New York ⇄ San Francisco   4,100 km   →  41 ms round trip minimum
  London   ⇄ Singapore      10,800 km   → 108 ms round trip minimum
  Sydney   ⇄ Virginia       16,000 km   → 160 ms round trip minimum
```

And fibre does not run along great circles. Real routes are 1.3–2× the straight
line, plus switching and routing delay at every hop, so measured latency is
typically **1.5–2× the theoretical floor**. Sydney to Virginia measures around
200 ms.

**This is not improvable.** No amount of money buys a faster photon. Hollow-core
fibre gets you closer to c and is deployed on a few high-frequency-trading
routes; it is not going to change your architecture.

The consequences are structural:

- **A cross-continent round trip is a user-perceptible delay.** Three sequential
  ones is 600 ms and feels broken.
- **Therefore: put data near users** (CDNs, edge caches, regional replicas), and
  **reduce the number of round trips** rather than the cost of each.
- **Therefore: strongly consistent global writes are expensive by physics.** A
  system that requires a quorum across three continents pays 100+ ms per write,
  forever. That is the real cost behind the consistency trade-offs you will meet
  later — it is not an implementation detail of any particular database.

## Round trips are the unit that matters

For anything over a WAN, count round trips, not bytes. A naive HTTPS request to
a cold connection:

```text
  DNS lookup                   1 RTT   (0 if cached)
  TCP handshake (SYN/SYN-ACK)  1 RTT
  TLS 1.3 handshake            1 RTT   (0 with session resumption)
  HTTP request/response        1 RTT
                              ───────
                               4 RTT × 70 ms = 280 ms before a byte of content
```

This is why every one of these exists:

- **Connection reuse / keep-alive** — amortises the handshakes over many
  requests. The single highest-value thing you can do for a chatty client.
- **TLS 1.3** — cut the handshake from two round trips to one; 0-RTT resumption
  removes it entirely for repeat visits (at the cost of replay risk on
  non-idempotent requests).
- **HTTP/2 multiplexing** — many concurrent requests over one connection,
  removing head-of-line blocking at the HTTP layer.
- **QUIC / HTTP/3** — combines transport and crypto handshakes into one round
  trip, and removes TCP's head-of-line blocking on packet loss, which matters
  enormously on mobile networks.
- **CDNs** — terminate the connection close to the user, so the handshakes cross
  a short distance and only cache misses cross the ocean.

## Bandwidth versus latency

They are different resources and improve independently. Bandwidth has grown
roughly a thousandfold in twenty years; latency has improved by maybe a factor
of two, because it is bounded by distance.

The practical rule: **bandwidth is a throughput problem, latency is a
responsiveness problem, and you cannot trade one for the other in the direction
you want.** Sending 10 MB over a 10 Gbps link takes 8 ms of transfer — but if it
needs 40 round trips of coordination first, you spent 2.8 seconds on latency to
save nothing.

This is why bulk transfer and interactive requests want different designs:

```text
  interactive:  minimise ROUND TRIPS.  batch, pipeline, cache, colocate.
  bulk:         minimise BYTES.        compress, columnar formats, deltas.
```

And why "just compress it" sometimes makes things slower — at 10 Gbps within a
data centre, compressing 1 KB costs 2 µs of CPU to save 800 ns of transfer.
Compression pays over the WAN and loses over the rack.

## Bandwidth-delay product

The amount of data in flight on a link at any moment:

```text
  BDP = bandwidth × round-trip time

  1 Gbps × 1 ms   (same region)     =   125 KB
  1 Gbps × 100 ms (cross-continent) = 12.5 MB
```

If your TCP window or application-level buffer is smaller than the BDP, the
sender stalls waiting for acknowledgements and **you cannot use the bandwidth
you are paying for**. A 64 KB window on a 100 ms link caps throughput at about
5 Mbps regardless of the link being a gigabit.

This is why bulk transfer over long distances needs window scaling (on by
default in modern stacks), larger application buffers, or parallel streams —
and why a single-stream copy across the world is so often mysteriously slow.

## Queueing: where latency actually comes from

At low utilisation, latency is transmission plus propagation. As utilisation
rises, queueing dominates, and it does so **non-linearly**:

```text
  latency
     │                                    │
     │                                    │  ← the wall
     │                                  ╱
     │                               ╱
     │                          ╱
     │                   ╱
     │    ─────────╱
     └────────────────────────────────────
      0%      50%      80%   90%  95% 100%
                 utilisation
```

For an M/M/1 queue, waiting time scales as `1/(1 - ρ)` where ρ is utilisation.
At 50% utilisation you wait 1× the service time; at 90% you wait 9×; at 99% you
wait 99×. Concretely:

| Utilisation | Latency multiplier |
| --- | --- |
| 50% | 2× |
| 80% | 5× |
| 90% | 10× |
| 95% | 20× |
| 99% | 100× |

**This is why you do not run systems at high utilisation.** A server at 90% CPU
is not "efficiently used", it is one traffic bump from a latency cliff. It is
also why adding a small amount of capacity to an overloaded system can produce a
dramatic latency improvement — you are moving back down a steep curve, not a
linear one.

Two corollaries worth carrying:

- **Variability makes it worse.** The formula above assumes a particular
  arrival distribution; bursty traffic queues far worse than smooth traffic at
  the same average. This is what rate limiting and load levelling (a queue in
  front of a service) are actually for.
- **Utilisation targets should be around 60–70%** for latency-sensitive
  services, leaving headroom for bursts, failover load and deploys.

## Where a request's time actually goes

Before optimising, measure the breakdown. A typical uninstrumented API request:

```text
  ├─ DNS + TCP + TLS ..................  0 ms   (connection reused)
  ├─ network to gateway ...............  5 ms
  ├─ auth check (cache miss) .......... 12 ms
  ├─ business logic ...................  3 ms
  ├─ database query #1 ................  8 ms
  ├─ database query #2 (N+1!) ........ 140 ms   ← 70 queries × 2 ms
  ├─ serialise response ...............  4 ms
  └─ network back .....................  5 ms
                                       ───────
                                        177 ms
```

The business logic is 1.7% of it. This is the normal shape, and it is why
profiling before optimising matters so much here: the instinct to make the code
faster is almost always aimed at the wrong row.

Distributed tracing exists to produce exactly this breakdown across services.
Without it you are guessing, and the guess will be wrong in the same direction
every time.

## What to take away

1. Memorise the orders of magnitude: ~1 ns in cache, ~100 ns in RAM, ~100 µs on
   NVMe, ~1 ms cross-AZ, ~100 ms cross-continent.
2. Cross-continent latency is the speed of light in glass plus routing overhead.
   It is not improvable, so put data near users and cut round trips.
3. Over a WAN, count round trips rather than bytes. Connection reuse is the
   cheapest large win available.
4. Bandwidth and latency are separate resources; the bandwidth-delay product
   determines whether you can use the bandwidth you have.
5. Queueing delay scales as 1/(1−ρ). At 90% utilisation you wait ten times the
   service time, which is why 60–70% is the target for latency-sensitive
   services.
6. Measure the breakdown before optimising; the business logic is rarely the row
   that matters.

Next: what to do with those numbers — choosing timeouts, retrying safely, and
the retry storms that take systems down.
