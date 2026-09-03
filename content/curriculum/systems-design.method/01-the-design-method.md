---
title: The design interview method
minutes: 19
summary: A repeatable procedure for turning a vague requirement into a defensible architecture, out loud.
---

System design has no single right answer, which makes it hard to prepare for and
easy to do badly. What distinguishes a strong design conversation from a weak one
is not knowing more components — it is following a procedure that surfaces
constraints before committing to a shape.

## The procedure

```text
  1. REQUIREMENTS      what are we actually building?     ~5 min
  2. SCALE             how big, and what shape of load?   ~5 min
  3. API               what operations exist?             ~5 min
  4. DATA MODEL        what is stored, and how accessed?  ~5 min
  5. HIGH-LEVEL DESIGN boxes and arrows                   ~10 min
  6. DEEP DIVE         one or two components, in detail   ~10 min
  7. TRADE-OFFS        what did we give up, and why?      ~5 min
```

**The order is load-bearing.** Drawing boxes before establishing scale produces an
architecture with no justification, and the most common failure in a design
discussion is starting at step 5.

## Requirements

```text
  FUNCTIONAL          what does it DO?
    → and, critically, what does it NOT do
  NON-FUNCTIONAL      how well must it do it?
    availability · latency · consistency · durability
    · security · cost
```

```text
  the questions that change the design most

  □  how many users, and how active?
  □  read-heavy or write-heavy?
  □  can data be stale? by how much?
  □  is it global, or one region?
  □  what happens if it is down for a minute? an hour?
  □  is there a hard latency budget?
  □  what MUST be transactional?
```

**Scope aggressively.** A design that tries to cover everything covers nothing
well. Name three or four core features, say explicitly what you are excluding, and
get agreement before proceeding.

```text
  ✓  "I'll design posting, the timeline, and follows.
      I'll leave search, DMs and moderation out of scope
      unless you'd rather I cover one of those."
```

That sentence does three things: it bounds the problem, it demonstrates you know
what else exists, and it hands the choice back.

## Scale

The estimation chapter covers the arithmetic; the point here is *why* it comes
before design.

```text
  a system at 100 QPS and a system at 1,000,000 QPS are
  DIFFERENT SYSTEMS.

    100 QPS        one server, one database. done.
    1M QPS         partitioning, caching, CDN, async
                   processing, and a much larger team
```

```text
  compute, briefly and out loud

    DAU × actions/day ÷ 86,400 = average QPS
    peak ≈ 2–10× average
    storage = records × size × retention × replication
    bandwidth = QPS × payload size
```

```text
  → then state what the numbers IMPLY:

    "40k writes/second means a single Postgres primary
     won't do it, so we need partitioning or a different
     store. Reads at 400k/second are 10:1, so caching
     should absorb most of that."
```

The numbers are only useful if you draw a conclusion from them. Reciting
arithmetic without saying what it rules in or out is a common and empty ritual.

## API

```text
  define the OPERATIONS before the components.

    POST   /posts          {text, media_ids}      → post_id
    GET    /timeline       ?cursor=&limit=        → posts[]
    POST   /follows        {user_id}
    DELETE /follows/{id}
```

```text
  what to be deliberate about
    □  CURSOR pagination, not offset — offset breaks when
       items are inserted (the ordering chapter's point)
    □  idempotency keys on writes
    □  what the client sends versus what the server derives
    □  versioning, if it is a public API
```

The API is where the requirements become concrete, and it frequently reveals that
a requirement was ambiguous — which is much cheaper to discover here than after
drawing an architecture.

## Data model

```text
  ENTITIES        users, posts, follows
  RELATIONSHIPS   cardinality, and which direction is queried
  ACCESS PATTERNS the deciding factor

  → design for the QUERIES, not for normalisation
```

```text
  "get a user's timeline" is the query that shapes a social
  product's entire architecture.

  it is not "select from posts where author in (follows)" —
  that query does not scale, and the whole design exists to
  avoid it.
```

Stating the hot query explicitly, and then observing that it cannot be served
directly, is the move that motivates fan-out, caching and denormalisation. It is
far more convincing than introducing them as known patterns.

## High-level design

```text
  clients
     │
   [CDN]  ── static and media
     │
  [load balancer]
     │
  [API gateway]  auth, rate limiting
     │
  ┌──┴────────────┬──────────────┐
  │               │              │
 [service A]   [service B]   [service C]
  │               │              │
  ├── [cache]     ├── [cache]    │
  ├── [database]  ├── [database] │
  └───────────────┴──────────────┴──▶ [queue] ──▶ [workers]
```

```text
  □  start SIMPLE and add under pressure — introduce each
     component because a number demanded it
  □  say what each box IS: "a Redis cache", not "cache"
  □  draw the READ path and the WRITE path separately if
     they differ, which they usually do
```

**Justify every component.** "We add a cache because 400k reads/second against
Postgres won't work, and the read:write ratio is 10:1 so the hit rate should be
high" is a design decision. "We add a cache" is a reflex.

## Deep dive

```text
  the interviewer will steer, and if not, choose the part
  that is genuinely hardest:

    the hot path
    the partitioning scheme
    the consistency requirement
    the failure mode
```

This is where the distributed-systems material pays: partitioning by user id and
explaining what that does to the celebrity problem, or naming why a particular
operation needs a single-leader store while the rest can be eventually consistent.

## Trade-offs

```text
  every choice gives something up. SAY WHAT.

  "Fan-out on write means posting is expensive and reading
   is cheap. That's right here because reads outnumber
   writes 100:1. It breaks for accounts with millions of
   followers, so those go on a fan-out-on-read path — a
   hybrid, with the split at roughly 10,000 followers."
```

```text
  the trade-offs that recur

    consistency  ↔  availability / latency
    read cost    ↔  write cost
    storage      ↔  compute
    simplicity   ↔  scalability
    cost         ↔  performance
    latency      ↔  throughput
```

## What separates a strong design conversation

```text
  STRONG                             WEAK
  ──────                             ────
  clarifies before designing         assumes and proceeds
  numbers drive decisions            components appear by reflex
  starts simple, scales under        starts complex
    pressure
  names concrete technologies        says "a database"
  states trade-offs unprompted       claims the design is optimal
  admits uncertainty honestly        bluffs
  drives the conversation            waits to be asked
```

```text
  and the most common failures

  □  jumping to components before requirements
  □  over-engineering a problem that doesn't need it
  □  ignoring the numbers you just computed
  □  never mentioning failure
  □  silence — the reasoning is the point, not the diagram
```

**Think out loud.** The diagram is an artifact of the conversation, not the
deliverable. A design that arrives silently and correctly demonstrates less than
one reasoned through aloud with a wrong turn corrected.

## What to take away

1. Follow the order — requirements, scale, API, data model, design, deep dive,
   trade-offs — because drawing boxes before establishing scale produces an
   unjustifiable architecture.
2. Scope aggressively and say what you are excluding; it bounds the problem and
   shows you know what else exists.
3. Compute the numbers and then state what they *imply* — arithmetic with no
   conclusion is an empty ritual.
4. Design the data model for the hot query, and let its infeasibility motivate the
   architecture rather than introducing patterns by name.
5. Justify every component with a number, and name concrete technologies.
6. State trade-offs unprompted, and think out loud — the reasoning is the
   deliverable, not the diagram.

Next: the arithmetic itself.
