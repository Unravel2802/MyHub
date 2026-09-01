---
title: Hash tables
minutes: 22
summary: Average-case O(1) lookup, what breaks it, and why iteration order is a trap.
---

# Hash tables

A hash table gives you O(1) _average_ lookup by key. It is the workhorse of
practical programming — dictionaries, sets, caches, database indexes and symbol
tables are all hash tables underneath.

## The idea

Store values in an array of `m` buckets. To find where a key lives, compute:

```text
bucket = hash(key) mod m
```

If `hash` distributes keys evenly, each bucket holds roughly `n / m` entries, so
a lookup examines a constant number of entries.

That "if" is doing an enormous amount of work, and the rest of this chapter is
about it.

## Collisions

Two keys can hash to the same bucket. By the birthday paradox this happens far
sooner than intuition suggests — with 23 keys and 365 buckets, a collision is
already more likely than not. Collisions are the normal case, not an error.

**Separate chaining** keeps a list (or tree) per bucket:

```text
bucket 3 -> ("cat", 1) -> ("tac", 9)
```

**Open addressing** stores entries in the array itself and probes for the next
free slot on collision. It is more cache-friendly, but deletion needs care —
removing an entry can break the probe chain for others, so implementations mark
tombstones instead of clearing slots.

## Load factor and resizing

The **load factor** is `α = n / m`. As it rises, buckets get longer and lookups
slow down. Implementations resize (usually doubling `m`) when `α` crosses a
threshold — around 0.75 for chaining, lower for open addressing.

Resizing rehashes every key into the new table: O(n). As with dynamic arrays,
doubling makes this amortized O(1) per insert.

## Where O(1) stops being true

| Situation                      | Effect                              |
| ------------------------------ | ----------------------------------- |
| All keys hash to one bucket    | Lookup degrades to O(n)             |
| Adversary chooses keys         | Deliberate O(n) — a real DoS vector |
| Mutating a key after insertion | Entry becomes unreachable           |
| Bad `hash`/`equals` pairing    | Duplicate or missing entries        |

The third is worth stating loudly: if a key's hash depends on mutable fields and
you change one after inserting it, the entry is still in the table but you can
no longer find it. **Use immutable keys.**

The adversarial case is why modern runtimes seed their hash functions randomly
per process. It is also why you should never assume iteration order is stable
across runs unless the language explicitly guarantees it.

## The contract

Any type used as a key must satisfy:

```text
a == b  implies  hash(a) == hash(b)
```

The converse need not hold — unequal objects may share a hash, that is just a
collision. But equal objects with different hashes will land in different
buckets and the table will contain both, which is a bug that surfaces as "my
lookup returns nothing" long after the insertion that caused it.

## What to take away

1. O(1) is _average_ case, conditional on a good hash and a bounded load factor.
2. Collisions are normal; the strategy for handling them is a real design choice.
3. Keys must be immutable and must honour the hash/equality contract.
4. Do not rely on iteration order.
