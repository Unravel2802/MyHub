---
title: Bulkheads and blast radius
minutes: 18
summary: Compartments that stop one failure flooding the whole system.
---

A ship's hull is divided into compartments so that a breach floods one section
rather than sinking the vessel. The same idea is the most reliable structural
defence in distributed systems: **accept that things will fail, and bound what
each failure can take with it.**

## The failure bulkheads prevent

Without isolation, one slow dependency consumes a shared resource and everything
using that resource fails:

```text
  a service with ONE thread pool of 100

  /search    calls the search service (normal: 20 ms)
  /checkout  calls the payment service (normal: 200 ms)

  the payment service degrades to 30 seconds
     ↓
  checkout requests occupy threads for 30s each
     ↓
  all 100 threads are held by checkout
     ↓
  /search fails — with no search problem at all
```

Search was healthy, its dependency was healthy, and it stopped working because
something unrelated shared its thread pool. This is the exact failure bulkheads
prevent, and it is common.

## Resource pools per dependency

```text
  SHARED POOL                       BULKHEADED

  ┌────────────────────┐            ┌─────────┬─────────┬─────────┐
  │  100 threads       │            │ search  │ payment │ default │
  │  first come,       │            │   40    │   30    │   30    │
  │  first served      │            └─────────┴─────────┴─────────┘
  └────────────────────┘
  one slow dependency                a slow payment service exhausts
  takes everything                   only its own 30
```

```python
POOLS = {
    "search":  Semaphore(40),
    "payment": Semaphore(30),
    "default": Semaphore(30),
}

def call(dependency, fn):
    pool = POOLS.get(dependency, POOLS["default"])
    if not pool.acquire(timeout=0.05):
        # fail FAST rather than queueing — the queue is the problem
        raise DependencyBusy(dependency)
    try:
        return fn()
    finally:
        pool.release()
```

Two details matter. The acquire timeout must be **short** — waiting to enter a
full bulkhead recreates the queue you were avoiding. And exceeding a bulkhead
should be a distinct, monitored error, because it is a precise saturation signal:
"the payment path is at capacity" is far more actionable than "requests are slow".

Size each pool from Little's Law and the dependency's actual capacity, as in the
RPC chapter — and deliberately size the *total* below what the process can
support, so no combination of saturated pools exhausts the process itself.

## Levels of isolation

Bulkheads exist at several granularities, with increasing cost and strength:

```text
  1. RESOURCE POOLS       separate thread/connection pools per dependency
                          cheap, in-process, no deployment change

  2. PROCESSES            separate processes per workload
                          survives a crash or memory exhaustion in one

  3. INSTANCES            separate deployments for separate concerns
                          e.g. a read fleet and a write fleet

  4. CELLS                complete, independent stacks per shard of users
                          the strongest, and the most expensive
```

## Cell-based architecture

The strongest form, and worth knowing because the largest systems converge on it.

```text
  ┌─── CELL 1 ────┐  ┌─── CELL 2 ────┐  ┌─── CELL 3 ────┐
  │ LB            │  │ LB            │  │ LB            │
  │ app servers   │  │ app servers   │  │ app servers   │
  │ cache         │  │ cache         │  │ cache         │
  │ database      │  │ database      │  │ database      │
  └───────────────┘  └───────────────┘  └───────────────┘
   users 0–33%        users 34–66%       users 67–100%

  a cell is a COMPLETE stack. cells share nothing.
```

The properties this buys:

- **A failure is confined to one cell** — a bad shard, a poisoned cache, a hot
  tenant. Blast radius is 1/N of users by construction.
- **Deploys go cell by cell**, so a bad deploy affects one cell before it is
  caught. This turns the deploy — the dominant correlated failure — into a
  bounded one.
- **Cells are a unit of capacity**: growth means more cells, and each cell's
  behaviour is known because it is small.

The costs are real: a router that maps users to cells (itself a shared component
that must be very simple and very reliable), cross-cell operations that are
awkward by design, and N times the operational surface. This is why cells appear
in large systems and not in small ones — but the *thinking* transfers at any
size: what is the blast radius of each failure, and can it be made smaller?

## The shuffle sharding trick

A refinement that gets remarkable isolation for very little cost.

```text
  8 workers, each customer assigned 2 of them

  plain sharding: customer → 1 shard
     one bad customer takes down their shard → 1/8 of customers affected

  shuffle sharding: customer → a random PAIR of workers
     8 choose 2 = 28 distinct pairs
     one bad customer degrades their 2 workers
     → another customer is fully affected only if BOTH of their
       workers overlap the bad customer's pair

  with 100 customers over 28 combinations, the chance that any
  specific other customer shares BOTH workers is small — and the
  ones who share only one still have a healthy worker to use
```

The isolation improves combinatorially with the number of combinations, and it
costs only a different assignment function. AWS uses this extensively, and it is
one of the highest-value-per-effort techniques in this topic. The requirement is
that a client can use either of its assigned workers — which is true whenever the
workers are stateless or the state is replicated.

## What to isolate

```text
  □  by DEPENDENCY   one slow downstream must not exhaust shared pools
  □  by TENANT       one customer must not affect another
  □  by WORKLOAD     batch must not starve interactive
  □  by CRITICALITY  a checkout path must not share fate with analytics
  □  by REGION       one region's failure must not propagate
  □  by DEPLOY       stage rollouts so a bad version is bounded
```

The criticality line is worth acting on early and is often skipped: the code path
that makes money should not share a thread pool, a database connection pool, or a
deployment with the code path that renders a dashboard.

## The shared components that remain

Bulkheads reduce coupling; they rarely eliminate it. What is left is worth
enumerating explicitly:

```text
  □  DNS                  everything depends on it
  □  identity / auth      every request touches it
  □  the config store     every instance reads it
  □  the router that maps users to cells
  □  the deploy pipeline
  □  the observability stack (which fails exactly when you need it)
```

For each: it must be simpler and more reliable than what it protects, and its
consumers must degrade rather than fail when it is unavailable. A cell router
that cannot serve a lookup should fall back to a cached mapping; an auth service
that is down should let already-issued tokens keep working rather than failing
every request. **The shared components are where the residual risk lives**, and
they deserve the most conservative engineering in the system.

## What to take away

1. Without isolation, one slow dependency consumes a shared pool and unrelated
   functionality fails — the most common form of unnecessary outage.
2. Per-dependency resource pools with a short acquire timeout are cheap,
   in-process, and give a precise saturation signal.
3. Isolation has levels — pools, processes, instances, cells — with increasing
   cost and strength.
4. Cells confine a failure to 1/N of users and turn a bad deploy from a global
   correlated failure into a bounded one.
5. Shuffle sharding gets combinatorially better isolation for the cost of a
   different assignment function.
6. What remains shared — DNS, auth, config, the router, observability — is where
   the residual risk lives, and every consumer of them must degrade rather than
   fail.

Next: admission control — deciding what to refuse, so that what you accept
succeeds.
