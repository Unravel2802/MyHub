---
title: Sagas
minutes: 21
summary: Trading atomicity for availability, and the compensations that are harder to design than the happy path.
---

A saga is a sequence of local transactions where each step commits immediately,
and failure is handled by running compensating actions for the steps that already
succeeded. It gives up atomicity and isolation, and gets back the ability for
each step to fail and retry independently — which is what makes it the right
shape across services.

## The structure

```text
  HAPPY PATH
  T1 ──▶ T2 ──▶ T3 ──▶ T4        each commits locally, immediately

  FAILURE AT T3
  T1 ──▶ T2 ──▶ T3 ✗
   │      │
   ▼      ▼
  C1 ◀── C2                      compensate in REVERSE order
```

Each `Ti` has a compensating `Ci` that semantically undoes it. Note "semantically"
— a compensation is not a rollback. The original transaction committed and was
visible; the compensation is a *new* transaction that counteracts it.

```text
  T: reserve 3 units of SKU-88      C: release 3 units of SKU-88
  T: charge $50                     C: refund $50
  T: allocate seat 14A              C: release seat 14A
  T: send confirmation email        C: ??? — see below
```

## Compensations are harder than they look

**Some actions cannot be undone.** An email is sent. A message was posted. A
physical package shipped. The compensation is either a *counter-action* ("we're
sorry, your order was cancelled") or the step must be moved to a position in the
saga where it can no longer be followed by a failure.

That second technique is the important one. Sagas are usually designed in three
phases:

```text
  COMPENSATABLE     steps that can be undone
                    (reserve stock, authorise payment)
         │
  PIVOT              the point of no return — the step that decides
                    (capture the payment)
         │
  RETRIABLE          steps that MUST eventually succeed, and are
                    retried forever rather than compensated
                    (send email, update analytics, ship)
```

Once you pass the pivot, the saga only goes forward. Everything irreversible goes
after the pivot; everything undoable goes before it. Getting the pivot in the
right place is most of saga design.

**Compensations must be idempotent** — they will be retried, for the same reason
every other remote call is.

**Compensations can fail.** And there is no compensation for a compensation. The
practical answer: retry the compensation indefinitely with backoff, and after N
attempts, escalate to a human via a dead-letter queue and an alert. A saga
framework without a human escalation path is incomplete, because a permanently
failing compensation is not a hypothetical.

**Compensations may need data the forward step consumed.** To refund a payment
you need the payment ID that step 2 returned. The saga's state must carry it, and
that state must be durable — which is what makes a saga a persistent object
rather than a function call.

## Orchestration versus choreography

Two ways to drive the sequence, and the choice is consequential.

```text
  ORCHESTRATION                       CHOREOGRAPHY

    ┌──────────────┐
    │ orchestrator │                   Order ──event──▶ Payment
    └──┬───┬───┬───┘                      ▲                │
       │   │   │                          │               event
       ▼   ▼   ▼                          │                ▼
     Order Pay Ship                    Shipping ◀─event─ Inventory

  a central component holds            each service reacts to events
  the state machine and calls          and emits its own; nobody owns
  each service in turn                 the overall flow
```

| | Orchestration | Choreography |
| --- | --- | --- |
| Flow is visible | ✅ in one place | ❌ spread across services |
| Coupling | services coupled to the orchestrator | services coupled to event schemas |
| Adding a step | change the orchestrator | add a subscriber |
| Debugging | one state machine to inspect | trace across N services |
| Cyclic dependencies | impossible | easy to create accidentally |
| Single point of failure | the orchestrator | none |

**Prefer orchestration for anything with more than about three steps.** The
decisive argument is not coupling — it is that with choreography, *nobody knows
what the process is*. The business flow exists only as an emergent property of
which services happen to subscribe to which events, and answering "what happens
when an order is placed?" requires reading every service. Six months later,
nobody can answer it.

Choreography is a good fit for genuinely independent reactions to an event —
update the search index, record analytics, send a notification — where there is
no *process*, just several unrelated consumers.

An orchestrator does not have to be a separate service, incidentally. It can be a
state machine inside the service that owns the business process, which removes
the extra deployable while keeping the flow in one readable place.

## Making the state machine durable

The orchestrator's state must survive its own crash, or a saga stops halfway with
nobody to resume it:

```text
  saga_instances
  ┌──────────────────────────────────────────────────────────────┐
  │ id        state              step  payload           updated │
  ├──────────────────────────────────────────────────────────────┤
  │ sg-7c3f   AWAITING_PAYMENT   2     {order:.., res:..} 10:02  │
  │ sg-9a1b   COMPENSATING       3     {order:.., pay:..} 10:03  │
  │ sg-4e2d   COMPLETED          5     {...}              09:58  │
  └──────────────────────────────────────────────────────────────┘
```

Two mechanisms make this robust:

**Persist the state transition in the same transaction as the outbox message
that triggers the next step.** That is the outbox pattern (next chapter) applied
to saga progression, and it is what makes "advance the saga" atomic with
"remember that we advanced it".

**A sweeper for stuck sagas.** Any saga in a non-terminal state for longer than
its expected duration gets picked up and retried or escalated. Without a sweeper,
a saga whose triggering message was lost sits in `AWAITING_PAYMENT` forever, and
nobody notices until a customer complains.

## A worked example

```python
# Orchestrated saga. Every step and every compensation is idempotent,
# and the pivot is explicit.
SAGA = [
    Step("reserve_inventory",  compensate="release_inventory"),
    Step("authorise_payment",  compensate="void_authorisation"),
    Step("capture_payment",    pivot=True),          # ← no going back
    Step("create_shipment",    retry_forever=True),
    Step("send_confirmation",  retry_forever=True),
]

def advance(saga_id):
    saga = db.lock_and_load(saga_id)          # row lock: one worker at a time
    step = SAGA[saga.step]

    try:
        key = f"{saga_id}:{saga.step}"
        result = call(step.name, saga.payload, idempotency_key=key)
        with db.transaction():
            saga.payload.update(result)
            saga.step += 1                    # progress and the next trigger
            outbox.enqueue("saga.advance", saga_id)   # commit together
            db.save(saga)
    except PermanentFailure:
        if step.pivot or saga.past_pivot:
            # after the pivot we do not compensate — we retry forever
            # and escalate if it keeps failing
            escalate(saga_id)
        else:
            begin_compensation(saga)
```

Three details in there that matter more than the structure:

- **`idempotency_key=f"{saga_id}:{saga.step}"`** — deterministic, so a retry of
  the same step produces the same key and the callee deduplicates.
- **The row lock** — two workers advancing the same saga concurrently is the
  default failure mode without it, since the trigger message is at-least-once.
- **State change and next trigger in one transaction** — otherwise the saga
  advances and the trigger is lost, or vice versa.

## The isolation anomalies, again

From the first chapter, now with the countermeasures made concrete:

```text
  DIRTY READ    another transaction sees the reserved inventory
                and makes a decision on it, then the saga compensates

  countermeasure: SEMANTIC LOCK — the row carries status='reserved'
                  with the saga id, so readers know it is provisional
                  and can choose to skip or wait
```

```text
  LOST UPDATE   another transaction overwrites a value the saga
                will later compensate, so the compensation subtracts
                from the wrong base

  countermeasure: COMMUTATIVE operations — `quantity -= 3` rather than
                  `quantity = 7`. The compensation `quantity += 3` is
                  then correct regardless of what happened in between.
```

The commutative-update point generalises well beyond sagas and is worth carrying:
**an operation expressed as a delta composes with concurrent changes; one
expressed as an absolute value does not.**

## When a saga is the wrong tool

```text
  ✗ when the steps are all in one database — use a transaction
  ✗ when a step genuinely cannot be compensated and cannot be
    placed after the pivot
  ✗ when intermediate visibility is unacceptable (some regulatory
    and financial contexts)
  ✗ for two steps — the outbox is simpler and sufficient
```

That last one matters in practice. Most "we need a saga" situations are actually
"we need to write a row and reliably do one other thing", which is the outbox
pattern with far less machinery. Reach for a saga at three or more steps with
real compensation requirements.

## What to take away

1. A saga is local transactions plus compensating transactions; a compensation is
   a new transaction, not a rollback, because the original was already visible.
2. Structure a saga as compensatable steps, a pivot, then retriable steps — put
   everything irreversible after the pivot.
3. Compensations must be idempotent, can themselves fail, and need a human
   escalation path; a saga framework without one is incomplete.
4. Prefer orchestration past three steps: with choreography, nobody can answer
   "what happens when an order is placed?".
5. Persist the saga's state transition in the same transaction as the message
   that triggers the next step, and run a sweeper for stuck instances.
6. Express step effects as deltas rather than absolute values so compensations
   remain correct under concurrent change.

Next: the outbox — the answer to the two-writes problem, and the piece most of
this is built on.
