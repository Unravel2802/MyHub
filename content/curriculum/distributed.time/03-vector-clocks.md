---
title: Vector clocks
minutes: 20
summary: Detecting concurrency exactly, what it costs, and why most systems settle for less.
---

A Lamport clock tells you that `a` might have caused `b`. A vector clock tells
you whether it did, whether it did not, or whether the two are genuinely
concurrent — the distinction you need to detect a conflict rather than silently
paper over one. The price is that the clock is no longer one integer.

## The structure

Each node keeps a **vector**: one counter per node in the system.

```text
  node A's clock:  { A: 3, B: 1, C: 0 }
                     ▲     ▲     ▲
                     │     │     └─ A has seen 0 of C's events
                     │     └─────── A has seen 1 of B's events
                     └───────────── A has performed 3 events
```

The vector is a summary of everything this node knows about: "my own progress,
plus how much of everyone else's progress I have learned about."

The rules mirror Lamport's:

```text
  1. before a local event:      V[self] += 1

  2. when sending:              attach a copy of V

  3. when receiving V':         V[i] = max(V[i], V'[i])  for every i
                                V[self] += 1
```

```python
def local_event(V, me):
    V[me] += 1

def send(V):
    return dict(V)                      # attach a copy

def receive(V, V_msg, me):
    for node, t in V_msg.items():
        V[node] = max(V.get(node, 0), t)
    V[me] += 1
```

## Comparing two vectors

This is where the extra information pays off. Given vectors `V` and `W`:

```text
  V < W   (V happened before W)
     if V[i] <= W[i] for EVERY i,  and V[i] < W[i] for at least one i

  V > W   symmetric

  V ‖ W   (CONCURRENT)
     if neither of the above holds —
     i.e. V is ahead somewhere and W is ahead somewhere else
```

That third case is the entire point, and Lamport clocks cannot express it.

```text
  V = {A:2, B:1, C:0}     W = {A:1, B:3, C:0}

  A: 2 > 1   ← V is ahead here
  B: 1 < 3   ← W is ahead here

  neither dominates → V ‖ W → CONCURRENT
```

Concretely: `V` knows about two of A's events; `W` knows about only one, so `W`
cannot have been influenced by A's second event. Symmetrically `V` has not seen
B's later events. Neither could have known about the other. That is a **conflict**
— two writes made without knowledge of each other — and now you know it happened.

## Worked example

```text
        A                    B                    C
        │                    │                    │
  a1 ●  {A:1,B:0,C:0}        │                    │
        │──────msg──────────▶│                    │
        │              b1 ●  {A:1,B:1,C:0}        │
        │                    │──────msg──────────▶│
        │                    │              c1 ●  {A:1,B:1,C:1}
  a2 ●  {A:2,B:0,C:0}        │                    │
        │                    │                    │

  compare a2 {A:2,B:0,C:0} with c1 {A:1,B:1,C:1}:

     A: 2 > 1     a2 ahead
     B: 0 < 1     c1 ahead
     → CONCURRENT

  and indeed: a2 happened on A without A ever hearing from B or C,
  and c1 happened without C hearing about a2.
```

Note that this conclusion is drawn with **no clocks and no communication at
comparison time**. Two nodes handed these two vectors reach the same answer
independently.

## Where this is used: siblings in Dynamo-style stores

Amazon's Dynamo paper made vector clocks famous. A key can have several
concurrent versions — **siblings** — and the store returns all of them rather
than picking one:

```text
  client writes cart = [milk]      → version {A:1}
  network partition
    client on A writes [milk, eggs]   → {A:2}
    client on B writes [milk, bread]  → {A:1, B:1}
  partition heals

  {A:2} vs {A:1,B:1}:  A ahead on A, B ahead on B → CONCURRENT

  the store returns BOTH to the client:
    "here are two versions, you decide"
```

