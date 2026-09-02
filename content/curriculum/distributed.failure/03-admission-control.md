---
title: Admission control and load shedding
minutes: 18
summary: Refusing work is what keeps the accepted work succeeding, and doing it well is counter-intuitive.
---

A system that accepts more work than it can complete does not complete more work
— it completes less, because everything queues until it times out and the effort
is discarded. Deliberately refusing excess is what keeps throughput positive
under overload, and it is the single most effective resilience technique
available.

## Why accepting everything is worse

```text
  ACCEPT EVERYTHING                 SHED THE EXCESS

  arrival: 1000/s                   arrival: 1000/s
  capacity: 600/s                   capacity: 600/s

  queue grows unboundedly           600/s accepted → SUCCEED
  latency climbs past every         400/s rejected immediately
  client timeout                    → clients can retry elsewhere,
  → work is done and DISCARDED        degrade, or show an error
  → goodput approaches ZERO         → goodput = 600/s
```

**Goodput** — useful work completed, not requests accepted — is the metric that
matters. Under overload without shedding, goodput collapses to near zero while
utilisation reads 100%: the server is maximally busy producing nothing, because
every response arrives after the client stopped waiting.

That is the counter-intuitive core: **rejecting work increases the amount of work
you complete.**

## Detecting overload

Choosing the signal is most of the design. Three, in increasing quality:

```text
  UTILISATION (CPU, memory)
    - lags; by the time CPU is 100% the queue is already deep
    - a system can be overloaded at 40% CPU if it is I/O bound

  QUEUE DEPTH
    + direct measure of backlog
    + cheap to read
    - needs a threshold, which needs tuning per service

  LATENCY / QUEUE TIME       ← the best signal
    + measures exactly what the user experiences
    + self-calibrating: it rises when you are overloaded, whatever
      the cause
```

**Queueing time — how long a request waited before processing started — is the
best single signal**, because it isolates the queue from the work. If requests
are waiting 500 ms before anyone looks at them, you are overloaded, regardless of
CPU, memory, or what the dependency is doing.

```python
def should_shed(request):
    queue_time = now() - request.enqueued_at
    if queue_time > MAX_QUEUE_TIME:          # e.g. 100 ms
        return True
    # and: if the deadline has already passed, do not start at all
    if request.deadline and now() > request.deadline:
        return True                          # nobody is listening
    return False
```

That second check is free and frequently forgotten: **a request whose deadline
has expired should never be started.** The client has given up. Doing the work is
pure waste at the worst possible moment, and dropping it is the cheapest capacity
you will ever recover.

## Shedding well

Not all requests are equal, and shedding indiscriminately wastes the opportunity.

```text
  SHED FIRST                        PROTECT
  ──────────                        ───────
  retries (marked as such)          first attempts
  batch and background work         interactive user requests
  free-tier traffic                 paying customers
  requests already past deadline    requests with time left
  expensive analytical queries      cheap point lookups
  bots and crawlers                 humans
```

Shedding retries first is the highest-value rule, because it does two things at
once: it protects real users, and it directly counteracts the retry amplification
that caused the overload. It requires clients to mark retries — a single header —
which is a small piece of cross-team coordination worth doing in advance.

```python
PRIORITY = {"interactive": 0, "batch": 1, "retry": 2, "bulk": 3}

def shed_level(load_factor):
    # progressively shed lower-priority classes as pressure rises
    if load_factor > 0.95: return 0   # shed everything but critical
    if load_factor > 0.85: return 1
    if load_factor > 0.75: return 2
    return 99                          # shed nothing
```

Progressive shedding by class degrades gracefully instead of falling off a cliff,
and it means the first thing users notice is that background features got slower.

## Rejecting properly

```text
  □  REJECT EARLY — before parsing a body, before acquiring a
     connection, before touching a database. A rejection that
     costs as much as the work is not shedding.

  □  RETURN 429 (or 503) WITH Retry-After — tell the client how
     long to wait, so it backs off by an amount you chose rather
     than one it guessed.

  □  MAKE IT CHEAP — rejection must cost near zero, or you
     cannot shed your way out of an overload.

  □  MONITOR IT — shed rate is a first-class metric, and a
     sudden rise is the earliest signal of trouble.
```

The `Retry-After` header is under-used and disproportionately effective: it turns
a stampede of independently-guessed backoffs into a coordinated one you control.

## Concurrency limits, and finding them automatically

The simplest form of admission control is a cap on in-flight requests:

```text
  in_flight >= LIMIT  →  reject immediately
```

The difficulty is choosing `LIMIT`. Set statically it is wrong whenever
conditions change — a slower dependency, a bigger instance, a different query
mix.

**Adaptive limits** solve this by treating it as congestion control, using the
same algorithms TCP uses:

```text
  measure latency continuously
  if latency is stable      →  increase the limit (additive)
  if latency is climbing    →  decrease the limit (multiplicative)

  → the limit converges on the actual capacity, and follows it
    as conditions change
```

Netflix's `concurrency-limits` library is the well-known implementation, and the
underlying idea (Little's Law plus gradient descent on latency) is simple enough
to implement. The appeal is that it needs no tuning and adapts automatically —
which is exactly what a static threshold cannot do.

## Where to put it

```text
  EDGE / GATEWAY        cheapest rejection, protects everything behind it
                        but knows least about per-service capacity

  PER SERVICE           knows its own capacity and priorities
                        the excess has already crossed the network

  PER DEPENDENCY        the bulkheads from the previous chapter
```

**All three, layered.** The edge sheds gross overload and obvious abuse cheaply;
each service protects itself with an adaptive concurrency limit; bulkheads
protect each dependency path. Each layer catches what the one before could not
see.

## The queue that should be bounded

Every queue in the system is an admission-control decision that was made
implicitly. An unbounded queue converts an overload into a memory exhaustion and
a latency collapse, as the streaming chapter described.

```text
  □  HTTP server accept backlog
  □  application work queues
  □  connection pool wait queues
  □  channel/buffer sizes between stages
  □  message consumer prefetch
```

Every one should have a bound and an explicit behaviour when full. The default in
most libraries is unbounded, which is the wrong default and worth auditing.

## What to take away

1. Accepting more than you can complete collapses goodput to near zero while
   utilisation reads 100% — rejecting work increases the work you finish.
2. Queueing time is the best overload signal: it measures the backlog directly
   and self-calibrates whatever the cause.
3. Never start a request whose deadline has passed — it is free capacity.
4. Shed retries first: it protects users and counteracts the amplification that
   caused the overload.
5. Reject early and cheaply, and return `Retry-After` so clients back off by an
   amount you chose.
6. Adaptive concurrency limits converge on real capacity using TCP-style
   congestion control, and need no tuning; bound every queue explicitly.

Next: graceful degradation — what to serve when you cannot serve everything.
