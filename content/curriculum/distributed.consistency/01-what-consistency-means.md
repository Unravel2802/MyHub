---
title: What "consistency" actually means
minutes: 18
summary: Three unrelated things share the word, and conflating them is why the CAP debate stayed confused for a decade.
---

"Consistency" is used for three different properties in three different fields,
and they have almost nothing to do with each other. A great deal of confused
argument — including most of what has been written about CAP — comes from two
people using the word for two of them at once. Separating them takes five
minutes and permanently clarifies the rest of the topic.

## The three meanings

**1. The C in ACID — a database transaction property.**

This one means "the transaction takes the database from one valid state to
another, preserving declared invariants": foreign keys, check constraints,
uniqueness. It is really a property of *your schema and your application*, not of
the database — the database enforces the constraints you declared, and it is your
job to have declared the right ones.

It has essentially nothing to do with distribution. Joe Hellerstein has pointed
out that C was arguably included in ACID to make the acronym pronounceable.

**2. The C in CAP — a distributed-systems property.**

This means **linearizability**: the system behaves as though there is exactly one
copy of the data and every operation takes effect at a single instant. It is a
property of a *replicated* system, and it says nothing about invariants.

**3. Consistency models generally — a spectrum.**

The family of guarantees about what a read may return in a concurrent,
replicated system: linearizable, sequential, causal, eventual and many more.
Meaning 2 is the strongest point on this spectrum.

```text
  ACID "C"            invariants hold        about your schema
  CAP "C"             linearizability        about replication
  consistency models  a whole spectrum       about what reads may return

  a system can be ACID-consistent and NOT linearizable.
  a system can be linearizable and violate your invariants.
  they are orthogonal.
```

From here on, "consistency" means the third sense.

## The question a consistency model answers

Exactly one question:

> **Given concurrent operations on replicated data, which values may a read
> legally return?**

That is it. A consistency model is a contract that rules out some outcomes and
permits others. A *strong* model rules out more, which makes the system easier to
reason about and more expensive to build. A *weak* model rules out less, which
makes it cheaper and faster and puts the reasoning burden on you.

```text
  STRONGER                                            WEAKER
  ◀──────────────────────────────────────────────────────────▶

  linearizable   sequential   causal   read-your-writes   eventual
       │                                                     │
  fewer legal outcomes                          more legal outcomes
  easier to reason about                        harder to reason about
  more coordination                             less coordination
  higher latency                                lower latency
  unavailable under partition                   available under partition
```

The whole engineering trade is on that diagram. Everything else in this topic is
detail about where the points sit and what each one costs.

## Why the weak end exists at all

It is tempting to conclude that you should always take the strongest model
available. The reason not to is physics, and it is worth making concrete before
the formal results.

A linearizable write must be acknowledged only after enough replicas have it that
no subsequent read can miss it. If those replicas are in Virginia, Frankfurt and
Singapore, the acknowledgement waits for a round trip to at least one distant
region:

```text
  Virginia ⇄ Frankfurt   ~90 ms round trip
  Virginia ⇄ Singapore   ~230 ms round trip

  a quorum write from Virginia:  wait for the 2nd-fastest → ~90 ms

  every single write. forever. by the speed of light.
```

For a global system, strong consistency means every write costs a fraction of a
second. Sometimes that is correct and worth it. For a "like" counter, a presence
indicator, or a view count, it is absurd — and the weaker models exist so you can
say so precisely rather than by accident.

## Safety and liveness

A useful frame that clarifies what these guarantees are made of.

```text
  SAFETY     "nothing bad ever happens"
             a read never returns a value that was never written
             two nodes never both believe they are leader
             → violated at a specific moment, and unfixable afterwards

  LIVENESS   "something good eventually happens"
             every request eventually gets a response
             replicas eventually converge
             → cannot be violated at a moment, only in the limit
```

Consistency models are mostly **safety** properties: they forbid outcomes.
Availability is a **liveness** property: it promises progress.

That framing explains why the impossibility results ahead have the shape they
do. You cannot have unlimited safety and unlimited liveness in an asynchronous
network, because guaranteeing that nothing bad happens sometimes requires
*waiting*, and waiting is exactly what liveness forbids.

It also explains something practical: **"eventual" consistency is a liveness
promise with no safety content.** "The replicas will converge, eventually" says
nothing about what you may read in the meantime, and no bound on how long
"eventually" is. Taken literally, a system that returns the same wrong value for
a year and then converges satisfies it. That is why eventual consistency alone is
a weak thing to promise, and why the useful models in the middle of the spectrum
— causal, read-your-writes, monotonic reads — exist to add back specific safety
properties without paying for linearizability.

## Local versus distributed

One more distinction worth having, because it explains why single-node databases
feel so different.

A single-node database gives you linearizability for free: there is one copy,
operations are ordered by when they reach it, and there is nothing to disagree.
All the machinery in this topic exists because *replication* broke that, and
every guarantee is an attempt to recover some of what one machine gave you
without giving up what many machines bought you.

This is worth saying because it reframes the effort. Distributed consistency is
not an advanced feature you add. It is compensation for something you gave up,
and the right question is always "how much of it do I need to buy back here?"

## What to take away

1. ACID's C (invariants), CAP's C (linearizability) and consistency models
   (a spectrum) are three unrelated things sharing one word.
2. A consistency model answers exactly one question: which values may a read
   legally return? Stronger models rule out more outcomes and cost more
   coordination.
3. The cost of the strongest model is bounded below by the speed of light — a
   globally linearizable write cannot be faster than a round trip to a distant
   replica.
4. Consistency guarantees are safety properties ("nothing bad happens");
   availability is liveness ("progress happens"). The impossibility results
   follow from needing both.
5. "Eventual consistency" is liveness with no safety content and no time bound,
   which is why the intermediate models exist.
6. A single node is linearizable for free; everything here is buying back what
   replication took away.

Next: linearizability precisely — the strongest model, how to test for it, and
what it costs.
