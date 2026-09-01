---
title: Why distribute, and what it costs
minutes: 20
summary: The four reasons to use more than one machine, and the guarantees you give up to do it.
---

A distributed system is one where a machine you have never heard of can break
the thing you are working on. That is Leslie Lamport's joke, and it is also a
precise definition: the defining property is not that there are many computers,
it is that they fail **independently** and communicate over a link that can lose,
delay, duplicate and reorder messages.

Everything in this track follows from that one sentence. Before any of it, the
question worth being ruthless about is whether you should be distributing at
all.

## What a single machine can actually do

Engineers routinely underestimate this by an order of magnitude, and then build a
cluster to handle a load one server would have absorbed.

| Resource | A single commodity server, 2026 |
| --- | --- |
| Cores | 64–192 |
| RAM | 256 GB – 2 TB |
| NVMe capacity | 10–100 TB |
| NVMe random reads | 500k–1M IOPS |
| Network | 25–100 Gbps |
| Postgres, well-indexed | 20k–50k simple queries/sec |
| Nginx, static content | 100k+ requests/sec |

A single Postgres instance on that hardware comfortably serves a product with
hundreds of thousands of daily users. StackOverflow famously ran its entire
question-and-answer site on nine web servers and one primary SQL Server for
years, at a time when it was in the world's top 100 sites.

The point is not that scaling out is wrong. It is that **"we need to scale"
should be a measurement, not a vibe.** Distribution has a price, paid in full and
up front, and the four reasons below are the only ones that justify it.

## The four legitimate reasons

**1. The workload does not fit.** More data than one machine can store, or more
throughput than one machine can serve. This is the honest scaling reason, and it
arrives later than most people expect.

**2. Availability.** One machine has a maximum availability set by its hardware
and its maintenance window. If it must be patched, it goes down. Redundancy —
multiple machines that can serve the same request — is the only way past that.

**3. Geography.** A round trip from Sydney to Virginia is ~200 ms no matter what
you buy, because it is bounded by the speed of light in fibre. Serving users on
another continent means having something on that continent.

**4. Isolation.** Separating workloads so one cannot take down another: a batch
job that must not starve the request path, a tenant that must not affect
another, a blast radius you want to bound.

Notice what is *not* on the list. "Microservices are the modern architecture" is
not a reason. "The team is growing" is an organisational reason that may justify
separate *deployables*, but a modular monolith gives you separate codebases with
none of the distributed cost — which is what this application itself is.

## What you give up

The moment there are two machines, several properties you had for free stop
being free.

```text
  SINGLE PROCESS                    DISTRIBUTED

  a function call either            a request may succeed, fail,
  returns or throws                 or NEITHER — you may never find out

  memory is consistent              two nodes can hold different values
  across the whole program          for the same thing, both "correct"

  a shared clock                    every node has its own clock,
                                    and they disagree

  a crash takes everything          a crash takes SOME things,
  down together                     while the rest keeps running
                                    on stale assumptions

  debugging is a stack trace        debugging is correlating logs
                                    across 8 services and 3 clocks
```

The third column of that table — **partial failure** — is the one with no
analogue in single-process programming, and it is where almost all the
difficulty lives. Chapter 3 is entirely about it.

## The cost, concretely

A useful way to feel the price is to trace one operation before and after.

```text
  MONOLITH: place an order

    check inventory      in-process call      ~0.001 ms
    reserve stock        in-process call      ~0.001 ms
    charge card          external API          ~200 ms
    write order          one SQL transaction    ~2 ms
                                              ─────────
    one transaction. it commits or it doesn't.


  SERVICES: place an order

    check inventory      RPC to inventory       ~2 ms  (may time out)
    reserve stock        RPC to inventory       ~2 ms  (may time out)
    charge card          RPC to payments        ~205 ms (may time out)
    write order          RPC to orders          ~3 ms  (may time out)
                                               ─────────
    four operations, four ways to half-succeed.
    NO transaction spans them.
```

