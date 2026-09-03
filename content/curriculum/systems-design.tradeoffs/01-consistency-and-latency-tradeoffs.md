---
title: Consistency and latency trade-offs
minutes: 18
summary: Choosing what to give up, saying so out loud, and quantifying the cost.
---

Every interesting design decision is a trade. The skill is not knowing which
option is better — usually neither is — but naming precisely what each one costs
and matching that to what the product needs.

## The trade-offs that recur

```text
  CONSISTENCY   ↔  AVAILABILITY      (during a partition)
  CONSISTENCY   ↔  LATENCY           (all the time — PACELC)
  READ COST     ↔  WRITE COST
  STORAGE       ↔  COMPUTE
  LATENCY       ↔  THROUGHPUT
  SIMPLICITY    ↔  SCALABILITY
  COST          ↔  PERFORMANCE
  FRESHNESS     ↔  EFFICIENCY
```

**The second line is the one paid on every request**, as the PACELC chapter
established, and it is the one most design conversations skip in favour of the
first.

## Consistency, per operation

```text
  the short list that genuinely needs linearizability

    □  uniqueness (usernames, seat allocation)
    □  locks and leader election
    □  compare-and-set
    □  balances and any invariant across concurrent writes
    □  cross-channel communication (a queue that outruns
       replication)

  everything else: eventual, with a stated bound.
```

```text
  and the middle ground that users actually notice

    read-your-writes      you see your own action
    monotonic reads       time does not go backwards
    causal               a reply never precedes its parent

  → together these make a system FEEL consistent at a
    fraction of the cost of making it consistent.
```

That is the practical conclusion from the consistency track: pick eventual
globally and honour the session guarantees rigorously, and the vast majority of
products are correct as far as any user can tell.

## Read cost versus write cost

The trade that shapes most consumer architectures:

```text
  FAN-OUT ON WRITE                 FAN-OUT ON READ
  push to every follower's         assemble at read time from
  timeline at post time            the people you follow

  write: O(followers)              write: O(1)
  read:  O(1)                      read:  O(following)

  → good when reads ≫ writes       → good for celebrities and
    (most users)                     inactive users
```

```text
  the hybrid, which is what real systems do

    normal accounts   → fan-out on write
    accounts above N followers → fan-out on read
    a reader merges their pushed timeline with a pull from
    the few large accounts they follow

  the threshold is a tuning parameter, typically in the
  thousands to tens of thousands.
```

**Say the threshold and why.** "Above 10,000 followers, a single post is 10,000
writes, which at our posting rate is more write volume than the timeline store can
absorb — so those go on the read path" is a designed decision.

## Storage versus compute

```text
  PRECOMPUTE                       COMPUTE ON DEMAND
  materialised views               query at read time
  denormalised copies

  ✓ fast reads                     ✓ always fresh
  ✓ predictable latency            ✓ no storage cost
  ✗ storage cost                   ✗ slow, and load scales
  ✗ staleness                        with reads
  ✗ invalidation complexity
```

```text
  the deciding question: what is the READ:WRITE ratio, and
  how stale may the answer be?

    a follower count, read 1000× per write   → precompute
    a report run once a month                → compute
```

## Latency versus throughput

```text
  BATCHING trades one for the other, explicitly.

    batch size 1     lowest latency, worst throughput
    batch size 128   high throughput, added queueing latency

  → and the right point depends on whether a human is
    waiting.
```

The same trade appears as `linger.ms` in a message producer, as batch size in
model serving, and as group commit in a database. Recognising it as one trade
rather than three settings is worth doing.

## Freshness versus efficiency

```text
  how stale may this be?

    0            linearizable read; a quorum round trip
    < 1 s        streaming update
    < 1 min      cache with a short TTL
    < 1 hour     periodic recomputation
    < 1 day      nightly batch
    unbounded    on-demand, cached forever
```

```text
  each step down is roughly an order of magnitude cheaper.

  → so the question "how fresh does this need to be?" is
    worth asking about every derived value, and the honest
    answer is usually less fresh than the default.
```

## Making a trade-off argument

```text
  the structure that works

    1. name the CHOICE
    2. give the NUMBER that motivates it
    3. name what it COSTS
    4. name the ALTERNATIVE and what it would have bought
    5. say what would CHANGE your mind
```

```text
  "I'd make the timeline eventually consistent with a
   one-second bound. Reads are 100:1 against writes, so
   serving from a cache is what makes the QPS affordable —
   a linearizable read would need a quorum round trip on
   every one.

   The cost is that a user might not see a post they just
   made. I'd fix that specifically with read-your-writes:
   the writer's own timeline is served from the primary
   for a few seconds after posting.

   If this were a trading feed rather than a social one,
   I'd reverse it — there, a second of staleness is a
   correctness problem rather than a cosmetic one."
```

The fifth element is what most distinguishes a designed decision from a memorised
one: knowing which requirement would flip your answer demonstrates that you
reasoned to it rather than recalled it.

## The failure modes

```text
  ✗  presenting a choice as obviously correct
  ✗  choosing consistency everywhere "to be safe" — it is
     expensive and usually unnecessary
  ✗  choosing eventual everywhere without noticing which
     operations need more
  ✗  not saying what was given up
  ✗  a trade-off with no number behind it
```

## What to take away

1. The consistency/latency trade is paid on every request, and it is the one design
   conversations skip in favour of the partition case.
2. Only a short list of operations needs linearizability; session guarantees make a
   system feel consistent at a fraction of the cost.
3. Fan-out on write versus read is the read-cost/write-cost trade, and real systems
   are hybrids with a stated threshold.
4. Precompute when reads dominate and staleness is tolerable; the freshness ladder
   is roughly an order of magnitude per step.
5. Batching trades latency for throughput, and it is one trade appearing as three
   different settings.
6. Argue a trade-off as choice, number, cost, alternative, and what would change
   your mind — the last is what shows you reasoned rather than recalled.

Next: the first case study.
