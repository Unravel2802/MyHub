---
title: Rebalancing and request routing
minutes: 20
summary: Moving partitions without downtime, and how a request finds the node holding its key.
---

Two operational problems follow from partitioning: when the cluster changes size,
data must move; and at every moment, a request must find the node currently
holding its key. Both have standard answers, and the standard answers are worth
knowing because the ad-hoc ones fail in characteristic ways.

## Rebalancing strategies

### Never: hash mod N

Already covered, and worth restating as a rule. Changing N remaps almost
everything. The only situation where it is acceptable is a cache you are willing
to cold-start entirely.

### Fixed partition count

Create far more partitions than nodes at the start, and assign whole partitions
to nodes. Growing the cluster moves partitions, never keys.

```text
  1,000 partitions, 4 nodes → 250 partitions each

  ┌───────────┬───────────┬───────────┬───────────┐
  │ node 1    │ node 2    │ node 3    │ node 4    │
  │ P1–P250   │ P251–P500 │ P501–P750 │ P751–P1000│
  └───────────┴───────────┴───────────┴───────────┘

  add node 5:  each existing node gives up 50 partitions

  ┌────────┬────────┬────────┬────────┬────────┐
  │ node 1 │ node 2 │ node 3 │ node 4 │ node 5 │
  │  200   │  200   │  200   │  200   │  200   │
  └────────┴────────┴────────┴────────┴────────┘

  a key NEVER changes partition. only partitions change node.
```

This is the dominant design — Kafka topics, Elasticsearch shards, Redis Cluster's
16,384 slots, Riak's vnodes. Its virtues: rebalancing is a coarse, controllable
operation you can throttle and monitor; the key-to-partition mapping is stable
forever; and a partition is a unit you can name in a runbook.

The one thing to get right is **choosing the count at creation**, because it is
usually fixed for the life of the cluster:

```text
  too FEW   → cannot spread across a larger cluster later;
              each partition is huge and slow to move
  too MANY  → per-partition overhead (memory, file handles, metadata)
              dominates; thousands of tiny partitions per node

  rule of thumb: 10–100 partitions per node at your projected
                 maximum cluster size
```

Kafka is the concrete case people meet: partition count per topic can be
increased but never decreased, and increasing it **changes the key-to-partition
mapping** for hash-partitioned keys, breaking per-key ordering across the change.
That makes it effectively a one-way decision to be made with a few years of
growth in mind.

### Dynamic partitioning

Partitions split when they grow past a threshold and merge when they shrink —
like a B-tree node.

```text
  partition [A–M] exceeds 10 GB
       │
       ▼  split at the median key
  [A–F]  [G–M]        one may move to another node
```

Used by HBase, Bigtable, CockroachDB, MongoDB. The advantage is that partition
count adapts to data volume with no capacity planning, and skewed key
distributions are handled automatically — a dense range simply splits more.

Two costs: an empty cluster starts with one partition and therefore no
parallelism until it splits (hence "pre-splitting" on load), and splits are extra
operational events that can happen at inconvenient moments.

### Proportional to nodes

A fixed number of partitions **per node**; adding a node splits some existing
partitions to give it a share. Cassandra's vnodes work this way. It keeps
partitions a roughly constant size as the cluster grows.

## Moving a partition without downtime

The mechanics, and every system does approximately this:

```text
  1. START     new node begins following the partition's leader,
               streaming a snapshot then the ongoing changes
                  ↑ the old node is still serving everything

  2. CATCH UP  new node replays until its lag is near zero
                  ↑ this is the long part — hours for a large partition

  3. HANDOVER  brief pause on writes for this partition;
               new node confirms it is fully caught up;
               routing is switched
                  ↑ measured in milliseconds

  4. CLEANUP   old node drops its copy, after a delay
                  ↑ the delay is your rollback window
```

The properties that matter operationally:

- **Throttle it.** Rebalancing competes with production traffic for disk and
  network. An unthrottled rebalance is itself an incident — this is the most
  common way a "safe" capacity addition takes a system down.
- **Rebalance one partition at a time**, or a small bounded number. Moving
  everything at once maximises the damage.
- **Never fully automate the trigger.** A node that appears dead — a network blip,
  a long GC pause — triggers a rebalance, the rebalance loads the remaining
  nodes, they slow down, more nodes appear dead, and the cluster tears itself
  apart moving data it did not need to move. **Automate the mechanism, keep a
  human on the trigger**, or at minimum require a long confirmation window and a
  concurrency limit.

