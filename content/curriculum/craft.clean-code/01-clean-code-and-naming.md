---
title: Clean code and naming
minutes: 15
summary: Code written to be read — the discipline that pays off on every later chapter's own terms.
---

Every technique in every later Software Craft chapter — testing, refactoring,
design patterns, error handling — assumes the code being worked on can be
read and understood in the first place. This chapter is that foundation:
not a style guide, but the reasoning behind why certain habits make code
easier to change later, and others make it harder regardless of intent.

## Naming carries the design

```text
  a name is the FIRST and CHEAPEST piece of documentation a
  reader encounters — before a comment, before a docstring,
  before they've read a single line of the function body.

    function process(d) { ... }              ✗ tells you
                                                 nothing
    function calculateShippingCost(order) { ... } ✓ tells you
                                                     what,
                                                     roughly
                                                     how
```

```text
  a name that's hard to choose is a SIGNAL, not a naming
  problem: if you can't name a function well, it's often
  because it does more than one thing, and no single name
  can describe all of it honestly.

  → struggling to name something is worth pausing on — the
    fix is frequently splitting the thing, not finding a
    cleverer word.
```

```text
  the specific traps:

    getData()          ✗ data from WHERE, of WHAT shape
    handleClick()       ✗ handles it HOW — the verb hides
                          the actual behavior behind a generic
                          event name
    temp, data2, x       ✗ says nothing a reader can search
                          for or reason about later
    isValid vs validate() distinguishes a QUESTION (returns
                          bool) from a COMMAND (does the
                          validating) — mixing these up is a
                          common source of confusion about
                          what calling something actually does
```

## Functions: one level of abstraction, one job

```text
  a function mixing HIGH-LEVEL steps and LOW-LEVEL detail in
  the same body is harder to read than either alone:

    function checkout(cart) {
      const total = cart.items.reduce((s,i) =>
        s + i.price * i.qty, 0);    // low-level arithmetic
      if (!user.isLoggedIn) throw ...;  // business rule
      logEvent('checkout_started');      // side effect
      return paymentGateway.charge(total); // another call
    }
```

```text
  → extract the arithmetic into its own named function
    (calculateTotal), and the reader of checkout() sees a
    sequence of NAMED STEPS at one consistent level — the
    detail is still there, one function call away, for
    whoever needs it.
```

```text
  the classic size heuristic ("a function should fit on one
  screen") is a SYMPTOM check, not the actual rule — a
  20-line function doing five unrelated things is worse than
  a 40-line function doing one thing with a long but coherent
  sequence of steps. the real test: can you describe what the
  function does in one sentence, without "and"?
```

## Comments that earn their place

```text
  // increment i by one
  i++;                                          ✗ says
                                                    nothing
                                                    the code
                                                    didn't
                                                    already
                                                    say

  // Stripe requires amounts in cents, not dollars —
  // see https://stripe.com/docs/currencies#zero-decimal
  const amountInCents = Math.round(amount * 100);  ✓ explains
                                                       a
                                                       constraint
                                                       the
                                                       reader
                                                       cannot
                                                       see
                                                       from
                                                       the
                                                       code
                                                       alone
```

```text
  the test for whether a comment is worth writing: if it
  restates WHAT the code does, delete it — a well-named
  identifier already says that. write one only for the WHY —
  a non-obvious constraint, a workaround for a specific bug,
  a reason a reader would otherwise "fix" the code back into
  something broken.
```

```text
  a comment that describes what code does DRIFTS the moment
  the code changes and the comment doesn't — a stale
  what-comment is worse than no comment, because it actively
  lies. a why-comment about an external constraint (a
  library's quirk, a spec requirement) drifts far less, since
  the constraint doesn't change just because the code around
  it does.
```

## Consistency over cleverness

```text
  a codebase with FIVE different ways to do the same simple
  thing (fetch a value, check for null, format a date) forces
  every reader to learn five patterns instead of one — even
  if each individual pattern is reasonable in isolation.

  → prefer the boring, ALREADY-ESTABLISHED way of doing
    something in a given codebase over a technically superior
    but novel approach, unless the improvement is large enough
    to justify a codebase-wide migration, not just one usage.
```

## What to take away

1. A name is a reader's first and cheapest piece of documentation — struggling
   to name something well is usually a sign it does more than one thing.
2. A function mixing high-level steps with low-level detail is harder to read
   than either alone; extracting the detail into named functions lets a
   reader follow a sequence of named steps.
3. The right size heuristic for a function is "can you describe it in one
   sentence without 'and'," not a line count.
4. A comment that restates what the code does will drift and eventually lie;
   write one only for the why — a constraint or reason the code alone can't
   convey.
5. Prefer the codebase's already-established boring pattern over a novel,
   technically-superior one for a single usage — consistency reduces the
   number of patterns every reader has to learn.
