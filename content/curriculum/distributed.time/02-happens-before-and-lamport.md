---
title: Happens-before and Lamport clocks
minutes: 21
summary: Ordering events by causality instead of by time, and the clock that costs one integer.
---

If physical clocks cannot order events, what can? Leslie Lamport's 1978 answer —
one of the most influential papers in computing — is that most of the time you
do not actually need to know *when* things happened. You need to know **what
could have caused what**. That is a different relation, it is knowable without
any clock at all, and it turns out to be the one that matters.

## The happens-before relation

Write `a → b` for "a happens before b". It is defined by three rules, and
nothing else:

```text
  1. SAME PROCESS
     if a and b are in the same process and a comes first, then a → b

  2. MESSAGE
     if a is "send message m" and b is "receive m", then a → b

  3. TRANSITIVITY
     if a → b and b → c, then a → c
```

That is the complete definition. No clocks, no time, no assumption that machines
agree about anything.

```text
  P1  ──a──────b───────────────────d──▶
              ╲                   ╱
               ╲ (message)       ╱ (message)
                ╲               ╱
  P2  ────────────c────────e────────▶

  a → b        rule 1 (same process)
  b → c        rule 2 (send/receive)
  c → e        rule 1
  a → e        rule 3 (transitivity)
  e → d        rule 2

  What about b and... nothing here is concurrent. Let us add one:
```

```text
  P1  ──a──────b──────────▶
              ╲
               ╲
  P2  ───x──────c─────────▶

  a → b, b → c, so a → c.
  But x and b?
    x is not before b: no chain of rules connects them.
    b is not before x: same.
  → x and b are CONCURRENT, written x ‖ b
```

**Concurrent does not mean simultaneous.** `x` may have occurred hours before
`b` in real time. It means *neither could have influenced the other*, because no
chain of messages connects them. That is the useful property: two concurrent
events can be reordered without changing any outcome, because neither had
knowledge of the other.

This is why happens-before is called a **partial** order. Some pairs are ordered;
some are genuinely incomparable, and forcing an order on them would be inventing
information you do not have.

## Why causality is what you actually want

Consider a comment thread replicated across two data centres:

```text
  Alice:  "Is the deploy done?"          (event a)
  Bob:    "Yes, ten minutes ago."        (event b) — a reply, so a → b
```

If a replica receives `b` before `a`, it displays an answer to a question that
has not been asked. That is broken, and it is broken because a *causal* relation
was violated.

Now:

```text
  Alice (London):   "Coffee?"      (event x)
  Chen (Tokyo):     "Deploying."   (event y)
```

These are unrelated. Any order is fine. Forcing them into a global sequence
requires coordination between London and Tokyo — 200 ms of it — to decide
something nobody cares about.

**That is the whole design argument.** Enforcing causal order is cheap and
preserves what users perceive as correctness. Enforcing total order is expensive
and mostly buys nothing.

## Lamport clocks

The mechanism, and it is startlingly small. Each process keeps one integer.

```text
  1. increment your counter before every local event
  2. send your counter along with every message
  3. on receiving a message with counter t:
        counter = max(counter, t) + 1
```

```python
class LamportClock:
    def __init__(self):
        self.t = 0

    def local_event(self):
        self.t += 1
        return self.t

    def send(self):
        self.t += 1
        return self.t              # attach to the message

    def receive(self, received_t):
        self.t = max(self.t, received_t) + 1
        return self.t
```

Traced through:

```text
  P1  ──[1]──[2]────────────────────[5]──▶
                ╲                  ╱
             msg(2)             msg(4)
                  ╲              ╱
  P2  ──[1]────────[3]────────[4]────────▶

  P1: event=1, event=2, send with t=2
  P2: event=1, then receives 2 → max(1,2)+1 = 3
  P2: event 4, sends with t=4
  P1: receives 4 → max(2,4)+1 = 5
```

**The guarantee, and its precise limit:**

```text
      a → b   IMPLIES   L(a) < L(b)          ✓ always true

      L(a) < L(b)  IMPLIES  a → b            ✗ NOT true
```

The forward direction holds and is the useful part: if `b` was causally
influenced by `a`, `b`'s timestamp is strictly larger. So **a smaller Lamport
timestamp never rules out being a cause, but a larger one rules it out
completely** — if `L(a) > L(b)`, then `a` definitely did not cause `b`.

The reverse fails because concurrent events also get different numbers. In the
diagram above, P2's event with timestamp 1 and P1's event with timestamp 2 are
concurrent, yet 1 < 2. The ordering the numbers suggest is not real.

## Making it a total order

Lamport timestamps can be ties (two processes both at 4). Break ties with a
process ID, and you have a **total order** on all events:

```text
  (timestamp, process_id)   compared lexicographically

  (4, "node-a") < (4, "node-b") < (5, "node-a")
```

This total order is *arbitrary* for concurrent events — it invents an order for
things that had none — but it is **consistent**: every node computes the same
total order from the same data, without communicating.

That is exactly what you need for deterministic tie-breaking. Two replicas
deciding which of two concurrent writes wins will independently reach the same
answer. Note what it does *not* do: it does not tell you the writes were
concurrent, so you cannot detect the conflict, only resolve it arbitrarily. That
limitation is what vector clocks fix.

## Where you have already used them

**Kafka offsets** are a per-partition Lamport-like counter: a monotonically
increasing sequence assigned by the leader, which orders everything within a
partition without reference to time.

**Database LSNs** (log sequence numbers) in Postgres, and similar in every
write-ahead-log system, do the same job for a replication stream.

**Version vectors in CRDTs** generalise this idea, covered later in the track.

**Optimistic concurrency control** — the `version` column you increment on every
update and check on every write — is a Lamport clock for one row:

```sql
UPDATE orders SET status = 'shipped', version = version + 1
WHERE id = 7 AND version = 3;
-- 0 rows updated means someone else wrote first
```

Recognising these as the same idea is the point. It is one mechanism with many
names.

## The cost, and what it buys

| | Cost | Detects concurrency? |
| --- | --- | --- |
| Lamport clock | 1 integer per process | ❌ no |
| Vector clock | 1 integer **per process** in the system | ✅ yes |

That is the whole trade, and it is why Lamport clocks remain widely used despite
being weaker. One integer is nothing. A vector whose size grows with the number
of participants is a real cost in a system with many clients, and it must be
garbage-collected as participants come and go.

So the decision rule:

- **Need to know that two writes conflicted, so a human or a merge function can
  resolve them?** You need vector clocks.
- **Only need a consistent arbitrary order that respects causality?** A Lamport
  clock plus a node ID is enough, and is far cheaper.

Systems that pick last-write-wins have implicitly chosen the second, and have
accepted that concurrent writes are silently resolved rather than surfaced.

## What to take away

1. Happens-before is defined by three rules — program order, send-before-receive,
   and transitivity — with no reference to clocks or time.
2. It is a *partial* order: some events are concurrent, meaning neither could have
   influenced the other, regardless of when they occurred in real time.
3. Causal order is what users perceive as correctness (a reply after its
   question); total order costs coordination and usually buys nothing.
4. A Lamport clock is one integer per process with a max-plus-one rule on
   receive. `a → b` implies `L(a) < L(b)`, but not the converse.
5. Adding a node ID gives a consistent total order that every node computes
   identically — good for tie-breaking, unable to detect conflicts.
6. Kafka offsets, WAL LSNs and optimistic-concurrency version columns are all
   this same mechanism.

Next: vector clocks — paying more to learn the one thing a Lamport clock cannot
tell you.
