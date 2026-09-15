---
title: Performance engineering
minutes: 17
summary: Benchmarking that isn't lying to you, and optimizing the thing that actually costs — measured, not guessed.
---

Performance work done without measurement is performance THEATER — changes
that feel like they should help, applied to code that was never actually the
bottleneck. This chapter is the discipline that keeps optimization honest:
measure first, optimize what the measurement points at, then measure again to
confirm it worked.

## Measure before optimizing, always

```text
  the debugging chapter's flamegraph discipline, restated as
  performance work's first rule: the function that FEELS slow
  (visually dense, deeply nested) is frequently not where the
  time actually goes — a profiler answers this; intuition
  guesses at it, and guesses wrong often enough that skipping
  the measurement step is a genuine mistake, not a shortcut.
```

```text
  → optimizing a function that isn't the bottleneck wastes the
    EFFORT and, worse, often makes the code harder to read for
    a gain that doesn't exist — every optimization has a
    readability cost, and paying it where it buys nothing is
    strictly worse than not optimizing at all.
```

## Benchmarking that isn't lying to you

```text
  the naive benchmark:

    const start = Date.now();
    doWork();
    console.log(Date.now() - start);
```

```text
  what's wrong with running this once:

    ✗  JIT WARMUP — a JIT-compiled language's FIRST few calls
       to a function run in an unoptimized interpreted mode;
       the function only reaches its steady-state speed after
       enough calls trigger optimization — one run measures
       warmup, not steady-state performance

    ✗  NOISE — OS scheduling, garbage collection pauses, other
       processes on the machine — a SINGLE measurement can be
       an outlier in either direction

    ✗  DEAD CODE ELIMINATION — an optimizing compiler can
       notice a computed result is never USED and skip the
       computation entirely, measuring nothing
```

```text
  → a real benchmarking tool (not hand-rolled Date.now())
    runs many iterations, discards a warmup period, reports a
    DISTRIBUTION (median, p95) rather than one number, and
    forces the result to be used so it can't be eliminated —
    this is enough distinct failure modes that "just time it
    with Date.now()" reliably produces a misleading number.
```

## Reading a benchmark's output honestly

```text
  MEAN         pulled by outliers — one 500ms GC pause among
              a thousand 1ms runs drags the mean up
              meaningfully

  MEDIAN        the TYPICAL case, resistant to outliers

  P95/P99        what your SLOWEST users actually experience
              — a system with a great median and a terrible
              p99 is failing its unluckiest requests
              consistently, and the mean/median alone hide
              this entirely
```

```text
  → which number matters depends on the QUESTION: "is this
    faster on average" wants median; "will this violate our
    SLA for some users" wants p95/p99 — reporting only the
    mean answers neither question reliably.
```

## Complexity vs constant factors

```text
  an O(n log n) algorithm is asymptotically better than an
  O(n²) one — but for SMALL n, the O(n²) one can be FASTER in
  practice, because Big-O hides the CONSTANT FACTOR (simpler
  operations per step, better cache locality, no allocation
  overhead).

  → insertion sort (O(n²)) genuinely outperforms merge sort
    (O(n log n)) for small arrays — which is why real sort
    implementations SWITCH strategies below a size threshold,
    rather than using the asymptotically-superior algorithm
    unconditionally.
```

```text
  → algorithmic complexity matters most at SCALE; at small,
    fixed sizes, measure the actual constant-factor performance
    rather than assuming the better-Big-O option wins.
```

## Where the actual cost usually is

```text
  in a typical web application, ordered roughly by how often
  each one turns out to be the real bottleneck:

    1. an N+1 QUERY or a missing database index — the
       Relational Modeling and SQL chapter's territory, and it
       dominates almost everything else on this list when
       present
    2. an unnecessary NETWORK ROUND TRIP (sequential calls that
       could be parallel, or batched into one)
    3. SERIALIZATION overhead on a large payload
    4. actual CPU-bound computation — genuinely last on this
       list for most web applications, despite being where
       intuition points first
```

```text
  → this ordering is itself the argument for profiling instead
    of guessing: intuition points at #4 (a "slow algorithm"),
    and the real cost is very often #1, which looks nothing
    like a performance problem in the code — it looks like an
    ordinary loop over an ORM relationship.
```

## What to take away

1. Measure before optimizing — the function that feels slow is frequently
   not the actual bottleneck, and every optimization has a readability cost
   that isn't worth paying where it buys nothing.
2. A hand-rolled Date.now() benchmark is misled by JIT warmup, measurement
   noise, and dead-code elimination — a real benchmarking tool accounts for
   all three.
3. Mean is pulled by outliers; median shows the typical case; p95/p99 show
   what your slowest users actually experience — pick the statistic that
   answers your actual question.
4. Big-O hides the constant factor, which is why a worse-complexity
   algorithm can genuinely win at small sizes — real sort implementations
   switch strategies below a size threshold for exactly this reason.
5. In most web applications the real cost is an N+1 query or an unindexed
   column, not CPU-bound computation — which is precisely why profiling
   beats intuition, since intuition points at the wrong end of that list.
