---
title: Failover
minutes: 21
summary: The part of replication that loses data, and the fencing that stops two leaders writing.
---

Replication is easy while everything works. Failover — promoting a follower when
the leader dies — is where the data loss and the corruption live, and it is the
part most systems get wrong in a way that is only discovered during an incident.

## The four steps, and what goes wrong at each

```text
  1. DETECT     the leader is dead
                 ↳ but you cannot distinguish dead from slow

  2. ELECT      choose a new leader
                 ↳ but the nodes may not agree on the choice

  3. PROMOTE    the chosen follower starts accepting writes
                 ↳ but it may be missing writes the old leader had

  4. REDIRECT   clients and other followers point at the new leader
                 ↳ but some may keep talking to the old one
```

Every one of those "but" clauses is a real failure that has taken down real
systems.

## Step 1: detection, and the trade you cannot avoid

You cannot tell a crashed leader from a slow one, or from one on the far side of
a network partition. So detection is a timeout, and the timeout is a trade:

```text
  AGGRESSIVE (5s)                    CONSERVATIVE (60s)
  ─────────────────                  ──────────────────
  fast recovery from real failures   60s of write unavailability
  spurious failovers on a GC pause   for every genuine failure
  or a brief network blip
       ↓                                    ↓
  each failover risks data loss      but no unnecessary failovers
  and a split brain window
```

There is no correct value, only a stated preference. Most managed databases sit
around 10–30 seconds, and the important discipline is making the number
deliberate and testing what happens at both ends.

Two refinements that genuinely help:

- **Require multiple observers to agree.** A single monitor that loses network
  connectivity will declare a healthy leader dead. Requiring a quorum of
  observers to concur removes the most common false positive.
- **Distinguish "unreachable from here" from "down".** If the followers can still
  see the leader but the monitor cannot, the monitor is the broken component.

## Step 3: the data loss

This is the step people underestimate. With **asynchronous** replication, the
leader acknowledged writes that no follower had received.

```text
  leader has:    ...  W1  W2  W3  W4  W5     ← all acknowledged to clients
  follower has:  ...  W1  W2  W3             ← lag of 2 writes

  leader dies. follower promoted.

  W4 and W5 are GONE.
  the clients that wrote them were told "success".
```

At 1,000 writes/second and 100 ms of lag, a failover discards roughly 100
acknowledged writes. There is no mechanism that recovers them, because they
existed only on the failed machine.

And it gets worse when the old leader comes back:

```text
  old leader returns, still holding W4, W5
  new leader has since accepted W4', W5' from clients

  ┌───────────────────────────────────────────────────┐
  │  old:  W1 W2 W3 W4  W5                            │
  │  new:  W1 W2 W3 W4' W5' W6'                       │
  │                  ▲                                │
  │        DIVERGENT from here. W4 and W4' may have   │
  │        the same primary key with different values │
  └───────────────────────────────────────────────────┘
```

The old leader's extra writes must be discarded, and if they used an
auto-increment sequence they may collide with the new leader's. GitHub's
well-documented 2012 outage was exactly this shape: a failover, a returning old
primary, and rows with conflicting IDs.

The standard tooling response is `pg_rewind` (Postgres) or an equivalent that
rewinds the returning node to the divergence point and re-syncs from there. The
writes are still lost — the tool just prevents the divergence becoming permanent.

**The only real prevention is not acknowledging writes that only one node has.**
Semi-synchronous replication — ack once a follower has it — trades write latency
for the guarantee that a promotable follower holds every acknowledged write.

## Step 4: split brain, and fencing

The worst failure. Two nodes both believe they are the leader, both accept
writes, and the data diverges irreconcilably.

```text
  ┌──────────────┐        ╳ partition ╳       ┌──────────────┐
  │  old leader  │                            │  new leader  │
  │  still up,   │                            │  promoted    │
  │  still writing│                           │  by the other│
  │              │                            │  side        │
  └──────┬───────┘                            └──────┬───────┘
         │                                           │
    clients on                                  clients on
    this side                                   that side
         │                                           │
         └──── both sets of writes are "committed" ──┘
                    and they conflict
```

Detection is not the answer, because the old leader has no way to know it has
been replaced — from its perspective, the followers just stopped responding.

**Fencing** is the answer: make it *impossible* for the old leader to do damage
even if it still believes it is leader.

