---
title: Design patterns
minutes: 17
summary: The classic catalogue, when each is genuinely warranted, and the cost of applying one where it isn't.
---

Design patterns are named solutions to recurring problems — the value is
almost entirely in the NAME, which lets a team say "this needs a Strategy"
instead of re-describing the shape from scratch. The failure mode is applying
a pattern because it's known, not because the problem it solves is present.

## Strategy

```text
  the problem: an algorithm needs to vary independently of the
  code that uses it.

    class PriceCalculator {
      calculate(order, discountStrategy) {
        return discountStrategy.apply(order.total);
      }
    }
    new PriceCalculator().calculate(order, new BlackFridayDiscount());
    new PriceCalculator().calculate(order, new LoyaltyDiscount());
```

```text
  → warranted when there are genuinely MULTIPLE
    interchangeable algorithms, chosen at runtime. NOT
    warranted for "there's currently one discount type" — that's
    a plain function, and wrapping it in a Strategy interface
    adds a class hierarchy for a choice that doesn't exist yet.
```

## Observer

```text
  the problem: multiple things need to react when one thing
  changes, without the changing thing knowing who's listening.

    class OrderStatus {
      #listeners = [];
      subscribe(fn) { this.#listeners.push(fn); }
      setStatus(s) { this.status = s; this.#listeners.forEach(fn => fn(s)); }
    }
```

```text
  → this is the Event Bus's own shape, generalized — any
    publish/subscribe mechanism (this project's Event Bus, a
    DOM event listener, a React effect subscribing to a store)
    IS the Observer pattern under a more specific name.
```

## Factory

```text
  the problem: object CREATION needs logic (which concrete
  type, based on what) that the caller shouldn't need to know.

    function createShape(type: "circle" | "square"): Shape {
      return type === "circle" ? new Circle() : new Square();
    }
```

```text
  → warranted when construction genuinely branches on
    something. NOT warranted as a reflex for every class — a
    factory function wrapping a single `new ClassName()` call,
    with no branching, adds a layer of indirection for
    nothing.
```

## Decorator

```text
  the problem: adding behavior to an object WITHOUT changing
  its class or the classes of others like it.

    function withLogging(fn) {
      return (...args) => {
        console.log('calling', fn.name);
        return fn(...args);
      };
    }
    const loggedCharge = withLogging(charge);
```

```text
  → this is exactly the shape of Express/Koa MIDDLEWARE, and
    of a React higher-order component — "wrap this thing, add
    behavior, delegate to the original" recurs constantly under
    different names once you recognize the shape.
```

## Singleton — the pattern most often misused

```text
  class Database {
    static #instance: Database;
    static getInstance() {
      return this.#instance ??= new Database();
    }
  }
```

```text
  the problem this ACTUALLY solves: ensuring exactly one
  instance exists (a hardware resource, a single log file
  handle).

  the problem it's usually reached for INSTEAD: "I want global
  access to this thing," which introduces GLOBAL MUTABLE STATE
  — every test now has to worry about the singleton's state
  leaking between tests, and every consumer has an invisible
  dependency the function signature doesn't reveal.
```

```text
  → prefer DEPENDENCY INJECTION (pass the instance explicitly
    to what needs it) over a Singleton for "I only want to
    construct this once" — construct it once at startup and
    pass it down, rather than letting anything reach for a
    global at any time.
```

## Adapter

```text
  the problem: two interfaces need to work together but don't
  match.

    class LegacyPaymentAPI { makePayment(amountInCents) {...} }
    class PaymentAdapter implements ModernPaymentInterface {
      constructor(private legacy: LegacyPaymentAPI) {}
      pay(amount: Money) { this.legacy.makePayment(amount.cents); }
    }
```

```text
  → this is the exact shape of wrapping a third-party API
    behind your own interface — the same "don't let an
    external dependency's shape leak through your whole
    codebase" reasoning as depending on an abstraction rather
    than a concrete SDK directly (Dependency Inversion, from
    the OOP chapter).
```

## The cost of applying one where it isn't warranted

```text
  every pattern trades DIRECTNESS for FLEXIBILITY that must
  actually be needed to be worth it:

    a Strategy with one implementation       = an interface
                                                for a choice
                                                that doesn't
                                                exist
    a Factory with no branching                = indirection
                                                around a
                                                single `new`
    a Singleton reached for as "global access" = hidden
                                                dependencies
                                                and test
                                                pollution

  → the tell, in every case: could you describe the actual
    current need with a plain function or a direct
    instantiation? if yes, the pattern is solving a problem
    you don't have yet, and "yet" may never arrive.
```

## What to take away

1. A pattern's value is mostly the shared name — recognizing "this needs a
   Strategy" is faster than re-deriving the shape, but only when the problem
   the pattern solves is actually present.
2. Observer generalizes to any publish/subscribe mechanism — an Event Bus, a
   DOM listener, a store subscription are all the same pattern under
   different names.
3. Singleton is the most commonly misapplied pattern — "I want global access"
   is usually better solved with dependency injection, constructing once at
   startup and passing the instance down explicitly.
4. Decorator is the shape behind middleware and higher-order components:
   wrap, add behavior, delegate to the original.
5. The tell for an unwarranted pattern: if the current need could be
   described with a plain function or direct instantiation, the pattern is
   solving a problem that doesn't exist yet — and may never arrive.
