---
title: TypeScript
minutes: 18
summary: Structural typing and narrowing — applying the Designing with Types chapter's discipline in a language built to check it for you.
---

TypeScript's type system is structural, not nominal — two types are
compatible if their SHAPES match, regardless of name. That single design
choice explains most of what feels surprising coming from a nominally-typed
language, and it's the foundation everything else in this chapter builds on.

## Structural typing

```text
  interface Point { x: number; y: number; }
  interface Vector { x: number; y: number; }

  function distance(p: Point) { ... }
  const v: Vector = { x: 1, y: 2 };
  distance(v);   // ✓ compiles — Vector has EVERY property
                    Point requires, regardless of the type
                    NAME being different
```

```text
  → this is "duck typing, but checked at compile time" — if it
    has the right shape, it's assignable, whatever it's called.
    the practical consequence: an object literal satisfying an
    interface doesn't need to explicitly `implements` it, and
    two unrelated libraries' types can be interchangeable if
    their shapes happen to match.
```

```text
  the surprise this causes: EXCESS PROPERTIES are only checked
  on an OBJECT LITERAL assigned directly, not through a
  variable:

    distance({ x: 1, y: 2, z: 3 });        // ✗ error — excess
                                               property check
                                               on the literal
    const p3d = { x: 1, y: 2, z: 3 };
    distance(p3d);                          // ✓ compiles — no
                                               excess check
                                               once it's gone
                                               through a
                                               variable
```

## Generics: types parameterized like functions

```text
  function first<T>(arr: T[]): T | undefined { return arr[0]; }

  first([1,2,3]);       // T inferred as number
  first(['a','b']);      // T inferred as string
```

```text
  → a generic is a TYPE-LEVEL PARAMETER — `first` doesn't need
    a version per element type; T is filled in per call site,
    the same way a function's regular parameter is filled in
    per call. this is what makes a single `Array<T>`,
    `Result<T, E>` or `Repository<T>` definition work for every
    concrete type it's used with, without duplicating the
    definition.
```

## Narrowing: how TypeScript follows your control flow

```text
  function process(value: string | number) {
    if (typeof value === 'string') {
      value.toUpperCase();   // TypeScript KNOWS value is
                                string here — it NARROWED the
                                union based on the typeof check
    } else {
      value.toFixed(2);       // and knows it's number HERE
    }
  }
```

```text
  → TypeScript tracks control flow and narrows a union type
    within each branch — this is the mechanical enforcement
    behind the Designing with Types chapter's discriminated
    union: a `switch (action.type)` narrows the union inside
    each `case`, giving you exactly the fields that variant
    has, with no manual casting.
```

```text
  the narrowing that DOESN'T survive:

    if (typeof obj.value === 'string') {
      doSomethingAsync().then(() => {
        obj.value.toUpperCase();   // ✗ error — narrowing does
                                       NOT survive across an
                                       async boundary, because
                                       obj.value could have
                                       changed by the time the
                                       callback runs
      });
    }
```

## `any` vs `unknown`

```text
  function processAny(data: any) {
    data.whatever.you.want();   // compiles — no checking AT
  }                                ALL, defeats the type system
                                   entirely for this value

  function processUnknown(data: unknown) {
    data.whatever();             // ✗ error — must NARROW
                                     before using it at all
    if (typeof data === 'object' && data !== null) {
      // now some operations are allowed, based on what was
      // actually checked
    }
  }
```

```text
  → `unknown` is the type-safe version of "I don't know this
    type yet" — it FORCES a narrowing check before any
    operation, where `any` just opts the value out of checking
    entirely. `any` should be rare and deliberate (an escape
    hatch for a specific, documented reason); `unknown` is the
    correct default for genuinely unknown external input (a
    JSON.parse result, an API response before validation).
```

## Modeling a domain the compiler checks

```text
  this is the type-design chapter's illegal-states-
  unrepresentable discipline, and TypeScript is simply where
  this project applies it directly:

    type LoadState<T> =
      | { status: "idle" }
      | { status: "loading" }
      | { status: "success"; data: T }
      | { status: "error"; error: string };
```

```text
  → a component destructuring this union in a switch gets
    exhaustiveness checking for free — adding a FIFTH status
    later and forgetting to handle it in one of the switches
    that consume it is a COMPILE ERROR, not a runtime gap
    discovered by a user hitting the unhandled case.
```

## Where TypeScript's checking actually stops

```text
  const arr = [1, 2, 3];
  const item = arr[10];    // TypeScript types this as
                              `number`, not `number | undefined`
                              — even though index 10 doesn't
                              exist and this is actually
                              `undefined` at runtime
```

```text
  → TypeScript's type system is SOUND for the language
    constructs it models directly, but array indexing is a
    known gap (the `noUncheckedIndexedAccess` compiler flag
    closes it, at the cost of a null check on every array
    access) — the type system checks what you TOLD it, not
    what's actually guaranteed at runtime, and this is one of
    the few places those two genuinely diverge without an
    opt-in flag.
```

## What to take away

1. TypeScript's typing is structural — two types are compatible if their
   shapes match, regardless of name, which is why an unrelated interface's
   value can satisfy a function's parameter type.
2. A generic is a type-level parameter, filled in per call site the same way
   a function's regular parameter is — this is what lets one `Repository<T>`
   definition serve every concrete type.
3. Narrowing is how a discriminated union's compile-time enforcement
   actually works — a switch on the discriminant narrows each case to its
   exact fields, though narrowing doesn't survive an async boundary.
4. `unknown` forces a narrowing check before use; `any` opts a value out of
   checking entirely — `unknown` is the correct default for genuinely
   unvalidated external input.
5. TypeScript checks what you told it, not what's actually guaranteed at
   runtime — plain array indexing is a real, known gap between the two
   unless `noUncheckedIndexedAccess` is enabled.
