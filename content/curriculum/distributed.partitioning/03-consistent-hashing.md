---
title: Consistent hashing
minutes: 20
summary: Why `mod N` is a trap, the ring that fixes it, and the virtual nodes that make it work.
---

`hash(key) mod N` is the obvious way to assign keys to partitions, and it has one
catastrophic property: changing N remaps almost everything. Consistent hashing is
the standard fix, and it is worth understanding precisely because the naive
version of it is still noticeably bad.

## The problem with `mod N`

```text
  N = 4                          N = 5 (one node added)

  key "alice"  hash 1001         hash 1001
    1001 mod 4 = 1                 1001 mod 5 = 1    ✓ unchanged
  key "bob"    hash 1002
    1002 mod 4 = 2                 1002 mod 5 = 2    ✓ unchanged
  key "carol"  hash 1003
    1003 mod 4 = 3                 1003 mod 5 = 3    ✓ unchanged
  key "dave"   hash 1004
    1004 mod 4 = 0                 1004 mod 5 = 4    ✗ MOVED
  key "erin"   hash 1005
    1005 mod 4 = 1                 1005 mod 5 = 0    ✗ MOVED
```

In general, going from N to N+1 partitions relocates roughly **N/(N+1)** of all
keys — about 80% at N=4, about 99% at N=100. For a cache that means a near-total
miss storm; for a database it means moving nearly the whole dataset while serving
traffic.

The ideal is to move only `1/(N+1)` of keys — just the share the new node should
own. That is exactly what consistent hashing achieves.

## The ring

Map both keys and nodes onto the same circular hash space (say 0 to 2³²−1). A key
belongs to the first node encountered walking clockwise.

```text
                       0
                       │
              ┌────────┴────────┐
         ●B   │                 │
       ┌──────┤                 ├──── ●A
       │      │                 │
   k3 ─┤      │      RING       │      ├─ k1
       │      │                 │
       └──────┤                 ├──── ●C
         ●D   │                 │
              └────────┬────────┘
                       │
                     2³²-1

  each key walks CLOCKWISE to the next node:
     k1 → A        k3 → D
```

Now add a node E:

```text
              ●B                        ●B
       ┌──────┤                  ┌──────┤
   k3 ─┤      │              k3 ─┤      │      ●E ← inserted here
       │      │      ──▶         │      │      ╱
       └──────┤                  └──────┤    ╱
         ●D   │                    ●D   │  ╱

  ONLY the keys between D and E move — from A to E.
  Every other key keeps its node.
```

Adding a node steals a contiguous arc from exactly one successor. Removing a node
hands its arc to exactly one successor. Nothing else moves.

```text
  keys remapped when adding one node:

    mod N:              ~N/(N+1)  of all keys   (80–99%)
    consistent hashing:  ~1/(N+1) of all keys   (the minimum possible)
```

## Why the naive ring is not good enough

Randomly placed node positions do not divide a circle evenly. With few nodes, the
variance is large:

```text
  3 randomly placed nodes:

  ├──────────────────────────┼────┼──────────────┤
        A owns 55%            B 8%     C 37%

  A holds 55% of the data and takes 55% of the traffic.
```

With N randomly placed points, the largest arc is on average about `ln(N)/N` of
the circle rather than `1/N` — so at small N one node routinely owns two or three
times its fair share. And when a node fails, its **entire** load lands on one
successor, which is exactly the node most likely to fall over next.

## Virtual nodes

The fix: give each physical node many positions on the ring.

```text
  each physical node gets V virtual nodes (typically 100–500)

  hash("nodeA#0"), hash("nodeA#1"), ... hash("nodeA#255")

  ring with 3 physical nodes × 8 vnodes:

  ├─A─┼─C─┼─B─┼─A─┼─B─┼─C─┼─A─┼─C─┼─B─┼─A─┼─C─┼─B─┼─A─┼─B─┼─C─┼─A─┤

  each physical node owns MANY small arcs, so the totals even out
```

The improvement is dramatic. Load imbalance falls roughly as `1/√V`:

| Virtual nodes per physical node | Typical worst-node overload |
| --- | --- |
| 1 | 100%+ |
| 10 | ~30% |
| 100 | ~10% |
| 500 | ~5% |

And the second benefit is at least as important: when a node fails, its many
small arcs are inherited by **many different successors**, so the failed node's
load is spread across the cluster instead of doubling one neighbour's.

```text
  WITHOUT vnodes              WITH vnodes
  ──────────────              ───────────
  A fails → B takes ALL       A fails → its 256 arcs are inherited by
  of A's load                 B, C, D, E... each taking ~1/(N-1)
     │                           │
  B now at 2× load            everyone at ~1.05× load
  B falls over → cascade      no cascade
```

