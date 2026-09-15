---
title: Property-based testing and fuzzing
minutes: 16
summary: Generating inputs instead of enumerating them, and letting a shrinker hand you the smallest failing case.
---

An example-based test asserts one input produces one output. A property-based
test asserts a RULE holds across a whole space of generated inputs — which
finds the edge cases a human writing examples by hand would never think to
try, precisely because they're the ones nobody thinks to try.

## Example-based vs property-based

```text
  EXAMPLE-BASED (ordinary unit test)

    test('reverse', () => {
      expect(reverse([1,2,3])).toEqual([3,2,1]);
    });
    → proves ONE specific input works. says nothing about
      an empty array, a single-element array, an array with
      duplicate values, a very large array.
```

```text
  PROPERTY-BASED

    test('reversing twice returns the original', () => {
      fc.assert(fc.property(fc.array(fc.integer()), (arr) => {
        expect(reverse(reverse(arr))).toEqual(arr);
      }));
    });
    → the library generates HUNDREDS of arrays (empty, huge,
      duplicates, negative numbers, all the same value) and
      checks the PROPERTY holds for every single one.
```

## Finding properties worth testing

```text
  the practical challenge people hit first: "I don't know what
  property to write" — a few reliable shapes:

    ROUND-TRIP        encode(decode(x)) === x, or the reverse
                      — serialization, compression, encryption
                      all have this shape

    INVARIANT          a fact that must stay true regardless
                       of input — sorting NEVER changes the
                       length or the multiset of elements,
                       only their order

    DIFFERENTIAL        two DIFFERENT implementations of the
                       same spec should agree on every input
                       — a new fast sort vs. the language's
                       built-in sort, compared on random input

    METAMORPHIC          a specific TRANSFORMATION of the
                        input has a PREDICTABLE effect on the
                        output — doubling every price in an
                        order should double the total, without
                        needing to compute what the total
                        actually equals
```

```text
  → "I can't think of a property" is frequently a sign the
    function's CONTRACT was never made explicit — reaching for
    round-trip, invariant, differential or metamorphic shapes
    as a checklist unblocks most cases that felt property-less
    at first glance.
```

## Shrinking: the actual payoff

```text
  a property fails on a randomly generated input:

    [47, -3, 892, 15, -204, 6, 71, ...]   (length 43)

  → nearly useless to debug directly. the library
    AUTOMATICALLY SHRINKS the failing input — tries smaller,
    simpler variants that still fail — until it can't shrink
    any further:

    [-3, 0]     ← the MINIMAL failing case, found automatically
```

```text
  → this is the single biggest practical advantage over just
    writing a fuzzer manually: a raw random failure is a
    debugging chore; a shrunk minimal counterexample is
    usually immediately diagnosable by inspection.
```

## Fuzzing: the same idea aimed at crashes and security

```text
  property-based testing checks a CHOSEN property against
  generated input; FUZZING generates input specifically hunting
  for CRASHES, hangs, or memory-safety violations — often with
  no explicit property at all beyond "doesn't crash" or
  "doesn't violate a sanitizer's checks."
```

```text
  → COVERAGE-GUIDED fuzzing (AFL, libFuzzer) is the meaningful
    advance over pure-random input generation: the fuzzer
    tracks which code paths each input exercises and mutates
    inputs that reach NEW paths, rather than generating
    uniformly at random — this is why coverage-guided fuzzers
    reliably find deeply-nested parser bugs that pure random
    input essentially never stumbles into.

  → fuzzing is the standard tool for anything parsing
    UNTRUSTED input (a file format, a network protocol,
    a config file) — the security relevance is direct: a
    parser that crashes on malformed input is very often the
    same parser that has an exploitable memory-safety bug on
    a more carefully crafted malformed input.
```

## Where this pays off, and where it doesn't

```text
  ✓  pure functions with a clear mathematical property (parsers,
     serializers, sorting, data structure invariants)
  ✓  anything parsing untrusted external input

  ✗  code whose correctness is fundamentally about a SPECIFIC
     business rule with no general property ("this customer
     gets exactly this discount") — an example-based test is
     more direct here, since the "property" would just be
     "reimplement the discount logic to check it against
     itself"
```

## What to take away

1. Property-based testing checks that a rule holds across a generated space
   of inputs, rather than asserting one output for one hand-picked input —
   which is what finds edge cases nobody thought to write by hand.
2. Round-trip, invariant, differential, and metamorphic are the four reliable
   shapes for finding a property when "I can't think of one" is the blocker.
3. Shrinking is the real payoff over hand-rolled fuzzing: a random 43-element
   failing case is a debugging chore, a shrunk 2-element minimal
   counterexample is usually immediately diagnosable.
4. Coverage-guided fuzzing mutates inputs that reach new code paths rather
   than generating uniformly at random, which is why it reliably finds
   deeply-nested parser bugs pure-random input essentially never reaches.
5. This pays off for pure functions with a real mathematical property and
   anything parsing untrusted input — a business rule with no general
   property is usually better served by a direct example-based test.
