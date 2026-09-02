---
title: Partial failure and the two generals
minutes: 21
summary: Why "did it work?" can be unanswerable, and how systems are built anyway.
---

In a single process there are two outcomes: the function returned, or it threw.
Across a network there are three, and the third one has no name in most
programming languages: **you do not know**. Learning to design for that third
outcome is the largest single step in becoming competent at distributed systems,
because no amount of careful coding removes it.

## The three outcomes

```text
  request sent ──▶ ?

  ┌─────────────────────────────────────────────────────────┐
  │ 1. response received: success                           │
  │      the operation happened, you know it                │
  ├─────────────────────────────────────────────────────────┤
  │ 2. response received: error                             │
  │      the operation did not happen (usually), you know   │
  ├─────────────────────────────────────────────────────────┤
  │ 3. TIMEOUT — no response                                │
  │      the operation may have fully succeeded             │
  │      the operation may have partially succeeded         │
  │      the operation may not have started                 │
  │      the operation may be running RIGHT NOW             │
  │      the operation may run in ten minutes               │
  └─────────────────────────────────────────────────────────┘
```

Case 3 is not an edge case, and it is not rare. Every timeout you have ever seen
in a log is one. And crucially, **the two sub-cases are indistinguishable from
the caller's side**:

```text
  request lost on the way out            request arrived, reply lost

  client ──✗                             client ────────▶ server
         (never arrived)                        ✗◀────── (did the work!)

  client sees: timeout                   client sees: timeout
  reality:     nothing happened          reality:     it happened
```

The client observes exactly the same thing. There is no header, no error code
and no retry that distinguishes them, because the information the client would
need never reached it. This is not an engineering limitation to be worked
around; it is a property of asynchronous networks.

## The two generals problem

The formal version, and the reason the above cannot be fixed.

Two generals must attack a city simultaneously. Attacking alone loses. They can
only communicate by messengers who cross enemy territory and may be captured.

```text
  General A                                   General B
     │  "attack at dawn" ───────────────────────▶ │
     │                                            │  received. but A doesn't
     │                                            │  know I received it, so
     │                                            │  A won't attack.
     │ ◀─────────────────────── "acknowledged"    │
     │  received. but B doesn't know I got the    │
     │  ack, so B won't be sure I'll attack.      │
     │  "ack the ack" ──────────────────────────▶ │
     │                                            │  ...
```

**Theorem: there is no protocol that guarantees agreement.** Whatever finite
sequence of messages you design, the last message might be lost, and its sender
cannot know whether it arrived. Adding more acknowledgements moves the
uncertainty; it never eliminates it.

This is a proof, not a difficulty. It means that "both sides definitely agree on
whether this happened" is unachievable over a lossy link, and any design that
requires it is wrong.

What you get instead is *probabilistic* confidence — after three
acknowledgements, the chance all were lost is small — and, far more usefully,
**designs that do not need the guarantee at all.** That is the practical
response: stop trying to know, and make not-knowing safe.

## Making not-knowing safe: idempotence

If retrying is harmless, you no longer need to know whether the first attempt
worked. You just retry until you get an answer.

```text
  NOT idempotent                    IDEMPOTENT

  charge $50                        charge $50 with key "ord-7c3f"
  ├─ timeout                        ├─ timeout
  ├─ retry                          ├─ retry, SAME key
  └─ charged twice ✗                └─ server: "seen ord-7c3f,
                                        here is the original result" ✓
```

The server stores the key with the result of the first attempt:

```python
def charge(amount, card, idempotency_key):
    existing = store.get(idempotency_key)
    if existing:
        return existing.response          # do nothing, replay the answer

    with db.transaction():
        # the key and the effect must commit TOGETHER, or a crash between them
        # loses the record of an effect that really happened
        result = payment_gateway.charge(amount, card)
        store.put(idempotency_key, result)
    return result
```

Two details that are easy to get wrong and expensive when you do:

- **Store the key in the same transaction as the effect.** If the charge commits
  and the key does not, a retry charges again — which is the exact bug you were
  preventing.
- **Store the *response*, not just the fact.** A retry must return what the
  original returned. Returning "already processed" as a different shape forces
  every client to handle two success formats.
- **The client generates the key**, before the first attempt, and reuses it
  across retries. A server-generated key cannot help, because the retry is a new
  request.

Some operations are naturally idempotent and need none of this: `PUT` with a
full representation, `DELETE`, "set status to shipped". Prefer designing
operations in that shape when you can — absolute rather than relative, `set x =
5` rather than `increment x`.

## Failure detectors: the timeout you must choose

You cannot tell a crashed node from a slow one. That is another impossibility,
and it forces an unavoidable trade.