In the monolith, "charge succeeded but the order was not written" cannot happen:
one database transaction covers both. In the service version it happens
routinely, and you now need a saga, or an outbox, or a reconciliation job, or
all three. That is not a failure of the architecture — it is the bill for
choosing it, and it is a real bill:

- **Latency goes up, not down.** Every hop adds a network round trip, and
  serialisation on both ends.
- **Availability goes down by default.** Five services each at 99.9%, all
  required for a request, gives 99.5% — about four hours of downtime a month
  instead of forty minutes. Redundancy is what buys it back, and redundancy is
  additional machines.
- **You need infrastructure you did not need before.** Service discovery,
  distributed tracing, centralised logging, a deployment pipeline per service,
  contract testing between them.
- **Debugging changes shape.** A stack trace becomes a trace ID and eight log
  streams whose timestamps do not agree.

## The availability arithmetic

Worth internalising, because it is counter-intuitive in both directions.

**Services in series** (all must work): multiply.

```text
  0.999 ^ 5 = 0.995     → 99.5%, ~3.6 hours down per month
```

**Replicas in parallel** (any one suffices): multiply the *failure* rates.

```text
  1 - (0.001 ^ 3) = 0.999999999   → three independent replicas
```

The catch is in the word **independent**. Three replicas in one rack share a
power supply and a top-of-rack switch. Three replicas in one availability zone
share a data centre. Three replicas running the same buggy version share the
bug. Correlated failure is what actually takes systems down, and it is exactly
what this arithmetic assumes away.

This is why real designs spread replicas across failure domains — different
racks, zones, regions — and why staged rollouts exist: a deploy is a correlated
failure waiting to happen, so you expose it to 1% of traffic first.

## The eight-fallacy preview

In 1994 Peter Deutsch, later joined by James Gosling, wrote down the assumptions
engineers new to distributed systems make and then have to unlearn:

1. The network is reliable
2. Latency is zero
3. Bandwidth is infinite
4. The network is secure
5. Topology doesn't change
6. There is one administrator
7. Transport cost is zero
8. The network is homogeneous

They are more than thirty years old and still exactly right, which is why the
next chapter goes through each one with the failure it produces. If you take one
thing from this chapter into that one, make it this: **every one of those
fallacies is a statement that is true inside a single process and false between
two.** Distributed systems are hard mostly because our intuitions were trained
somewhere the rules are different.

## When not to distribute

A short list of things to do before adding a machine, roughly in order of how
often they turn out to be the actual answer:

1. **Add an index.** An enormous share of "we need to scale the database" is a
   sequential scan.
2. **Cache.** The read path is usually 10–100× the write path.
3. **Buy a bigger machine.** Doubling a server is a credit-card transaction;
   sharding is a quarter of engineering time and a permanent complexity tax.
4. **Separate reads from writes.** A read replica is far less invasive than a
   partitioned system, and answers most read scaling.
5. **Move the batch work off the request path.** A queue and a worker is the
   cheapest possible "distributed system", and often the only one you need.

Then measure again. The right time to distribute is when you have evidence that
one machine cannot do it — and when you have decided which of the four reasons
above applies, because the reason determines the design.

## What to take away

1. A distributed system is defined by independent failure and an unreliable
   link, not by machine count.
2. A single modern server is far more capable than intuition suggests; "we need
   to scale" should be a measurement.
3. The only good reasons to distribute are capacity, availability, geography and
   isolation. Organisational structure justifies separate deployables, not
   necessarily separate processes.
4. Services in series multiply their availability downward; replicas in parallel
   multiply failure downward — but only if failures are independent, which
   correlated failures make untrue.
5. The one thing with no single-process analogue is partial failure, and it is
   the source of most of the difficulty ahead.

Next: the eight fallacies in detail, and the specific bug each one produces.
