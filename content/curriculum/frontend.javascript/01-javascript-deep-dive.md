---
title: JavaScript deep dive
minutes: 19
summary: Closures, the event loop, and coercion — the language mechanics that make React's rules and Node's async model actually make sense.
---

Nearly every "why does this framework behave this way" question traces back
to a JavaScript language mechanic underneath it — a stale closure in a React
effect, a promise that resolves in an unexpected order, an equality check
that silently coerces. This chapter is those mechanics, deliberately deeper
than "learn JS basics."

## Closures: not magic, just scope that outlives its call

```text
  function makeCounter() {
    let count = 0;
    return () => ++count;
  }
  const counter = makeCounter();
  counter();  // 1
  counter();  // 2
```

```text
  → the returned function keeps a REFERENCE to `count`'s
    variable, not a copy — `makeCounter`'s call has finished,
    but its local scope isn't garbage-collected because the
    returned closure still points into it. this is the entire
    mechanism behind a React hook's local state persisting
    between renders, and behind the "stale closure" bug below.
```

```text
  the stale-closure bug, concretely:

    function Timer() {
      const [count, setCount] = useState(0);
      useEffect(() => {
        setInterval(() => setCount(count + 1), 1000);
        // ✗ this closure captured `count` as it was on the
        //   render that scheduled the interval — it NEVER
        //   sees a later render's count, so it always sets
        //   count to 1
      }, []);
    }

  → the fix is either an updater function (setCount(c => c+1),
    which doesn't need to read the closed-over value at all)
    or including `count` in the dependency array — either way,
    the bug IS a closure capturing an old value, not a React
    bug.
```

## Prototypes: how "class" actually works

```text
  class Animal { speak() { return "..."; } }
  class Dog extends Animal {}
  new Dog().speak();   // "..." — found via the PROTOTYPE CHAIN
```

```text
  → JavaScript's `class` syntax is SUGAR over prototype-based
    inheritance: every object has an internal link
    (`__proto__`) to another object, and a property lookup
    walks up that chain until it finds the property or runs out
    of chain. `class`/`extends` just wire up that chain for you
    — understanding the chain is what makes `Object.create`,
    mixins, and "why does changing a prototype affect every
    existing instance" make sense.
```

## The event loop

```text
  CALL STACK          synchronous code, executes immediately

  MICROTASK QUEUE      promise callbacks (.then, async/await
                       continuations) — drains COMPLETELY
                       before the next macrotask

  MACROTASK QUEUE       setTimeout, setInterval, I/O callbacks
                       — one runs per event loop tick, AFTER
                       the microtask queue is fully empty
```

```text
  console.log('1');
  setTimeout(() => console.log('2'), 0);
  Promise.resolve().then(() => console.log('3'));
  console.log('4');

  // OUTPUT: 1, 4, 3, 2
  // not 1, 2, 3, 4 — synchronous code runs first (1, 4),
  // then ALL microtasks (3), THEN the macrotask (2), even
  // though setTimeout was scheduled with a 0ms delay
```

```text
  → "setTimeout(fn, 0)" does not mean "run immediately" — it
    means "run after the current synchronous code AND every
    pending microtask finishes." this ordering is precisely
    why a promise chain can appear to run "before" a timer that
    was scheduled first.
```

## Promises and async/await

```text
  async function getUser(id) {
    const res = await fetch(`/users/${id}`);
    return res.json();
  }

  → `async/await` is SYNTAX over promises, not a different
    mechanism — `await` pauses the function (without blocking
    the thread — everything else keeps running) until the
    promise settles, then resumes with the result or throws
    the rejection as a catchable exception.
```

```text
  const [a, b] = await Promise.all([fetchA(), fetchB()]);
                                      ✓ both requests START
                                        immediately, run
                                        CONCURRENTLY

  const a = await fetchA();
  const b = await fetchB();
                                     ✗ fetchB doesn't even
                                        START until fetchA
                                        finishes — sequential,
                                        not concurrent, despite
                                        looking similar
```

```text
  → this is a common, easy-to-miss performance bug: two
    independent async calls awaited one after another run
    SEQUENTIALLY, doubling the wait, purely because of where
    the `await` keywords are placed relative to when each call
    actually starts.
```

## Coercion and equality

```text
  '5' == 5      // true  — COERCES types before comparing
  '5' === 5     // false — no coercion, compares type AND value

  [] == false   // true  — [] coerces to '' , then to 0;
                            false coerces to 0
  NaN === NaN   // false — NaN is defined to never equal
                            itself, by IEEE 754
```

```text
  → use === by default; === has no coercion surprises to
    reason about. `==`'s coercion RULES are memorizable but
    genuinely non-obvious ([] == false being true trips up
    experienced developers), and a linter rule banning `==`
    entirely removes an entire category of bug for free.
```

## Modules: how imports actually resolve

```text
  → ES MODULES (import/export) are STATICALLY analyzable —
    the import graph is known at BUILD time, which is what
    makes tree-shaking possible (frontend.build)
  → COMMONJS (require) resolves DYNAMICALLY at runtime — a
    require() call can be conditional, inside an if-statement,
    in a way a static import cannot
```

```text
  → this is why a bundler can eliminate unused exports from an
    ES module but generally cannot from a CommonJS one — tree-
    shaking needs the import graph to be knowable WITHOUT
    running the code, and CommonJS's dynamic resolution makes
    that determination impossible in the general case.
```

## What to take away

1. A closure is a function retaining a live reference to its enclosing
   scope, not a copy — this is both what makes local state persist between
   renders and the exact mechanism behind a stale-closure bug.
2. `class`/`extends` are syntax over the prototype chain, a lookup that
   walks from object to object until it finds a property or runs out of
   chain.
3. Microtasks (promises) drain completely before the next macrotask
   (setTimeout) runs, which is why `setTimeout(fn, 0)` doesn't mean "run
   immediately" and a promise chain can appear to run before an
   earlier-scheduled timer.
4. Two independent awaits placed sequentially run sequentially, not
   concurrently — `Promise.all` is what starts them together.
5. Use `===` by default; `==`'s coercion rules produce genuinely
   counter-intuitive results (`[] == false`) that a linter can eliminate
   entirely rather than asking anyone to memorize them correctly every time.
