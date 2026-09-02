---
title: Failure detection
minutes: 19
summary: Deciding a node is dead when you cannot tell dead from slow, and the properties that decision must have.
---

Every distributed system needs an answer to "which nodes are alive?" — and as the
fundamentals topic established, that question is unanswerable. You can only
observe silence, and silence is produced equally by a crashed node, a slow node,
and a working node behind a broken network link. A failure detector is a
deliberate, tunable guess.

## The two properties, and the trade between them

```text
  COMPLETENESS   every crashed node is eventually suspected
                 → you notice failures
                 → maximised by aggressive timeouts

  ACCURACY       a correct node is not wrongly suspected
                 → you do not evict healthy nodes
                 → maximised by conservative timeouts
```

You cannot have both perfectly in an asynchronous network. Every design chooses a
point on the line, and the choice should follow from **what happens on a false
positive**:

```text
  false positive is CHEAP                false positive is EXPENSIVE
  ────────────────────────               ──────────────────────────
  remove from a load balancer            trigger a leader failover
  (a healthy node returns in seconds,    (data loss, warm-up cost,
   cost: brief capacity loss)             possible split brain)

  → be AGGRESSIVE                        → be CONSERVATIVE
```

This is why a load balancer's health check runs every few seconds while a Raft
election timeout is tens of seconds. They are the same mechanism with different
consequences for being wrong, so they get different tunings — and copying one's
timeout to the other is a common mistake.

## Heartbeats

The basic mechanism, in two directions:

```text
  PUSH                              PULL

  node ──heartbeat──▶ monitor       monitor ──probe──▶ node
                                            ◀─reply──

  + the node knows it is alive      + the monitor knows the network
  + the monitor does nothing          path works in both directions
  - a wedged process may keep       + detects a node that stopped
    a heartbeat thread running        serving but not heartbeating
                                    - probe load ∝ nodes × monitors
```

The push weakness is the one that matters: a **heartbeat thread that survives
while the work does not** is a very common gray failure. A process with an
exhausted thread pool, a blocked event loop, or a deadlocked request path will
happily keep heartbeating.

The mitigation is to make the heartbeat **depend on the resources real work
depends on** — touch the connection pool, allocate from the same heap, run on the
same executor as request handling. A heartbeat from a dedicated healthy thread
proves nothing about the service.

## The fixed-timeout problem

```text
  timeout = 5 seconds

  normal RTT:  10 ms      → 500× headroom, very late detection
  RTT spike:   6 s        → false positive on a healthy node
```

A fixed timeout is wrong in both directions because network conditions vary by
orders of magnitude between environments and over time. A value tuned in a data
centre is wrong across regions; one tuned at 3am is wrong at peak.

**Adaptive timeouts** derived from observed round trips are the minimum
improvement:

```text
  timeout = mean(RTT) + k × stddev(RTT)
```

This is precisely how TCP computes its retransmission timeout, and the same
reasoning applies: the network tells you what normal looks like, so let it.

## Phi-accrual failure detection

The refinement worth knowing, and it changes the interface rather than the
tuning.

A traditional detector outputs a boolean: alive or dead. A phi-accrual detector
outputs a **suspicion level** — a number that rises the longer silence
continues, computed from the *distribution* of past heartbeat intervals.

```text
  φ = -log10(probability that a heartbeat this late is normal,
             given the observed distribution)

  φ = 1   →  ~10% chance we are wrong to suspect
  φ = 2   →  ~1%
  φ = 3   →  ~0.1%
  φ = 8   →  ~0.000001%
```

```text
  φ
  │                                        ╱
  │                                     ╱
  │  φ=8 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─╱─ ─ ─  failover threshold
  │                             ╱
  │  φ=3 ─ ─ ─ ─ ─ ─ ─ ─ ─ ╱─ ─ ─ ─ ─ ─ ─  stop routing threshold
  │                    ╱
  │  ______________╱
  └──────────────────────────────────────▶ time since last heartbeat
```

Two properties make this better than a timeout:

**It adapts automatically.** On a network with high variance, a late heartbeat is
normal, so φ rises slowly. On a very consistent network, the same delay is highly
abnormal and φ rises fast. No tuning per environment.

**Different consumers can choose different thresholds** from one detector. Stop
routing new requests at φ=3; trigger an expensive failover at φ=8. The detector
does not have to pick one answer for everybody, which is exactly the problem the
boolean interface creates.

Cassandra and Akka both use this, and it is worth reaching for whenever a system
has several consumers of "is this node alive" with different costs of being
wrong.

## Indirect probing

A single monitor's view is unreliable — the monitor's own network path may be the
broken thing.

```text
  A cannot reach B.

  DIRECT:   A declares B dead.
            → if A's link is the problem, A evicts a healthy node

  INDIRECT: A asks C and D: "can you reach B?"
            C: yes.  D: yes.
            → B is fine; A's own path is broken
```

This single change eliminates the most common class of false positive, and it
also **diagnoses the problem**: if several nodes cannot reach B, B is down; if
only A cannot, A is the problem. That is information a direct detector cannot
produce.

It is the core of the SWIM protocol, covered in the gossip chapter.

## Suspicion, not a binary

The refinement that follows from indirect probing: rather than moving a node
straight from alive to dead, add an intermediate state.

```text
  ALIVE ──▶ SUSPECT ──▶ DEAD
              │
              └── the node can REFUTE the suspicion by
                  responding, returning to ALIVE

  during SUSPECT:
    stop sending it new work
    do NOT trigger an expensive failover yet
    give it a bounded time to refute
```

The refutation path is what makes this valuable. A node that was merely paused
gets to say "I am here" and rejoin without the cluster having paid for a
failover, a rebalance and a warm-up.

## Choosing timeouts

The procedure, since the answer is always "it depends":

```text
  1. MEASURE the actual heartbeat/RTT distribution, p50 to p99.9.
  2. Decide the COST of a false positive for this consumer.
  3. Pick a threshold at a percentile matching that cost:
       cheap  ──▶ p99      (frequent detection, occasional error)
       costly ──▶ p99.99   (rare detection, rare error)
  4. Add indirect probing to remove single-observer errors.
  5. Add a suspicion state with a refutation window.
  6. MONITOR the false-positive rate — how often a suspected node
     comes back healthy. Rising means retune.
```

Step 6 is the feedback loop almost nobody builds, and it is what keeps the
configuration honest as the system changes. A false-positive rate that climbs
after a migration tells you the network characteristics changed before anything
breaks.

## The failure mode to fear

Aggressive detection under load is a metastable failure generator, exactly as
described in the resilience topic:

```text
  load rises → nodes respond slowly → detector declares them dead
       → their work moves to remaining nodes → those nodes slow down
       → declared dead → ... → the cluster evicts itself
```

The defences:

```text
  □  a cap on how many nodes may be suspected at once
     ("if >30% look dead, the problem is probably us")
  □  hysteresis: slow to declare dead, fast to accept a refutation
  □  back off detection aggressiveness under high load
```

The first is the same panic-threshold idea as the load balancer's minimum-healthy
rule, and for the same reason: **when most of the fleet looks broken, the
detector is more likely wrong than the fleet.**

## What to take away

1. Completeness and accuracy trade against each other; choose the point from the
   *cost of a false positive* for that specific consumer.
2. Push heartbeats can survive a wedged process — make the heartbeat depend on
   the resources real work uses.
3. Fixed timeouts are wrong in both directions; derive them from the observed RTT
   distribution, as TCP does.
4. Phi-accrual outputs a suspicion level rather than a boolean, adapts to network
   variance automatically, and lets different consumers pick different thresholds.
5. Indirect probing removes single-observer false positives and distinguishes "B
   is down" from "my link is down".
6. Cap how many nodes can be suspected at once — when most of the fleet looks
   dead, the detector is more likely wrong than the fleet.

Next: gossip — spreading membership information without a central authority.
