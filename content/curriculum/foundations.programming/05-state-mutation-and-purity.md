---
title: State, mutation and purity
minutes: 23
summary: Why the same inputs stop producing the same outputs, and how to contain the damage.
---

Two functions can have identical signatures, identical bodies at a glance, and
behave completely differently — because one of them reads something that
changed since you last looked. State is what makes programs useful and what
makes them hard, and nearly every hard-to-reproduce bug is a state bug wearing
a costume.

## The property that makes reasoning possible

A function is **pure** when:

1. Its return value depends only on its arguments, and
2. It has no observable effect other than returning.

```python
def add(a, b):              # pure
    return a + b

total = 0
def add_to_total(x):        # impure: reads and writes state outside itself
    global total
    total += x
    return total
```

Purity is not an aesthetic preference. It buys concrete, checkable properties:

| Property                 | What it enables                                    |
| ------------------------ | -------------------------------------------------- |
| Same input → same output | Cache it, memoise it, retry it                     |
| No effects               | Reorder, parallelise, skip if the result is unused |
| No hidden inputs         | Test it with arguments alone — no setup, no mocks  |
| Local reasoning          | Understand it without reading anything else        |

That last one is the real prize. To understand a pure function you read the
function. To understand an impure one you must also know what state exists, who
else writes it, and what order things ran in — which is unbounded work, and is
why a 30-line impure function can be harder than a 300-line pure one.

## Where state hides

Global variables are the obvious case and the rarest. The ones that actually
cause trouble:

```text
  ┌─ module-level singletons ──── a cache, a connection pool, a registry
  ├─ class attributes ─────────── shared by every instance
  ├─ mutable default arguments ── Python's famous one
  ├─ closures over mutable cells ─ see the previous chapter
  ├─ the filesystem ───────────── the most-forgotten global variable
  ├─ environment variables ─────── configuration read at import time
  ├─ the clock ────────────────── now() is a hidden input
  ├─ the random number generator ─ another hidden input
  └─ the database ─────────────── the largest shared mutable object you own
```

The clock and the RNG are worth dwelling on, because they turn a pure-looking
function impure in a way that is invisible in the signature:

```python
def is_expired(token):                 # looks pure. is not.
    return token.expires_at < datetime.now()
```

This function cannot be tested deterministically, cannot be reasoned about
without knowing when you ran it, and will behave differently in a test suite run
at 23:59:59. The fix is to make the hidden input explicit:

```python
def is_expired(token, now):            # now genuinely pure
    return token.expires_at < now
```

The caller supplies `now`. Tests pass a fixed instant. One tiny change moves the
impurity out to the edge where exactly one line has to deal with it. The same
move works for randomness (pass a seeded generator), for IDs (pass a factory),
and for anything else non-deterministic.

## Python's mutable default argument

The canonical demonstration that state hides in surprising places:

```python
def append_to(item, target=[]):        # DANGER
    target.append(item)
    return target

append_to(1)      # [1]
append_to(2)      # [1, 2]   ← the same list, still there
```

Default arguments are evaluated **once**, when the `def` executes — not per
call. So the list is created at import time and lives for the life of the
process, accumulating across every caller.

```text
  import time:   append_to.__defaults__ ──▶ ┌────┐
                                            │ [] │   ◀── ONE list, forever
                                            └────┘
  call 1:  appends 1 ─────────────────────▶ [1]
  call 2:  appends 2 ─────────────────────▶ [1, 2]
```

The fix is the sentinel:

```python
def append_to(item, target=None):
    if target is None:
        target = []
    target.append(item)
    return target
```

This is a language wart, but the underlying lesson generalises: **anything
created once and reachable forever is global state**, however local it looks.

## Shared mutable state and concurrency

Single-threaded, mutation is merely hard to follow. With concurrency it becomes
a correctness hazard, because operations that look atomic are not.

```python
counter += 1
```

is three operations:

```text
  thread A                    thread B
  ─────────────────────       ─────────────────────
  read counter  → 5
                              read counter  → 5      ◀── both read 5
  add 1         → 6
                              add 1         → 6
  write 6
                              write 6                ◀── one increment lost
```

Two increments, one result. This is a **data race**, and it is not a rare
scheduling accident — under load it happens constantly. The defences, in
increasing order of preference:

1. **Lock it.** Correct, and introduces deadlock, contention and the need for
   every reader to know the rule.
2. **Make it atomic.** `AtomicInteger`, `fetch_add` — correct for single
   variables, no help for multi-field invariants.