Riak exposes this directly. Amazon's original shopping cart resolved siblings by
**merging** — union the items — which is why the famous behaviour of items
reappearing in a Dynamo-era cart after being deleted happens: a delete is the
absence of an item, and a union of "has milk" and "does not have milk" is "has
milk". Adds win over removes. That is a *semantic* choice the application makes,
and it is only possible because the store surfaced the conflict instead of
discarding one side.

Compare with last-write-wins: LWW would have silently kept one cart and thrown
the other away, and the user would lose whatever they added on the wrong side of
the partition. Detecting the conflict is what gives the application the chance to
do something better.

## The cost

**Size.** The vector has an entry per node that has ever written. With 5
replicas, trivial. With one entry per *client* — which some designs need, since
clients are the actors making concurrent writes — a popular key accumulates
thousands of entries, and the metadata dwarfs the value.

Mitigations, all imperfect:

- **Only servers get entries**, not clients. Bounds the size to the replica
  count, at the cost of not distinguishing two clients writing through the same
  replica.
- **Prune old entries** with a timestamp per entry, dropping the oldest when the
  vector exceeds a size cap. This can produce false "concurrent" verdicts —
  safe, in that it over-reports conflicts rather than missing them.
- **Dotted version vectors**, used by modern Riak, which represent the same
  information more compactly for the common case.

**Operational complexity.** Every client must be prepared to receive several
versions and merge them. That is real application work, and the reason many teams
choose LWW despite knowing it loses writes: the conflict-resolution code is a
cost paid on every read path, forever.

## The comparison, one more time

| | Lamport | Vector | Version vector (per replica) |
| --- | --- | --- | --- |
| Size | O(1) | O(nodes) | O(replicas) |
| `a → b` detectable | yes | yes | yes |
| **Concurrency detectable** | **no** | **yes** | yes |
| Total order available | yes (+node id) | no (partial only) | no |
| Used by | Kafka offsets, WAL LSNs | Dynamo, Riak, Voldemort | Riak, CRDT frameworks |

The row that decides it is the bolded one. Everything else is consequence.

## Matrix clocks, briefly

One further step: a matrix clock is a vector of vectors — node i's view of node
j's view of node k. It answers "does everyone know about event e?", which is what
you need to safely **garbage-collect** old state: once every node knows about an
update, no node can still need the history before it.

The cost is O(n²) metadata, so it is rare in practice, but it is worth knowing
the shape because the question it answers — "is it safe to forget this?" — comes
up whenever you try to bound the growth of any of these structures.

## When to reach for which

```text
  Do concurrent writes to the same key happen?
   │
   ├─ NO (single writer, or writes are partitioned by key)
   │      ──▶ a simple version counter is enough
   │
   └─ YES
       │
       ├─ Can the application merge conflicting versions meaningfully?
       │    (sets, counters, carts, collaborative documents)
       │      ──▶ VECTOR CLOCKS, surface siblings, merge in the app
       │          or use a CRDT, which encodes the merge in the data type
       │
       └─ Is losing one of two concurrent writes acceptable?
              ──▶ last-write-wins, and be honest in the design doc
                  that this loses data under concurrency
```

The honesty in that last branch matters. LWW is a legitimate choice — for
caches, for sensor readings where newest genuinely wins, for user preferences.
It is not legitimate to choose it *without noticing* that it discards writes,
which is what happens when a team picks a store with LWW defaults and never asks
the question.

## What to take away

1. A vector clock is one counter per node, and comparison of two vectors yields
   before, after, or **concurrent** — the case a Lamport clock cannot express.
2. Concurrency is detected when each vector is ahead of the other on some entry;
   this needs no communication and no clock at comparison time.
3. Dynamo-style stores use this to return siblings, letting the application merge
   — which is how a cart can union items rather than losing half of them.
4. The cost is metadata that grows with the number of writers, plus
   conflict-resolution code on every read path.
5. Last-write-wins is a legitimate choice for some data, but it silently discards
   one of two concurrent writes — make it a decision, not a default.

Next: the hybrid clocks that try to get the best of physical and logical time,
including how Spanner turns clock uncertainty into a guarantee.
