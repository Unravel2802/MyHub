---
title: Membership at scale
minutes: 17
summary: What changes at a thousand nodes, and the failure modes that only appear there.
---

Membership protocols that work comfortably at ten nodes behave differently at a
thousand, and differently again at ten thousand. The changes are not gradual —
they are specific thresholds where an assumption stops holding.

## What breaks as n grows

```text
  ALL-TO-ALL HEARTBEATS      O(n²) messages
    n=10    →     90 messages per interval
    n=100   →  9,900
    n=1000  →  999,000        ← the network is now membership traffic

  → gossip (O(n) total, O(1) per node) is not an optimisation
    at this scale, it is a requirement

  CONSENSUS-BASED MEMBERSHIP  every change is a log entry
    a 1,000-node cluster has constant churn: deploys,
    autoscaling, spot reclamation
    → the membership Raft group becomes the bottleneck

  → separate the layers: a small consensus group owns the
    authoritative view; gossip carries liveness for everyone

  FAILURE DETECTION           with 1,000 nodes at 99.9% uptime,
                              ~1 node is down at any moment
    → "something is always broken" is the steady state,
      not an incident
```

That last line is the important mental shift. At small scale, a failed node is an
event you respond to. At large scale it is background noise, and the system must
handle it without human involvement — which means every procedure in the previous
chapter has to be automated, and the automation has to be safe.

## The hierarchy that restores scaling

```text
              ┌─────────────────┐
              │ consensus group │  3–5 nodes
              │ authoritative   │  the member list, shard map
              │ view            │
              └────────┬────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐    ┌─────────┐    ┌─────────┐
   │ zone A  │    │ zone B  │    │ zone C  │   gossip WITHIN a zone
   │ 300 nodes│   │ 300     │    │ 300     │   a few nodes gossip
   └─────────┘    └─────────┘    └─────────┘   BETWEEN zones
```

Two properties this buys:

**Gossip traffic stays local.** Most gossip is within a zone, where bandwidth is
cheap and latency is low. Cross-zone gossip is a small number of links, which
matters because cross-zone traffic is billed on most clouds — and membership
chatter across zones is a surprisingly common line item.

**Convergence stays fast.** log(300) within a zone plus a hop between zones beats
log(900) over a flat topology with expensive links.

## Churn

At scale the cluster is never static:

```text
  1,000 nodes, average lifetime 7 days
    → ~143 replacements per day
    → one membership change every 10 minutes, forever
```

Add autoscaling, spot reclamation and deploys, and changes are constant. Two
consequences:

**Membership changes must be cheap.** If adding a node triggers a full rebalance,
you are rebalancing continuously and never converging. This is why fixed partition
counts with wholesale assignment (from the partitioning topic) matter so much at
scale — a membership change moves partition *assignments*, not data layout.

**Rebalancing must be rate-limited and, crucially, not triggered automatically on
suspicion.** The rebalance storm from the partitioning chapter is a large-scale
failure specifically: a brief network problem makes many nodes look dead, an
automatic rebalance moves enormous amounts of data, the movement saturates the
network, more nodes look dead, and the cluster tears itself apart.

```text
  automate the MECHANISM. gate the TRIGGER on:
    □  a delay long enough to distinguish a blip from a failure
    □  a cap on concurrent movements
    □  a cap on the FRACTION of the cluster in motion
    □  a circuit breaker: if more than X% look dead, do nothing
       and page a human
```

## Metadata size

Each member carries metadata — address, zone, version, health, capacity, tokens.

```text
  1,000 nodes × 1 KB of metadata = 1 MB of state
  gossiped continuously, merged on every exchange

  → keep per-node metadata SMALL
  → gossip DIGESTS (hashes) and fetch details only on mismatch
  → do not put application state in the membership layer
```

That last point is a real and recurring mistake: using the membership gossip as a
convenient broadcast channel for application data. It grows the state everyone
must exchange, slows convergence for the thing membership actually exists for,
and couples application changes to cluster stability.

## What to monitor

```text
  □  cluster size, per node's view      ← disagreement means a split
  □  members in each state              (joining/active/suspect/dead)
  □  membership change rate             ← churn; a spike means trouble
  □  gossip convergence time            ← measure with a synthetic
                                          value propagated end to end
  □  suspicion and false-positive rate  ← how often a suspected node
                                          returns healthy
  □  cross-node clock skew              ← precedes lease failures
  □  data movement in progress          ← rebalance load
```

The two that catch problems early:

**Disagreement in cluster size across nodes** is the only reliable signal of a
split, and it requires a cross-node comparison rather than a per-node metric.

**False-positive rate** is the feedback loop on your failure detector's tuning. A
climbing rate after an infrastructure change means the network characteristics
moved and the thresholds should follow, and you learn it before it causes an
eviction cascade.

## Multi-region membership

```text
  ONE GLOBAL CLUSTER                REGIONAL CLUSTERS + FEDERATION

  every node in one membership       each region is its own cluster;
  ┌──────────────────────────┐       a thin layer knows about the others
  │  us-east ⇄ eu-west ⇄ ap  │
  └──────────────────────────┘       ┌────────┐  ┌────────┐  ┌────────┐
                                     │ us-east│  │ eu-west│  │  ap    │
  - cross-region gossip is slow      └───┬────┘  └───┬────┘  └───┬────┘
    and expensive                        └──── federation ───────┘
  - a WAN blip looks like mass
    failure                            + failures are contained
  - quorums span continents            + local quorums, local latency
    (100 ms+ per decision)             - cross-region ops are explicit
```

**Regional clusters with federation is almost always right.** One global
membership means a transatlantic network problem is a cluster-wide membership
event, and every quorum decision pays a cross-continent round trip. The federated
design keeps failures and latency regional, at the cost of making cross-region
operations something you write deliberately — which is the honest representation
of what they cost anyway.

This is the same conclusion as the consensus topic's advice to run many small
groups rather than one large one, applied one level up.

## The recurring theme

Across this whole topic, one principle keeps producing the right answer:

```text
  SEPARATE what must be AGREED from what may merely be OBSERVED.

    observed  →  liveness, reachability, load, metadata
                 gossip. cheap, scalable, always available.

    agreed    →  membership, shard assignment, leadership
                 consensus. expensive, small, authoritative.
```

Systems that gossip everything get split brain. Systems that reach consensus on
everything do not scale. The ones that work put a small consensus group in charge
of the decisions and let gossip carry everything else.

## What to take away

1. All-to-all heartbeating is O(n²) and untenable past a few hundred nodes;
   gossip's constant per-node load is a requirement rather than an optimisation.
2. At a thousand nodes something is always broken — that is the steady state, and
   every lifecycle procedure must be automated and safe.
3. Hierarchical gossip keeps traffic within zones, which matters for both
   convergence and cross-zone bandwidth cost.
4. Constant churn means membership changes must be cheap; automate the rebalance
   mechanism but gate the trigger with delays, concurrency caps and a
   fraction-of-cluster circuit breaker.
5. Monitor cluster size *per node's view* to detect splits, and the
   false-positive rate as the feedback loop on detector tuning.
6. Prefer regional clusters with federation to one global membership, and separate
   what must be agreed (consensus) from what may be observed (gossip).

That completes membership and failure detection. Next in the track:
**collaborative editing with OT and CRDTs** — letting many writers change the same
data with no lock at all.