```text
  timeout TOO SHORT                    timeout TOO LONG
  ────────────────────                 ────────────────────
  healthy-but-slow nodes are           genuinely dead nodes are
  declared dead                        treated as alive

  → work is duplicated                 → requests pile up waiting
  → failover thrashes                  → users see hangs
  → load moves onto remaining          → recovery is slow
    nodes, making THEM slow,
    which declares them dead too
```

The left column's death spiral is worth naming: a too-aggressive failure
detector under load removes healthy nodes, which increases load on the rest,
which makes them slow, which removes them too. Several large outages have this
shape.

There is no correct universal value. What there is:

- **Base timeouts on measured p99 latency**, not on round numbers. A timeout of
  "2 seconds" chosen because it felt right is a number with no relationship to
  the system.
- **Prefer adaptive detectors** for cluster membership. A phi-accrual detector
  outputs a *suspicion level* from the distribution of recent heartbeat
  intervals, rather than a boolean, letting callers pick their own threshold.
- **Separate liveness from readiness.** "The process is running" and "it can
  serve traffic" are different questions, and conflating them is why a node with
  a full connection pool keeps receiving requests.

## Failure is partial, and the partial part is the problem

The word "partial" is doing real work. Consider a request that fans out:

```text
  request ──┬──▶ inventory   ✓ reserved
            ├──▶ payments    ✓ charged
            ├──▶ shipping    ✗ TIMEOUT
            └──▶ analytics   ✓ recorded

  three-quarters of an order exists. what is the state of the system?
```

Nothing rolled back, because there is no transaction spanning four services.
The system is now in a state that no single component believes is wrong: from
inventory's view the stock is reserved and that is correct; from payments' view
the money moved and that is correct. Only the whole is inconsistent, and nothing
is looking at the whole.

The three standard responses, and when each applies:

1. **Compensate (saga).** Explicitly undo the completed steps: refund the
   charge, release the stock. Requires every step to have a compensating action,
   which some steps do not have — you cannot un-send an email.
2. **Retry forward.** Keep trying the failed step until it succeeds, holding the
   order in a `pending` state meanwhile. Requires idempotence and a durable
   record of intent (the outbox again).
3. **Reconcile.** Accept temporary inconsistency and run a periodic job that
   compares the sources of truth and repairs differences. Every payments system
   does this, without exception, because it is the only defence against bugs in
   the other two.

Retry-forward is the default for anything that must eventually happen.
Compensation is for things that must not remain half-done. Reconciliation is not
an alternative to either — it is the backstop you run regardless.

## The crash that lands in the middle

Partial failure also happens *inside* one node, and the classic version is a
crash between two writes:

```python
db.mark_order_paid(order_id)      # committed
# ← crash here
queue.publish("order.paid", order_id)   # never happened
```

The order is paid and nothing downstream knows. Swapping the order does not
help: publish-then-crash means an event for a payment that never committed.

There is no arrangement of two separate systems that makes this atomic. The
answer is to make them one system for the duration of the write:

```text
  BEGIN
    update orders set status = 'paid' where id = 7;
    insert into outbox (topic, payload) values ('order.paid', '{"id":7}');
  COMMIT                                    ▲
                                            │ same transaction, same database
  a separate relay process reads the outbox and publishes,
  marking rows sent — at-least-once, so consumers must be idempotent
```

Both writes are in one transaction against one database, so they are atomic.
The publish becomes a separate, retryable step. This is the **transactional
outbox**, and it is worth recognising on sight because it is the answer to a
whole family of "these two things must both happen" problems.

## The discipline

Design review questions that catch most of this:

```text
  □  For each remote call: what if it times out?
  □  Is it safe to retry?  If not, what makes it safe?
  □  Who generates the idempotency key, and when?
  □  Is the effect and its record of having happened in ONE transaction?
  □  If we half-succeed, who notices?  What repairs it?
  □  Where did this timeout come from, and what is the p99 it is based on?
```

The most important of these is the fifth. A design that can half-succeed and has
nothing that notices is a design that will accumulate silent corruption.

## What to take away

1. Remote calls have three outcomes, and the third — no response — is
   genuinely ambiguous: the work may or may not have happened.
2. The two generals problem proves that guaranteed mutual agreement over a lossy
   link is impossible. Do not design anything that needs it.
3. Idempotence converts "I must know" into "I can retry", which is the actual
   escape. The key must be client-generated and stored atomically with the
   effect.
4. You cannot distinguish a crashed node from a slow one; too-aggressive failure
   detection causes death spirals under load.
5. Partial failure leaves a system where every component is individually correct
   and the whole is wrong. Retry forward, compensate, and reconcile regardless.
6. A crash between two writes to two systems is unavoidable — the transactional
   outbox makes them one write plus one retryable step.

Next: latency — the numbers worth memorising, and why the physics puts a floor
under some of them.
