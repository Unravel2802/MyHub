---
title: Designing with types
minutes: 18
summary: Making illegal states unrepresentable, and why that beats validating for them at every call site.
---

A type system's job isn't just catching typos — used deliberately, it can
make an entire category of bug impossible to write, rather than merely
possible to catch. This chapter is that deliberate use: designing the shape
of your data so the compiler enforces invariants a comment could only ask for.

## Making illegal states unrepresentable

```text
  the recurring mistake:

    interface Request {
      status: "pending" | "success" | "error";
      data?: ResponseData;
      error?: string;
    }

  → this type permits FOUR states that shouldn't all exist:
    status="success" with error set, status="error" with data
    set, both set, neither set — the type system will happily
    let you construct any of them, and every consumer of this
    type has to defensively check combinations that should be
    impossible.
```

```text
  the fix — a DISCRIMINATED UNION, one variant per actual
  state:

    type Request =
      | { status: "pending" }
      | { status: "success"; data: ResponseData }
      | { status: "error"; error: string };

  → now "success with no data" cannot be constructed AT ALL —
    not "is checked for," ELIMINATED as a possibility. a
    switch over `status` gives you the right fields
    automatically in each branch, with no defensive checks.
```

```text
  the discriminated union is exactly how the REST API Design
  chapter's error-body spirit generalizes to any modeled
  state — status codes distinguish response shapes; a
  discriminated union's tag does the same for in-memory data.
```

## Parse, don't validate

```text
  the difference between these two, despite looking similar:

    function validateEmail(s: string): boolean { ... }
    function parseEmail(s: string): Email | null { ... }
```

```text
  VALIDATE returns a boolean and THROWS AWAY the proof — five
  lines later, a caller has a plain `string` again, with no
  type-level record that it was ever checked. every
  downstream function that needs a valid email has to
  re-validate, or trust blindly.

  PARSE returns a NEW, MORE SPECIFIC TYPE (Email) that can
  only be constructed by the parse function succeeding —
  the type ITSELF is now the proof, carried forward through
  every function signature that requires it.
```

```text
  → "parse, don't validate" is the general form of a rule
    already familiar from this project's own architecture:
    validate at the boundary, once (backend.serialization) —
    parsing converts "unchecked input" into "a type that
    cannot exist unless it was checked," which is what makes
    validating ONCE actually sufficient.
```

## Invariants a constructor enforces

```text
  class NonEmptyList<T> {
    private constructor(private items: [T, ...T[]]) {}
    static of<T>(items: T[]): NonEmptyList<T> | null {
      return items.length > 0 ? new NonEmptyList(items as any) : null;
    }
    first(): T { return this.items[0]; }  // never undefined —
                                            // the type GUARANTEES
                                            // at least one item
  }
```

```text
  → a PRIVATE constructor plus a validating static factory is
    the pattern: the only way to get an instance is through
    the factory, so every existing instance is guaranteed to
    satisfy the invariant — `.first()` needs no null check,
    ever, anywhere it's called.
```

## Newtypes: preventing mix-ups between same-shaped values

```text
  function transfer(fromAccountId: string, toAccountId: string,
                     amountCents: number) { ... }

  transfer(toId, fromId, amount)   // ✗ swapped arguments —
                                       both are `string`, so
                                       the compiler cannot
                                       catch this
```

```text
  → wrap same-shaped-but-different-meaning values in distinct
    types (a "newtype" / branded type):

    type AccountId = string & { readonly __brand: "AccountId" };

  → now `fromAccountId: AccountId` and `toAccountId: AccountId`
    are NOT interchangeable with a plain string, and — with
    two DIFFERENT branded types for "from" and "to" if the
    mix-up risk is real — not interchangeable with each other
    either. the swap becomes a compile error instead of a
    silent runtime bug.
```

## Where this stops paying off

```text
  types that model every real constraint precisely can become
  their own maintenance burden — a type so specific it needs
  updating for every new edge case is fighting the same battle
  validation would have, just moved into the type system.
```

```text
  → reach for a precise, illegal-states-eliminated type for
    data whose SHAPE is the actual source of bugs (a response
    that's either data or an error, never both) — not for
    every value in the system uniformly. the Errors and
    Failure Design chapter is exactly this territory:
    designing the ERROR shape this precisely is usually the
    highest-value place to apply it.
```

## What to take away

1. A discriminated union eliminates illegal state combinations at the type
   level rather than merely catching them with a runtime check — the
   impossible state simply cannot be constructed.
2. "Parse, don't validate" turns unchecked input into a distinct type that
   carries proof of validation forward, which is what makes validating once,
   at the boundary, actually sufficient downstream.
3. A private constructor plus a validating static factory guarantees every
   existing instance already satisfies an invariant, eliminating null/empty
   checks everywhere that instance is used.
4. Branded/newtype wrappers turn a same-shaped-argument mix-up (swapped ids
   of the same underlying type) into a compile error instead of a silent
   runtime bug.
5. This pays off most where a value's shape is the actual source of bugs —
   applying it uniformly to everything just moves validation's maintenance
   burden into the type system instead of eliminating it.
