---
title: Memory management and garbage collection
minutes: 18
summary: Stack vs heap, and the pauses a tracing collector trades for never having to think about freeing memory.
---

Every language sits somewhere on a spectrum between "you manage memory
yourself, entirely" and "the runtime manages it for you, entirely" —
understanding where a given language sits, and what that costs, explains a
whole category of behavior that otherwise looks like magic or mystery.

## Stack vs heap

```text
  STACK      fast to allocate (just move a pointer), automatic
             cleanup (a function returns, its stack frame is
             gone) — but FIXED SIZE known at compile time, and
             scoped strictly to the function call that created
             it

  HEAP        flexible size, lives as long as needed (not tied
             to a function call) — but allocation is SLOWER
             (finding a free block) and needs EXPLICIT cleanup,
             one way or another
```

```text
  function makeArray() {
    const local = 5;              // STACK — gone when
                                      makeArray returns
    const arr = new Array(1000);  // the ARRAY OBJECT is on
    return arr;                      the HEAP — it can
  }                                   outlive this function
                                      call, which is exactly
                                      why it CAN'T live on
                                      the stack
```

```text
  → this is WHY a value that needs to outlive its creating
    function's call MUST live on the heap — the stack's whole
    speed advantage comes from a rigid, predictable lifetime
    (tied exactly to the call stack) that a returned value
    inherently violates.
```

## Manual memory management

```text
  malloc(100);   // allocate 100 bytes on the heap
  free(ptr);     // explicitly release it

  → the two classic bugs THIS approach makes possible:

    MEMORY LEAK        allocated memory NEVER freed — the
                       program's memory usage grows unboundedly
                       over time, eventually exhausting
                       available memory

    USE-AFTER-FREE       accessing memory AFTER it's been
                        freed — the memory may have been
                        REUSED for something else entirely by
                        then, making this both a correctness
                        bug and a serious SECURITY
                        vulnerability (an attacker can often
                        control what now occupies that freed
                        memory)

    DOUBLE FREE            freeing the SAME memory twice —
                        corrupts the allocator's own internal
                        bookkeeping, with unpredictable
                        consequences
```

## Reference counting

```text
  each heap object tracks HOW MANY references point to it;
  when the count hits ZERO, it's freed immediately.

    let a = { value: 1 };   // refcount: 1
    let b = a;               // refcount: 2
    a = null;                 // refcount: 1
    b = null;                  // refcount: 0 → freed
                                  IMMEDIATELY
```

```text
  → the fatal flaw: a CIRCULAR reference (A points to B, B
    points to A) NEVER reaches zero, even when nothing OUTSIDE
    the cycle references either — a plain reference-counting
    collector leaks cycles permanently. Python and Swift both
    use reference counting and both need a SEPARATE mechanism
    (a cycle detector, or WEAK references that don't count
    toward the total) specifically to handle this gap.
```

## Tracing garbage collection

```text
  instead of counting references, a tracing collector
  periodically walks the object graph FROM A SET OF ROOTS
  (global variables, the current call stack) — anything
  REACHABLE from a root is kept; anything UNREACHABLE (even
  if it's part of a cycle referencing itself) is garbage,
  freed together.

  → this is a GRAPH REACHABILITY problem (the Discrete
    Mathematics and Algorithms chapters' BFS/DFS, applied
    directly) — "is this object reachable from a root" is
    literally graph traversal, and it's why a tracing
    collector handles cycles correctly where reference counting
    can't: an unreachable cycle is still unreachable, cycle or
    not.
```

## The pause: stop-the-world

```text
  a NAIVE tracing collector must PAUSE the entire program while
  it traces — you cannot safely walk the object graph while the
  program is simultaneously mutating it underneath you.

  → this pause is USER-VISIBLE: a request that arrives during a
    GC pause waits until it's over — for a latency-sensitive
    system, an unpredictable multi-millisecond (or longer)
    pause is a real, measurable tail-latency problem, not a
    theoretical concern.
```

```text
  → modern collectors reduce this with GENERATIONAL collection
    (most objects die YOUNG — a request-scoped temporary object
    — so collecting a small "young generation" frequently, and
    a much larger "old generation" rarely, catches most garbage
    cheaply) and CONCURRENT/INCREMENTAL collection (tracing
    WHILE the program keeps running, at the cost of real
    implementation complexity to handle objects that move or
    change during the trace) — both exist specifically to
    shrink or hide the stop-the-world pause, not to eliminate
    tracing's fundamental need to walk the graph.
```

## Where each model actually lands

```text
  MANUAL (C)                fastest, zero GC pauses, but every
                            memory bug above is YOUR
                            responsibility to avoid entirely

  OWNERSHIP (Rust)            the COMPILER enforces memory
                            safety at COMPILE time (no GC
                            pause, no manual bugs possible) —
                            the Systems Programming chapter
                            covers exactly how

  GC (Java, Go, JS, Python)    the runtime handles it — trading
                            some pause time and memory overhead
                            for eliminating an entire category
                            of manual-management bugs by
                            construction
```

## What to take away

1. A value must live on the heap if it needs to outlive the function call
   that created it — the stack's speed comes from a rigid lifetime a
   returned value inherently can't satisfy.
2. Manual memory management makes leaks, use-after-free, and double-free
   possible — use-after-free is both a correctness bug and a real security
   vulnerability, since freed memory can be reused by an attacker's data.
3. Reference counting frees an object the instant its count hits zero, but
   cannot collect a circular reference on its own — which is why
   reference-counted languages need a separate cycle detector or weak
   references.
4. Tracing garbage collection is graph reachability from a set of roots,
   which is exactly why it handles cycles correctly where reference counting
   can't — an unreachable cycle is still unreachable.
5. A naive tracer must stop the program to walk the graph safely — a real,
   user-visible latency cost that generational and concurrent collection
   exist specifically to shrink, not eliminate.