Vnodes also let you **weight** nodes: give a machine with twice the capacity
twice the virtual nodes, and it receives twice the data. Heterogeneous clusters
work naturally.

## Implementation

The whole thing is a sorted array and a binary search.

```python
import bisect, hashlib

class ConsistentHashRing:
    def __init__(self, vnodes=256):
        self.vnodes = vnodes
        self.ring = {}          # position -> physical node
        self.positions = []     # sorted positions, for bisect

    def _hash(self, key: str) -> int:
        return int.from_bytes(
            hashlib.blake2b(key.encode(), digest_size=8).digest(), "big"
        )

    def add_node(self, node: str):
        for i in range(self.vnodes):
            pos = self._hash(f"{node}#{i}")
            self.ring[pos] = node
            bisect.insort(self.positions, pos)

    def remove_node(self, node: str):
        for i in range(self.vnodes):
            pos = self._hash(f"{node}#{i}")
            del self.ring[pos]
            self.positions.remove(pos)

    def get_node(self, key: str) -> str:
        if not self.ring:
            raise LookupError("empty ring")
        pos = self._hash(key)
        # first position >= pos; wrap to 0 if past the end
        idx = bisect.bisect_left(self.positions, pos) % len(self.positions)
        return self.ring[self.positions[idx]]

    def get_nodes(self, key: str, count: int) -> list[str]:
        """The next `count` DISTINCT physical nodes — for replication."""
        if not self.ring:
            raise LookupError("empty ring")
        pos = self._hash(key)
        idx = bisect.bisect_left(self.positions, pos) % len(self.positions)
        found, seen = [], set()
        for offset in range(len(self.positions)):
            node = self.ring[self.positions[(idx + offset) % len(self.positions)]]
            if node not in seen:            # distinct PHYSICAL nodes, not vnodes
                seen.add(node)
                found.append(node)
                if len(found) == count:
                    break
        return found
```

Lookup is O(log(N × V)) — a binary search over the positions array.

**The `get_nodes` detail is where implementations get it wrong.** Replicas must
be distinct *physical* nodes; walking to the next three *virtual* nodes may land
on the same machine three times, giving you a replication factor of one while the
config says three. Worse, a correct implementation should also skip nodes in the
same rack or availability zone, or all three replicas can share a power supply.

## Rendezvous hashing: the simpler alternative

Also called highest-random-weight hashing. For each key, compute a score against
every node and pick the highest:

```python
def pick_node(key, nodes):
    return max(nodes, key=lambda n: hash_combine(key, n))
```

- **No ring, no virtual nodes, no data structure to maintain.**
- Distribution is naturally even, with no vnode tuning.
- Minimal disruption on membership change — same property as the ring.
- Extends to k replicas trivially: take the top k by score.
- Cost is O(N) per lookup rather than O(log N), so it is preferred when N is
  small (tens of nodes) and the ring wins at large N.

For most application-level uses — sharding a cache across 20 servers, picking a
worker for a job — rendezvous hashing is simpler and has fewer ways to be wrong.
It deserves to be better known than it is.

## Where you meet consistent hashing

- **Distributed caches** — memcached clients, Redis Cluster (which uses 16,384
  fixed hash slots, a discretised variant).
- **Dynamo-style databases** — Cassandra, Riak, DynamoDB.
- **Load balancers** — session affinity, and cache-friendly routing to a backend
  likely to have the object.
- **CDNs** — choosing which edge cache holds an object.
- **Sharded services** — routing a tenant to a worker fleet.

Redis Cluster's fixed-slot approach is worth noting as a design: rather than a
continuous ring, it defines 16,384 slots, maps keys to slots by CRC16, and maps
slots to nodes explicitly. This makes rebalancing a matter of *moving slots*,
which is easier to reason about, monitor and control than moving ring arcs — and
it is the same idea as the "fixed partitions" scheme in the next chapter.

## What to take away

1. `hash(key) mod N` remaps 80–99% of keys when N changes; consistent hashing
   remaps only the ~1/(N+1) that must move.
2. A ring with one position per node distributes badly and concentrates a failed
   node's entire load on one successor.
3. Virtual nodes (100–500 per physical node) cut imbalance to a few percent and
   spread a failure's load across the whole cluster.
4. Replica selection must walk to distinct *physical* nodes — and ideally
   distinct racks or zones — or the replication factor is a lie.
5. Rendezvous hashing gives the same properties with no ring to maintain, and is
   simpler for small N.
6. Redis Cluster's fixed slots are the discretised version, and make rebalancing
   an explicit, controllable operation.

Next: hot keys and skew — the failure that no hashing scheme fixes.
