---
title: Reconciliation
minutes: 19
summary: The backstop every serious system runs, because the other mechanisms are implemented by people.
---

Everything in this topic is a mechanism for keeping two systems in agreement.
Every one of them is implemented in code, configured by a human, and deployed
into an environment that does things nobody anticipated. Reconciliation is the
process that periodically checks whether the agreement actually holds — and it is
not a sign that the other mechanisms failed. It is what every organisation
handling money does, without exception, precisely because they take correctness
seriously.

## Why it is not redundant

The outbox is correct. The saga is correct. The idempotency keys are correct. And
yet:

```text
  □  a deploy shipped a bug that skipped the outbox insert for a week
  □  a manual database fix during an incident bypassed the event path
  □  a consumer's dead-letter queue accumulated messages nobody drained
  □  a third-party API succeeded but its response was lost, and the
     retry hit a different endpoint that did not deduplicate
  □  a schema change dropped a field the consumer needed, silently
  □  clock skew let two workers hold the same lease
```

None of these are protocol failures. They are the ordinary ways software goes
wrong, and no protocol prevents them. Reconciliation is the layer that **detects
divergence regardless of cause**, which is a fundamentally different kind of
guarantee from "this mechanism is correct".

The mental model worth adopting: the outbox and the saga are the *design*;
reconciliation is the *audit*. You would not run a business with a well-designed
accounting process and no audit.

## The shape

```text
  ┌──────────────┐        ┌──────────────┐
  │  SYSTEM A    │        │  SYSTEM B    │
  │ (source of   │        │ (derived, or │
  │  truth)      │        │  a partner)  │
  └──────┬───────┘        └──────┬───────┘
         │                       │
         ▼                       ▼
     extract a               extract the
     comparable view         comparable view
         │                       │
         └───────────┬───────────┘
                     ▼
              ┌─────────────┐
              │  COMPARE    │
              └──────┬──────┘
                     ▼
       ┌─────────────┴──────────────┐
       ▼                            ▼
   MATCHED                     DISCREPANCIES
   (the vast majority)          │
                     ┌──────────┼──────────┐
                     ▼          ▼          ▼
                 auto-fix    escalate   accept
                             to human   (known/timing)
```

Two decisions define a reconciliation, and both must be explicit:

**Which side is authoritative?** If A and B disagree, which one is right? A
reconciliation without a designated source of truth cannot repair anything — it
can only report that something is wrong. Usually the system that *owns* the write
is authoritative and the derived system is repaired.

**What is a real discrepancy versus timing?** Systems are eventually consistent,
so a difference may simply mean the event has not arrived yet. This is what makes
naive reconciliation useless: it reports thousands of false positives and
everyone stops reading it.

## Handling the timing problem

The technique that makes reconciliation practical: **compare a window that has
already settled.**

```text
  now ─────────────────────────────────────────────────▶
        │                    │                  │
    T-24h                 T-1h                now
        │◀── reconcile ────▶│◀── in flight ───▶│
              this window      leave alone

  a difference older than the maximum propagation delay is real.
  a difference inside the settling window is probably timing.
```

Choose the settling window from the actual maximum propagation delay — the
longest retry path, plus the longest expected outage of the delivery mechanism.
The same sizing argument as the idempotency window, and the same failure if you
get it wrong: too short produces noise, too long delays detection.

A refinement worth adding: **track discrepancies across runs.** A record that
differs in one run and matches in the next was timing. One that differs in three
consecutive runs is real, and can be escalated with confidence. This turns a
noisy signal into a reliable one at the cost of latency.

## Efficient comparison

Comparing two million-row datasets by transferring both is wasteful. Three
techniques, in increasing sophistication:

**Aggregate first.** Compare totals before individual records:

```sql
-- if these match, the detail almost certainly matches
SELECT date, count(*), sum(amount) FROM our_ledger      GROUP BY date;
SELECT date, count(*), sum(amount) FROM partner_ledger  GROUP BY date;
```

Cheap, and catches the large majority of real problems immediately. Only descend
into row-level comparison for the buckets that disagree. Note the weakness: two
compensating errors can produce a matching sum, which is why the aggregate should
include a count as well as a sum, and ideally a checksum.

**Hash trees.** The Merkle tree from the leaderless-replication chapter, applied
here: hash each bucket, compare hashes, and descend only into differing branches.
This is the general form of "aggregate first" and scales to very large datasets.