**Fencing tokens** — the general software mechanism. Every leadership term gets a
monotonically increasing number, and the *storage layer* rejects writes carrying
an old token.

```text
  leader term 5 ──▶ storage: "write, token=5"    ✓ accepted
                              (storage records highest seen = 5)

  new leader term 6 ──▶ storage: "write, token=6" ✓ accepted, highest = 6

  old leader term 5 ──▶ storage: "write, token=5" ✗ REJECTED
                              5 < 6, this node is stale
```

The critical property: the check lives in the resource being protected, not in
the leaders. The old leader does not need to know anything. This is the same
mechanism that makes distributed locks safe, and it is why a lock without a
fencing token is not actually a lock — a paused-then-resumed holder will happily
write after its lease expired.

**STONITH** ("shoot the other node in the head") — the hardware version.
Forcibly power off or network-isolate the old leader before promoting. Decisive,
and standard in traditional HA clustering.

**Quorum-based leadership** — the modern answer. A leader must hold a lease from
a majority of nodes and must renew it; a minority partition cannot elect
anything and the old leader's lease expires on its own. This is what Raft-based
systems do, and why they are so much easier to operate correctly.

## Automatic or manual?

A genuinely contested question with a defensible answer on each side.

```text
  AUTOMATIC                          MANUAL
  ─────────                          ──────
  + seconds of downtime              + a human checks lag and health first
  + works at 3am                     + no spurious failovers ever
  - can fire on a false positive     - minutes to hours of downtime
  - can flap between nodes           - requires a competent human, awake
  - loses async writes without
    anyone deciding to
```

The pattern that works well in practice: **automatic failover with strong
fencing, plus a cooldown that prevents flapping, plus loud alerting.** The
cooldown matters — without it, a system that failed over because of load will
fail over again immediately on the new leader, which is now taking the same load.

And whichever you choose, the rule that decides whether it works: **test it.**
A failover path that has never been exercised does not work. Run a game day, kill
the leader in production during a low-traffic window, and measure the actual
recovery time and the actual data loss. Every organisation that has done this has
found something broken.

## RTO and RPO: saying what you are buying

Two numbers that make the whole conversation concrete:

```text
  RPO  Recovery Point Objective — how much DATA may be lost
       "up to 5 seconds of writes"

  RTO  Recovery Time Objective — how long you may be DOWN
       "under 60 seconds"
```

```text
  RPO = 0                 requires synchronous or semi-sync replication
                          costs write latency

  RPO = seconds           async replication with low lag
                          costs the writes in flight

  RPO = hours             backups only
                          costs everything since the last backup

  RTO = seconds           automatic failover, warm standby
  RTO = minutes           automatic failover with verification
  RTO = hours             manual promotion, or restore from backup
```

Write these down per system, agree them with whoever owns the product, and check
the architecture actually delivers them. "RPO = 0" and "asynchronous replication"
on the same page is a contradiction that should be caught in design review, not
during an incident.

## The follower's side: catching up

After a failover the remaining followers must switch to the new leader, and this
is not trivial:

```text
  follower was at position 1000 on the OLD leader's timeline
  new leader is on a NEW timeline that diverged at 998

  the follower has writes 999 and 1000 that no longer exist
```

The follower must rewind to the divergence point and replay forward. Postgres
handles this with timeline IDs — a promoted node increments its timeline, and
followers detect the change and can be rewound with `pg_rewind`. Systems without
an equivalent require a full re-sync from a base backup, which for a large
database is hours.

This is worth checking for whatever you run, because "how long does a follower
take to rejoin after a failover" is the number that determines how long you are
running without redundancy afterwards — and running without redundancy is when
the second failure happens.

## What to take away

1. Failover is detect, elect, promote, redirect, and each step has a
   characteristic failure.
2. Asynchronous replication means failover discards every acknowledged write the
   new leader had not received — the only prevention is semi-synchronous
   replication.
3. A returning old leader diverges from the new one; fencing tokens checked *by
   the storage layer* are what make its writes harmless.
4. A lock or a leadership claim without a fencing token is not safe, because a
   paused holder cannot know its lease expired.
5. State RPO and RTO explicitly, and check the architecture delivers them —
   "RPO 0" with async replication is a contradiction.
6. An untested failover path does not work. Exercise it deliberately.

Next: multi-leader replication — accepting writes in several places, and the
conflicts that follow.
