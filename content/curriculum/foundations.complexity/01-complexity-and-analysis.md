---
title: Complexity and analysis
minutes: 18
summary: Big-O as a promise about growth, and amortized analysis as the tool that makes an occasionally-expensive operation look cheap on average.
---

Big-O notation is frequently taught as a mechanical exercise — count the
loops, write the formula. Its actual purpose is predicting how an
algorithm's cost SCALES before you've run it on real-sized input, which is a
genuinely different skill than counting operations in a specific example.

## What Big-O actually promises

```text
  O(n)     cost grows LINEARLY with input size
  O(n²)    cost grows QUADRATICALLY
  O(log n) cost grows LOGARITHMICALLY — barely at all, even
           for huge n (log₂ of a billion is under 30)
```

```text
  → Big-O describes the GROWTH RATE, not the actual runtime —
    it deliberately DROPS constants and lower-order terms:
    O(3n + 100) is written O(n), because for large enough n,
    the constant 3 and the +100 become irrelevant compared to
    n's own growth. this is why an O(n) algorithm with a large
    constant factor can be SLOWER than an O(n log n) one for
    realistic input sizes — Big-O promises which one wins
    EVENTUALLY, as n grows without bound, not which one is
    faster at n=100 (the Performance Engineering chapter's
    small-n constant-factor point is this exact caveat).
```

## The complexity classes, ordered

```text
  O(1)        constant           array index, hash lookup
  O(log n)     logarithmic        binary search
  O(n)          linear             a single scan
  O(n log n)     linearithmic       an efficient sort
  O(n²)           quadratic          nested loops over the
                                     same input
  O(2ⁿ)             exponential        trying every subset
  O(n!)               factorial          trying every ordering
```

```text
  → the gap between O(n log n) and O(n²) matters enormously at
    scale, in a way intuition undersells: at n=1,000,000, n log
    n is roughly 20 million operations; n² is a TRILLION — the
    difference between "runs in under a second" and "does not
    finish in your lifetime" on the same input size.
```

## Best, worst, and average case

```text
  a single algorithm can have DIFFERENT complexities depending
  on the INPUT, not just the input SIZE:

    quicksort:  average case O(n log n), WORST case O(n²)
                (already-sorted input, with a naive pivot
                choice, degrades to quadratic)

  → "quicksort is O(n log n)" is an incomplete claim without
    specifying WHICH case — this is precisely why production
    sort implementations either randomize the pivot choice or
    fall back to a different algorithm when they detect
    worst-case-triggering input patterns, rather than trusting
    the average case blindly.
```

## Amortized analysis: expensive sometimes, cheap on average

```text
  a dynamic array (JavaScript's Array, a Vector/ArrayList) that
  doubles its capacity when full:

    push 1: array full → ALLOCATE NEW (size 2), copy 1 element
    push 2: fits
    push 3: array full → ALLOCATE NEW (size 4), copy 3 elements
    push 4: fits
    push 5: array full → ALLOCATE NEW (size 8), copy 7 elements
    ...
```

```text
  → any INDIVIDUAL push CAN be O(n) (the resize-and-copy case)
    — but AMORTIZED over a sequence of n pushes, the TOTAL cost
    of all the resizing is O(n), making each push O(1)
    amortized. this is not an approximation or a hand-wave —
    it's a precise mathematical claim: the geometric growth
    (doubling) means the total copying work across all resizes
    sums to less than 2n, however many pushes happened.
```

```text
  → this is WHY doubling (not adding a fixed amount) is the
    standard growth strategy: growing by a CONSTANT amount each
    time (say, +10 capacity) makes EVERY resize copy roughly the
    same amount, giving O(n) amortized cost PER PUSH instead of
    O(1) — the growth factor being multiplicative rather than
    additive is the entire mechanism that makes amortized O(1)
    possible.
```

## Space complexity

```text
  the SAME analysis applies to MEMORY, not just time — an
  algorithm using O(n) extra space allocates memory proportional
  to input size; O(1) space means using a constant amount
  REGARDLESS of input size (in-place operations).

  → there is frequently a TIME-SPACE TRADE-OFF: memoization
    (the Algorithms chapter's dynamic programming) trades O(n)
    or more extra space to turn an exponential-time algorithm
    into a polynomial one — a real trade deliberately made, not
    a free win.
```

## Reasoning about cost before measuring

```text
  the practical skill this chapter builds toward: given a
  proposed algorithm, estimate its complexity BEFORE
  implementing and benchmarking it — "this does a nested loop
  over the input, so it's at least O(n²)" is a five-second
  mental check that catches a large class of design mistakes
  before any code is written, let alone profiled.
```

```text
  → this doesn't replace measurement (the Performance
    Engineering chapter's "measure before optimizing" still
    applies to REAL performance work) — it's a cheap FIRST
    filter: a proposed approach that's obviously exponential
    for the expected
    input size doesn't need a benchmark to rule out.
```

## What to take away

1. Big-O describes growth rate as input size increases without bound, not
   actual runtime at a specific size — an algorithm with a better Big-O can
   still be slower at realistic small n due to constant factors.
2. The gap between O(n log n) and O(n²) is enormous at real scale (20
   million vs a trillion operations at n=1,000,000), which intuition tends
   to undersell.
3. A single algorithm's complexity can depend on the input, not just its
   size — "quicksort is O(n log n)" is incomplete without specifying average
   vs worst case.
4. Amortized analysis is a precise claim, not a hand-wave: a dynamic array's
   doubling strategy makes any individual push potentially O(n) but the
   total cost across n pushes O(n), giving O(1) amortized per push —
   doubling specifically, not additive growth, is what makes this work.
5. Estimating complexity before implementing is a cheap first filter for
   catching an obviously-bad design, distinct from — and not a replacement
   for — measuring real performance before optimizing.