That last point is the single most valuable operational lesson in this chapter.
The failure mode has a name — a rebalance storm — and it has taken down large
clusters.

## Request routing: three designs

Every request must reach the node holding its key. There are exactly three
places to put that knowledge.

```text
  1. ROUTING TIER              2. CLIENT-SIDE            3. ANY NODE FORWARDS

  client                       client                     client
    │                            │ (knows the map)          │
    ▼                            ▼                          ▼
  ┌────────┐                   ┌───┬───┬───┐             ┌───┬───┬───┐
  │ router │                   │ N │ N │ N │             │ N │ N │ N │
  └───┬────┘                   └───┴───┴───┘             └─┬─┴───┴───┘
   ┌──┴──┬──────┐                                          └─▶ forwards
   ▼     ▼      ▼                                             to the owner
  ┌───┐┌───┐┌───┐
  │ N ││ N ││ N │
  └───┘└───┘└───┘

  + simple clients               + no extra hop               + simple clients
  + one place to update          + lowest latency             + no extra tier
  - an extra hop                 - every client needs         - an extra internal
  - a tier to run                  the map, in every            hop
                                   language
```

Design 2 is what Kafka and Cassandra do — clients fetch cluster metadata and
route themselves, refreshing when they receive a "not the owner" error. Design 3
is Redis Cluster's model, where any node can redirect you with a `MOVED` reply.
Design 1 is what most database proxies and service meshes do.

The choice usually comes down to **how many client languages you must support**.
A smart client is per-language work; a routing tier is written once.

## Who holds the truth about the mapping

Whichever routing design you pick, the partition map itself must be consistent,
or two components will disagree about who owns a key — and during a rebalance
that means writes going to the old owner while reads go to the new one.

The standard answer is a **coordination service**: ZooKeeper, etcd, or Consul,
which are themselves consensus systems (the subject of a later topic).

```text
  ┌────────────────────────────────────────┐
  │  etcd / ZooKeeper                      │
  │    partition 1 → node A (leader)       │  ← the authoritative map
  │    partition 2 → node B (leader)       │
  └────────────────┬───────────────────────┘
                   │ watch for changes
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     router     client     node
```

Consumers *watch* for changes rather than polling, so a rebalance propagates in
milliseconds. Some systems avoid the external dependency by embedding consensus —
Kafka's KRaft replaced its ZooKeeper dependency with an internal Raft quorum, and
CockroachDB stores its own range metadata in itself.

## Handling the moment of change

Routing information is always slightly stale, so nodes must handle requests for
partitions they no longer own:

```text
  client (stale map) ──▶ node A: "read key K"
                    ◀── "MOVED 1234 node-b:6379"
  client updates its map, retries against B
```

Three requirements for this to be correct:

1. **The owner rejects, it does not serve.** A node that no longer owns a
   partition must refuse rather than answer from stale local data. Answering is
   how you serve data from a partition someone else has since written to.
2. **Redirects are bounded.** A redirect loop between two nodes that disagree is
   possible during a rebalance; clients must cap the number of hops and then
   refresh their map from the authoritative source.
3. **In-flight requests drain.** The old owner should finish requests it has
   already accepted before dropping the partition — otherwise the handover
   window produces a burst of errors rather than a brief pause.

## What to take away

1. Fixed partition count — many more partitions than nodes, assigned wholesale —
   is the dominant design because rebalancing moves partitions, never keys.
2. Choose that count for your projected maximum cluster size (10–100 per node);
   in Kafka it is effectively a one-way decision that changes key mapping if
   raised.
3. Dynamic splitting adapts to data volume and skew automatically, at the cost of
   no parallelism until the first splits.
4. Moving a partition is stream, catch up, brief handover, delayed cleanup —
   throttled, and a small number at a time.
5. Automate the rebalance mechanism, not the trigger: automatic rebalancing on
   suspected node failure causes rebalance storms.
6. Routing lives in a tier, in the client, or in every node; the partition map
   must come from one authoritative, watchable source, and stale clients must be
   redirected rather than served.

That completes partitioning. Next in the track: **consistency models** — naming
precisely what guarantees a replicated, partitioned system can actually offer.