3. **Don't share it.** Give each thread its own copy and combine at the end.
4. **Don't mutate it.** Immutable data is safe to share with no coordination at
   all, because there is nothing to race on.

Options 3 and 4 are the ones that scale, because they remove the problem rather
than managing it. This is why immutable-by-default languages have such an
easier time with concurrency, and why Rust's borrow checker — which enforces
"either one mutable reference or many immutable ones" — eliminates data races at
compile time rather than by convention.

## The functional core, imperative shell

Pure programs are useless: a program with no effects cannot write a file, answer
a request, or charge a card. The goal is never to eliminate state, it is to
**push it to the edges** and keep the middle pure.

```text
  ┌──────────────────────────────────────────────────────┐
  │  IMPERATIVE SHELL                                    │
  │  read request, load rows, get the clock, write file  │
  │                                                      │
  │    ┌────────────────────────────────────────────┐    │
  │    │  FUNCTIONAL CORE                           │    │
  │    │  pricing rules, validation, state machine, │    │
  │    │  scheduling, formatting — all pure         │    │
  │    │  data in ──▶ decisions out                 │    │
  │    └────────────────────────────────────────────┘    │
  │                                                      │
  │  apply the decisions: commit, publish, respond       │
  └──────────────────────────────────────────────────────┘
```

The shell does I/O and nothing interesting. The core does everything
interesting and no I/O. Concretely, a refactor in this direction looks like:

```python
# before: effects and logic braided together
def process_order(order_id):
    order = db.get(order_id)                      # effect
    if order.total > 100:                         # logic
        order.discount = order.total * 0.1        # logic
    db.save(order)                                # effect
    email.send(order.customer, "confirmed")       # effect

# after
def discount_for(order):                          # pure: trivially testable
    return order.total * 0.1 if order.total > 100 else 0

def process_order(order_id):                      # shell: thin, boring
    order = db.get(order_id)
    order.discount = discount_for(order)
    db.save(order)
    email.send(order.customer, "confirmed")
```

The pricing rule — the part that will grow to forty lines of business logic and
that someone will need to change under pressure — is now testable with a
literal and no database. That is the entire payoff, and it compounds as the
rule grows.

A useful signal: **if a test needs a mock, ask whether the logic could have been
pure instead.** Mocks are usually a sign that effects have leaked into a place
that only needed to make a decision.

## Idempotence, and why distributed systems demand it

An operation is **idempotent** if doing it twice has the same effect as doing it
once.

```text
  set balance to 100      idempotent    ✓
  add 100 to balance      NOT           ✗
  delete user 7           idempotent    ✓
  append to a log         NOT           ✗
```

This matters the moment a network is involved, because you cannot distinguish
"the request failed" from "the response was lost". The only safe response to a
timeout is to retry, and retrying a non-idempotent operation charges the card
twice.

The standard fix is to make the operation idempotent artificially, with a key
the caller generates:

```text
  POST /charges
  Idempotency-Key: 7f3c-a91e-...

  server: have I seen this key?
            yes → return the stored response, do nothing
            no  → perform the charge, store the response against the key
```

Stripe, and essentially every payments API since, works this way. It is worth
recognising as a state-management technique: the key turns a stateful,
order-sensitive operation into one that is safe to repeat.

## Practical rules

1. **Default to immutable.** Make mutation the exception you write down.
2. **Push effects outward.** Decisions in the middle, I/O at the edges.
3. **Make hidden inputs into parameters.** Clock, randomness, IDs, config.
4. **Never mutate an argument** unless the function's name says so
   (`sort_in_place`). Silent mutation of a caller's data is the rudest thing a
   function can do.
5. **Make invalid mutation impossible rather than forbidden.** Return copies or
   read-only views of internal state; do not rely on a comment asking nicely.
6. **Assume every network-triggered operation runs twice.** Design for it.

## What to take away

1. A pure function's output depends only on its arguments and it has no effects;
   that is what makes local reasoning, caching, retrying and easy testing
   possible.
2. State hides in singletons, class attributes, default arguments, the clock,
   the RNG, the filesystem and the database — not mainly in globals.
3. `counter += 1` is three operations, so shared mutable state under concurrency
   loses updates. Not sharing and not mutating beat locking.
4. Functional core, imperative shell: keep decisions pure and confine effects to
   a thin edge. Needing a mock is a hint that logic and effects are tangled.
5. Idempotence is what makes retries safe; over a network, retries are not
   optional, so idempotence is not either.

Next: errors — how failure is represented, and why the paths you did not test
are where systems actually break.
