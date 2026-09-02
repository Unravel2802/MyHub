---
title: The node lifecycle in operation
minutes: 18
summary: Bootstrap, scale, drain and replace — the sequences where clusters actually break.
---

Membership theory is short; the operational sequences built on it are where
clusters lose data. This chapter is the lifecycle as a set of procedures, with
the specific step in each that gets skipped.

## The states

```text
  ┌─────────┐   join    ┌──────────┐  caught up  ┌────────┐
  │ UNKNOWN │─────────▶│ JOINING  │────────────▶│ ACTIVE │
  └─────────┘           │(learner) │              └───┬────┘
                        └──────────┘                  │
                                                      │ drain
       ┌──────────┐    unreachable                    ▼
       │ SUSPECT  │◀───────────────────────────  ┌─────────┐
       └────┬─────┘                              │ LEAVING │
            │ refuted → ACTIVE                   └────┬────┘
            │ timeout                                 │
            ▼                                         ▼
       ┌────────┐                                ┌─────────┐
       │  DEAD  │───────── remove ──────────────▶│ REMOVED │
       └────────┘                                └─────────┘
```

Two states earn their place. **JOINING** exists so a node that cannot yet
contribute is not counted as one that can. **SUSPECT** exists so a pause does not
cost a failover — and it is refutable, so a node can recover from being wrongly
suspected.

## Bootstrap: the empty-cluster problem

The one genuinely tricky sequence, because there is no cluster to ask.

```text
  every node starts and finds nobody.
  if each forms its own single-node cluster, you now have N
  clusters that will never merge — each believes it is complete.
```

The two safe approaches:

```text
  EXPECTED SIZE (bootstrap-expect)
    nodes wait until N of them have found each other,
    THEN form one cluster together
    → Consul's model. safe, requires knowing N.

  DESIGNATED INITIATOR
    exactly one node is told "you are the first"; everyone
    else joins an existing cluster
    → simple, and the initiator must genuinely be unique
```

```text
  the anti-pattern:  each node forms a cluster if it cannot find one
                     within T seconds
  → a network blip during startup gives you two clusters,
    both healthy, permanently split
```

Bootstrap is also where an automation mistake is most expensive: re-running the
bootstrap step against an existing cluster can create a second one or wipe state.
Bootstrap flags should be single-use and removed after the first successful
formation.

## Scaling up

```text
  1. provision, and give it seeds
  2. join as a LEARNER — not a voter
  3. stream state / replay the log
  4. warm caches and connection pools
  5. verify it is current (lag below a threshold, not merely "started")
  6. promote to voter
  7. only now, rebalance data onto it
  8. only now, give it traffic — with slow start
```

Steps 5 and 8 are the ones skipped. A node promoted before it is current raises
the quorum without helping; a node given full traffic while cold is slow, looks
overloaded, and may be ejected — the autoscaling-on-cold-starts loop from the
resilience topic.

**Add one at a time** for voting members. Adding three at once to a three-node
cluster changes the quorum from 2 to 4 in one step, and if the new nodes are not
ready the cluster stalls.

## Scaling down and draining

```text
  1. mark the node UNREADY / ineligible for new work
  2. WAIT for the load balancer and clients to notice
        ← the step everyone skips
  3. finish in-flight requests
  4. transfer any leadership it holds, deliberately
  5. re-replicate its data elsewhere and confirm the replication
     factor is restored
  6. remove from membership (through consensus)
  7. terminate
```

Step 2 has appeared in three chapters now — deregistration, health checking, and
here — because it is the most consistently skipped step in operations and it is
the direct cause of errors during every deploy and scale-down.

Step 5 is the one that loses data. Removing a node before its data is
re-replicated reduces the replication factor silently, and the next failure is the
one that loses the last copy. Verify restoration; do not assume it.

## Rolling restarts

The most frequent operation, and the one where the ordering discipline matters:

```text
  □  ONE node at a time (or a bounded batch)
  □  WAIT for full health before the next — not "the pod is
     Running", but "it has rejoined, caught up, and lag is zero"
  □  restart the LEADER LAST, or transfer leadership away first
     → otherwise you trigger an election you did not need
  □  abort the whole rollout if the cluster degrades
  □  never restart faster than the cluster can re-replicate
```

That last line is the one that turns a routine restart into an incident: a
rolling restart that moves faster than re-replication steadily erodes the
replication factor, and by the fifth node there may be data with only one copy.
The rollout must be gated on restored redundancy, not on a timer.

## Replacing a failed node

```text
  the decision that matters first:

  DID IT LOSE DURABLE STATE?
    ├─ NO  ──▶ it may rejoin under the SAME identity and catch up
    │          from where it left off
    │
    └─ YES ──▶ it must join as a NEW identity, and the old one
               must be removed from membership
```

Getting this wrong is the amnesia problem: a node with a fresh disk rejoining
under its old identity can vote twice in a term, or be counted as holding data it
does not have.

The corollary: **automation must know which case it is in.** A replacement
instance with a new empty volume is case two even though its hostname may be
identical, and a StatefulSet that reattaches the original volume is case one.
Identity should be tied to the *data*, not to the hostname.

## Detecting a split cluster

Two halves that both think they are complete is the failure to watch for
explicitly, because each half looks healthy from inside:

```text
  □  alert when a node's view of cluster SIZE differs from the
     expected size
  □  alert when two nodes report different member lists
  □  alert on more than one leader for the same shard
     (a query across nodes, not a per-node metric)
  □  monitor cross-node clock skew — it precedes lease problems
```

Every one of these requires comparing *across* nodes. A per-node dashboard cannot
see a split, because each side is individually fine — which is exactly why splits
are discovered late.

## The runbook

```text
  □  how to add a node, and how to verify it is genuinely ready
  □  how to remove a node safely, including the re-replication check
  □  how to replace a node that lost its disk
  □  how to recover from losing a majority permanently
     (which discards writes the survivors did not have — know
      the procedure BEFORE you need it)
  □  how to detect and resolve a split cluster
  □  how to roll back a bad membership change
```

The majority-loss procedure is the one to write down while calm. It involves
forcing a new cluster from surviving data and accepting data loss, and it is not
something to read for the first time during an incident.

## What to take away

1. JOINING and SUSPECT exist so that a node which cannot contribute is not
   counted, and a paused node does not cost a failover.
2. Bootstrap must use an expected size or a designated initiator — "form a cluster
   if you cannot find one" gives you two permanent clusters after a startup blip.
3. Promote a joining node only when it is genuinely current, add voters one at a
   time, and give traffic with slow start.
4. When removing a node, wait for propagation before closing, and verify
   re-replication before termination — removing early silently reduces the
   replication factor.
5. Gate rolling restarts on restored redundancy rather than a timer, and restart
   the leader last.
6. Identity must be tied to durable data, not to hostname: a node with a fresh
   disk is a new member.

Next: the operational consequences of all of this at scale.