**Streaming comparison.** Sort both sides by key and walk them in lockstep,
emitting differences. Memory-bounded regardless of size, and it works when
neither side fits in memory.

```python
def reconcile(a_sorted, b_sorted):
    a, b = next(a_sorted, None), next(b_sorted, None)
    while a or b:
        if b is None or (a and a.key < b.key):
            yield Missing("B", a); a = next(a_sorted, None)
        elif a is None or b.key < a.key:
            yield Missing("A", b); b = next(b_sorted, None)
        else:
            if a.value != b.value:
                yield Mismatch(a, b)
            a, b = next(a_sorted, None), next(b_sorted, None)
```

## Repair, and how much to automate

```text
  AUTO-REPAIR when                     ESCALATE when
  ────────────────                     ─────────────
  the direction is unambiguous         either side could be right
  (derived index missing a row)        (two ledgers disagree on an amount)

  the fix is idempotent                the fix moves money

  the volume is routine                the volume is anomalous
                                       ← THIS ONE MATTERS
```

The third row is the important guard. A reconciliation that auto-repairs
thousands of records instead of its usual dozen is not fixing a problem — it is
*amplifying* one, and the correct behaviour is to stop and alert.

```python
discrepancies = compare(source, target)

if len(discrepancies) > THRESHOLD:
    # a normal day is a handful. hundreds means something upstream
    # broke, and repairing them one by one will make it worse.
    alert("reconciliation anomaly", count=len(discrepancies))
    return                              # do NOT auto-repair

for d in discrepancies:
    if d.is_safely_repairable:
        repair(d)
        audit_log.record(d, action="auto-repaired")
    else:
        escalate(d)
```

**Log every repair.** A reconciliation that silently fixes things hides the
underlying bug, and the count of auto-repairs over time is one of the better
health metrics a system can have. A repair rate that is climbing means something
is degrading, long before it becomes an incident.

## What to reconcile

```text
  □  database  ↔  search index / cache / read model
  □  your ledger  ↔  the payment provider's ledger
  □  order state  ↔  fulfilment system state
  □  entitlements  ↔  billing subscriptions
  □  outbox rows published  ↔  events consumed downstream
  □  aggregate counters  ↔  a recount from the source rows
```

That last one is worth calling out. Any denormalised counter — comment counts,
follower counts, balances, inventory totals — drifts. It drifts from lost events,
from concurrent updates, and from bugs. **Every denormalised aggregate should
have a job that recomputes it from the source of truth**, and the difference
between the stored and recomputed value is a direct measure of how well the rest
of the system is working.

## Where to run it

```text
  CONTINUOUS      compare each record shortly after it settles
                  → fastest detection, highest cost, best for money

  PERIODIC BATCH  a scheduled job over a window
                  → the common default; hourly or daily

  ON DEMAND       triggered during an incident or before a migration
                  → always worth having, even if nothing is scheduled
```

Run reconciliation **against a replica or a warehouse copy**, not the production
primary — a full-table scan against the primary during business hours is a
self-inflicted incident, and the staleness of a replica is irrelevant when you are
already comparing a settled window.

## The organisational half

Two points that are not technical and that determine whether any of this works.

**Someone must own the output.** A reconciliation report nobody reads is worse
than no reconciliation, because it creates the belief that the system is checked.
Route discrepancies into whatever queue the team actually works — the alerting
system, the ticket tracker — not into an email nobody opens.

**Discrepancies are bug reports.** Each one is evidence of a defect in the
mechanisms above. The reconciliation repairs the symptom; someone must
investigate the cause. A team that repairs the same class of discrepancy every
week and never asks why has turned a detection system into a permanent workaround.

## What to take away

1. Reconciliation is not redundant with correct protocols — it catches deploys,
   manual fixes, drained dead-letter queues and schema changes, which no protocol
   covers.
2. Every reconciliation needs a designated source of truth, or it can report but
   not repair.
3. Compare a settled window, and require a discrepancy to persist across runs, or
   the report drowns in timing false positives and gets ignored.
4. Aggregate first, then descend; hash trees and streaming comparison handle
   large datasets without transferring everything.
5. Auto-repair only when the direction is unambiguous and the volume is routine —
   an anomalous count means stop and alert, not repair harder.
6. Log every repair and treat the repair rate as a health metric; each
   discrepancy is a bug report about the mechanisms above it.

That completes distributed transactions. Next in the track: **messaging and event
streaming** — the log as infrastructure, and the delivery machinery most of these
patterns run on.
