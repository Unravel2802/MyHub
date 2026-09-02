---
title: Multi-leader replication
minutes: 20
summary: Writing in several places at once, the conflicts it guarantees, and when it is worth it.
---

Single-leader replication has one structural weakness: the leader is a single
point for writes. If it is in Virginia, users in Singapore pay 200 ms per write,
and if the Virginia region is partitioned, nobody writes anywhere. Multi-leader
replication removes that by letting several nodes accept writes — and creates the
one problem single-leader made impossible.

## The shape

```text
        REGION: us-east                  REGION: eu-west
      ┌──────────────────┐             ┌──────────────────┐
      │   leader (US)    │◀───────────▶│   leader (EU)    │
      │        │         │  async      │        │         │
      │     follower     │  bi-directional      follower  │
      └──────────────────┘             └──────────────────┘
              ▲                                 ▲
        US users write                   EU users write
        locally: 2ms                     locally: 2ms
```

Within a region it is ordinary single-leader replication. Between regions, each
leader is also a follower of the other. Local writes are fast, and each region
survives the other being unreachable.

## When it is worth it

**Multi-datacentre for write latency and regional independence.** The canonical
case, and the one above.

**Offline-capable clients.** Every phone with a local database is a leader. The
app writes locally with no network, and syncs when connectivity returns. Calendar
apps, note-taking apps, and anything with an offline mode are multi-leader
systems whether their authors think of them that way or not.

**Collaborative editing.** Every browser holds a replica and writes to it
immediately — otherwise every keystroke would cost a round trip. Google Docs is
multi-leader.

**What is usually not worth it:** multi-leader within a single region for write
throughput. You take on conflict resolution and get very little, because a single
leader in one region is not usually the bottleneck. Partitioning is the right
answer to write throughput; multi-leader is the answer to *geography*.

## Conflicts are guaranteed, not possible

```text
  t=0    US: set title = "Q3 Report"
  t=0    EU: set title = "Q3 Results"
         (both accepted locally, both acknowledged)

  t=200ms  replication crosses

  US now has two values for the same field. So does EU.
  Nobody was wrong. Both writes were legitimately accepted.
```

Single-leader makes this impossible by construction: the second write to arrive
at the leader sees the first. Multi-leader gives that up, permanently.

And unlike most distributed-systems problems, **you cannot defer this one**.
Every field of every record needs an answer to "what if two regions set this
simultaneously?", and the answer is a product decision as much as a technical
one.

## The strategies, in order of preference

**1. Avoid conflicts entirely.** By far the best option where the domain allows
it: route all writes for a given entity to one designated home region.

```text
  user 7c3f's home region = eu-west
     → every write for that user goes to eu-west, wherever they are
     → within one user, it is effectively single-leader
     → conflicts are impossible for that user's data
```

This is how most successful multi-region systems actually work. It gives local
writes for the majority of users (who stay in one region) and eliminates
conflicts. The costs: a user who travels writes cross-region, and the home region
must be *moved* if they relocate, which is a real migration.

**2. Converge to a deterministic value.**

- **Last-write-wins by timestamp.** Simple, and depends on clocks you now know
  are unreliable. It loses data silently.
- **Highest replica ID wins.** Deterministic and utterly arbitrary, but at least
  it does not depend on clocks.
- **Merge the values.** "Q3 Report / Q3 Results" — rarely acceptable, but
  occasionally right for sets and lists.

**3. Preserve both and let the application decide.** Store both versions and
surface the conflict — either to code with a merge function, or to a human.

```text
  CouchDB keeps both revisions and marks the document conflicted.
  Git does this: a merge conflict is preserved for a human,
  and everyone accepts that as correct behaviour.
```

**4. CRDTs.** Choose data types whose merge is mathematically guaranteed to
converge regardless of order — covered later in the track. This is the strongest
option where your data fits the available types, and it is why collaborative
editors use them.

## What is genuinely hard: constraints

Convergence handles a field with two values. It does not handle **invariants
across records**, and this is where multi-leader stops being a merge problem.

```text
  UNIQUENESS
    US: register username "alice"      ✓ unique in US
    EU: register username "alice"      ✓ unique in EU
    → converge: two users named alice. no merge fixes this.

  BALANCE >= 0
    account has $100
    US: withdraw $80   ✓ leaves $20
    EU: withdraw $80   ✓ leaves $20
    → converge: -$60. the invariant was violated by construction.

  BOOKING A SEAT
    US: seat 14A → Alice
    EU: seat 14A → Bob
    → converge: one of them arrives to find someone in their seat.
```

None of these can be fixed by a better merge function, because the conflict is
not about a value — it is that a *global* invariant needed checking and no node
had a global view. The only real options:

- **Route those operations to a single leader.** Usernames and seat bookings go
  to one place, even in an otherwise multi-leader system. Usually correct.
- **Partition the resource in advance.** Give each region its own block of seats
  or its own ID range. Works when the resource divides cleanly.
- **Accept and compensate.** Allow the overdraft, detect it in reconciliation,
  and charge a fee or reverse a transaction. This is what banks actually do, and
  it is a legitimate engineering answer rather than a failure.

The general principle: **multi-leader is fine for data, and bad for
constraints.** A design that is multi-leader everywhere except a small set of
operations that need a single point of decision is a good design; one that
pretends the constraints will work out is not.

## Topologies and their failure modes

```text
  ALL-TO-ALL              CIRCULAR              STAR

   A ──── B                A → B                    A
   │ ╲  ╱ │                ↑   ↓                 ↙  ↓  ↘
   │  ╲╱  │                D ← C                B   C   D
   │  ╱╲  │
   C ──── D

  n(n-1)/2 links          n links               n-1 links
  resilient               one node down         hub is a single
  message ordering        breaks the ring       point of failure
  problems
```

All-to-all is the most resilient and has a subtle problem: a write can arrive at
a node by two different paths with different delays, so a later write may arrive
before an earlier one it depends on. Version vectors are the fix — the same
mechanism from the clocks topic, used here to detect that a write's causal
predecessor has not arrived yet and to hold it until it does.

Circular and star topologies need explicit handling for a node failure, and both
require loop prevention: each node tags the write with its own ID, and drops any
write already carrying its tag.

## Operating one

The honest picture of what you take on:

- **Conflict rate as a monitored metric.** If it climbs, something in the routing
  is wrong. If it is zero, you may not have needed multi-leader.
- **Replication lag per link**, in both directions. Asymmetric lag is normal and
  informative.
- **Schema changes are much harder.** A migration must be safe with both old and
  new schemas running in different regions, replicating to each other, for as
  long as the rollout takes.
- **Auto-increment keys break.** Every region must generate IDs independently —
  UUIDv7, or per-region ranges. This is a design decision you cannot retrofit
  cheaply.
- **Debugging is genuinely harder.** "Which region wrote this, and what did the
  other one know at the time?" needs the metadata to have been recorded.

## What to take away

1. Multi-leader is for geography — local write latency and regional independence
   — not for write throughput within one region, where partitioning is the
   answer.
2. Conflicts are guaranteed, not possible, and every field needs an answer to
   "what if two regions set this at once?".
3. The best strategy is avoidance: give each entity a home region so its writes
   are effectively single-leader.
4. Convergence handles conflicting *values*; it cannot handle *constraints* like
   uniqueness or a non-negative balance, because no node has a global view.
5. Route constraint-bearing operations to a single leader, partition the resource
   in advance, or accept and reconcile — those are the only options.
6. You take on independent ID generation, harder migrations, and per-link lag
   monitoring. Budget for it before choosing this.

Next: leaderless replication — no leader at all, and quorums instead.
