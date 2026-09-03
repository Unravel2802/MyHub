---
title: "Case: payments and ledgers"
minutes: 19
summary: Money that cannot be lost, and why the ledger is append-only.
---

Design a payments system: charge a card, transfer between accounts, maintain
balances, handle refunds. It is the case where the distributed-systems material
stops being about performance and starts being about correctness, and where the
answer to almost every question is "record it immutably and reconcile".

## Requirements

```text
  FUNCTIONAL     charge · transfer · balance · refund ·
                 transaction history
  NON-FUNCTIONAL
    money is NEVER lost or created
    every change is AUDITABLE, forever
    strong consistency for balances
    idempotent operations
    regulatory retention
```

```text
  the defining property:

    correctness dominates everything. availability,
    latency and cost are all subordinate.

  → which inverts the priorities of every other case study
```

## Double-entry bookkeeping

```text
  every transaction is a set of ENTRIES that SUM TO ZERO.

    transfer $50 from Alice to Bob

      entry 1:  Alice's account   −50
      entry 2:  Bob's account     +50
                                 ────
                                    0
```

```text
  why this, and not just updating two balances

    □  the invariant "all entries sum to zero" is CHECKABLE
       at any time, over the whole ledger
    □  money cannot be created or destroyed by a bug — it
       can only be misplaced, and the check finds it
    □  every movement has a counterparty, so "where did this
       come from" always has an answer
```

**Double-entry is a five-hundred-year-old error-detecting code**, and adopting it
is the single highest-value decision in a financial system.

## The ledger is append-only

```text
  ✗  UPDATE accounts SET balance = balance - 50

  ✓  INSERT INTO ledger_entries (txn_id, account, amount, ...)
```

```text
  □  entries are IMMUTABLE — never updated, never deleted
  □  a mistake is corrected by a REVERSING entry, not by an
     edit
  □  the full history is the audit trail, by construction
  □  and the balance is a fold over the entries
```

```text
  the balance question

    computing balance = SUM(entries) is correct and slow
    for an account with millions of entries.

    → maintain a MATERIALISED balance, updated in the same
      transaction as the entries
    → and RECONCILE it periodically against the sum

  the materialised balance is a cache; the entries are the
  truth.
```

That framing resolves the tension: you get O(1) balance reads and a
mathematically checkable source of truth, and the reconciliation job is what
guarantees the cache has not drifted.

## Idempotency

```text
  a network timeout on a charge is indistinguishable from a
  failure. the client must retry. the retry must not charge
  twice.
```

```text
  POST /charges
  Idempotency-Key: ord-7c3f-attempt

  server:
    BEGIN
      INSERT INTO idempotency (key) VALUES (:key)   -- unique
      ... perform the charge, write the entries ...
      store the response against the key
    COMMIT
    -- a duplicate key violates the constraint, the
    -- transaction aborts, and the stored response is
    -- returned
```

```text
  the details that matter
    □  the key is CLIENT-generated, before the first attempt
    □  the key row and the effect commit TOGETHER
    □  the RESPONSE is stored and replayed, not a flag
    □  the retention window exceeds the longest retry path
      (24 hours is common)
```

## Consistency

```text
  a balance is exactly the operation that needs
  linearizability, per the consistency chapter:

    check balance ≥ amount, then debit

  a read-then-write across concurrent requests is the
  classic race.
```

```text
  the options

    SERIALIZABLE transaction     correct; contention on hot
                                 accounts
    CONDITIONAL UPDATE           UPDATE ... WHERE balance >= 50
                                 → the database checks and
                                   writes atomically
    ACCOUNT-PARTITIONED          each account owned by one
                                 partition; operations on it
                                 serialise there
```

```text
  and the design decision that follows:

    partition by ACCOUNT, so single-account operations are
    local and fast.

    a TRANSFER spans two accounts → two partitions → and
    that is where 2PC or a saga is genuinely required.
```

## External providers

```text
  charging a card involves a system you do not control.

    your DB       │  the provider
    ──────────────┼─────────────────
    write intent  │
    (pending)     │
                  │  ← call
                  │  ← may time out with the charge SUCCEEDED
    write outcome │
```

```text
  □  record the INTENT before calling out — otherwise a
     timeout leaves no record that you tried
  □  use the provider's OWN idempotency key
  □  on timeout, do NOT retry blindly — QUERY the provider
     for the key's status first
  □  reconcile daily against the provider's settlement file
```

**The daily reconciliation against the provider is non-negotiable**, and it is the
reconciliation chapter's argument in its clearest setting: your records and
theirs are two systems, no protocol makes them agree, and the audit is what
catches the difference.

## The state machine

```text
  PENDING ──▶ AUTHORISED ──▶ CAPTURED ──▶ SETTLED
     │             │              │
     ▼             ▼              ▼
  FAILED       EXPIRED        REFUNDED
```

```text
  □  every transition is an EVENT, appended
  □  transitions are validated — you cannot capture what was
     never authorised
  □  the current state is a fold over the events
  □  and a SWEEPER handles states that have been pending too
     long
```

## Money representation

```text
  ✗  FLOATING POINT. 0.1 + 0.2 ≠ 0.3, and rounding errors
     accumulate into real discrepancies.

  ✓  INTEGER MINOR UNITS — store cents, not dollars
  ✓  or a DECIMAL type with defined precision
  ✓  always store the CURRENCY alongside the amount
  ✓  define the rounding rule explicitly, and apply it in
     ONE place
```

```text
  and currency conversion:
    store the ORIGINAL amount, the rate, and the converted
    amount — all three, so the calculation can be audited
```

## Reconciliation

```text
  INTERNAL
    Σ all ledger entries = 0
    materialised balances = Σ entries per account
    → run continuously; alert on any non-zero

  EXTERNAL
    your records vs the provider's settlement file
    → daily; investigate every difference

  the DISCREPANCY COUNT is a health metric.
  a rise means something upstream changed.
```

## What to take away

1. Correctness dominates availability, latency and cost — which inverts the
   priorities of every other design.
2. Double-entry bookkeeping gives a checkable invariant that makes it impossible for
   a bug to create or destroy money silently.
3. The ledger is append-only and immutable; corrections are reversing entries, and
   the materialised balance is a cache reconciled against the entries.
4. Idempotency keys are client-generated and must commit atomically with the effect,
   storing and replaying the response.
5. Partition by account so single-account operations serialise locally; a transfer
   spans partitions and genuinely needs 2PC or a saga.
6. Never use floating point for money, record intent before calling an external
   provider, and reconcile daily against their settlement file.

Next: designing a product around a model.
