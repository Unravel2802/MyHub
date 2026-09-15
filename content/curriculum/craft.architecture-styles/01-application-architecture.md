---
title: Application architecture
minutes: 18
summary: Layered, hexagonal, and modular-monolith styles for organizing a codebase larger than one person's head can hold at once.
---

Architecture styles exist to answer one question at scale: when a codebase
gets big enough that no one holds it all in their head, what structure keeps
a change in one place from requiring understanding of everywhere else? Each
style answers that differently, and the right one depends on which kind of
change the system needs to make cheap.

## Layered architecture

```text
  ┌─────────────────────┐
  │   PRESENTATION       │  UI, API controllers
  ├─────────────────────┤
  │   BUSINESS LOGIC      │  rules, calculations, workflows
  ├─────────────────────┤
  │   DATA ACCESS          │  repositories, queries
  └─────────────────────┘

  RULE: a layer may only depend on the layer BELOW it —
  presentation calls business logic, business logic calls
  data access, never the reverse, never skipping a layer.
```

```text
  → the failure mode this rule exists to prevent: a controller
    building SQL directly (skipping the layers meant to own
    that), which means a query's logic is now scattered across
    every controller that happens to need similar data, instead
    of living in one place.

  → the failure mode when overused: a trivial CRUD operation
    forced through three layers of pass-through code that adds
    nothing — for genuinely simple operations, the ceremony can
    cost more than the boundary buys.
```

## Hexagonal (ports and adapters)

```text
  the layered model still implicitly treats the DATABASE as
  central — everything ultimately depends downward toward it.
  hexagonal architecture inverts this: the DOMAIN is the
  center, and everything external (database, HTTP, a message
  queue) is a plugin at the edge.

         [HTTP adapter]     [CLI adapter]
                \\              //
                 \\            //
              ┌───────────────────┐
              │   DOMAIN (PORTS)   │   ← the core, knows
              │                    │      nothing about HTTP,
              └───────────────────┘      SQL, or any specific
                 //            \\        technology
                //              \\
      [Postgres adapter]   [Test fake adapter]
```

```text
  → the domain defines PORTS (interfaces — "a PaymentGateway
    port," "an OrderRepository port") and never imports a
    concrete implementation; ADAPTERS on the outside implement
    those ports for a specific technology. this is Dependency
    Inversion, from the OOP chapter, applied as a whole-
    application architecture rather than one class's
    dependency.

  → the payoff: the domain can be tested with a TEST ADAPTER
    (an in-memory fake) with ZERO real infrastructure, and
    swapping Postgres for a different database means writing
    a new adapter — the domain code doesn't change at all.
```

## Modular monolith

```text
  neither "layers within one codebase" nor "ports around one
  domain" — instead, the codebase is split into MODULES, each
  a self-contained vertical slice (its own logic, its own data
  access, sometimes its own layered/hexagonal internals),
  communicating with other modules only through an explicit
  boundary.

    Module: Orders          Module: Inventory
    ┌──────────────┐        ┌──────────────┐
    │ logic + data  │◄──────►│ logic + data │
    │ access, owned  │ event  │ access, owned│
    │ by this module │  bus   │ by this      │
    └──────────────┘        │ module        │
                             └──────────────┘
```

```text
  → this is this project's OWN architecture (CLAUDE.md's rule
    1 and the Backend track's Services and Modular Monoliths
    chapter): modules never import each other's internals,
    only communicate through an Event Bus — the boundary
    discipline of microservices, without the network hop.
```

## Domain-Driven Design's contribution

```text
  DDD's most widely useful idea, independent of adopting its
  full methodology: a BOUNDED CONTEXT — the same word can mean
  different things in different parts of a system, and forcing
  one shared model everywhere is itself a design mistake.

    "Customer" in the Sales context: name, deal history,
      lead score
    "Customer" in the Billing context: name, payment method,
      invoice history

  → these don't need to be the SAME class/table just because
    they share a name — modeling them as related-but-distinct
    concepts per context, connected by an explicit translation
    at the boundary, avoids a single bloated "Customer" model
    trying to serve every team's unrelated needs at once.
```

## Choosing

```text
  LAYERED               a straightforward CRUD-heavy app,
                         small team, the database genuinely IS
                         central to what the app does
  HEXAGONAL              the domain logic is complex and
                         valuable enough to test in complete
                         isolation from infrastructure, or
                         infrastructure is likely to change
                         (multiple database backends, a
                         planned migration)
  MODULAR MONOLITH        multiple distinct business domains
                          in one deployable, each cohesive
                          enough to reason about separately —
                          this project's own shape
```

```text
  → these aren't mutually exclusive — a modular monolith's
    individual modules can each be internally layered OR
    hexagonal; the styles operate at different SCALES (the
    whole app vs. one module) and commonly compose.
```

## What to take away

1. Layered architecture's rule (depend only downward) exists to keep query
   logic from scattering across every caller that needs similar data — but
   forcing trivial CRUD through three layers of pass-through can cost more
   than the boundary buys.
2. Hexagonal architecture puts the domain at the center and infrastructure
   at the edge as swappable adapters — the same Dependency Inversion idea
   from OOP design, applied at the whole-application scale.
3. A modular monolith splits by business domain into vertical-slice modules
   communicating only through an explicit boundary — this project's own
   architecture, and the boundary discipline of microservices without the
   network hop.
4. DDD's bounded context says the same word can mean different things in
   different parts of a system — forcing one shared model everywhere is
   itself a design mistake.
5. These styles operate at different scales and commonly compose — a modular
   monolith's individual modules can each be internally layered or hexagonal.
