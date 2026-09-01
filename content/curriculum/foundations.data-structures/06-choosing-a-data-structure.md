---
title: Choosing a data structure
minutes: 20
summary: A decision procedure, the numbers behind it, and the mistakes that survive code review.
---

Knowing what a hash table is does not tell you when to reach for one. Choosing
well is a separate skill, and it is the one that shows up in code review and in
system design interviews. This chapter is the decision procedure, plus the
places where the obvious answer is wrong.

## Start with the operations, not the structure

The question is never "should this be a list or a set". It is:

1. **What operations does this code perform on this data?**
2. **How often does it perform each one?**
3. **How large does the data get?**

Write the answer down before choosing. Most bad choices come from picking a
structure for the operation you thought about first — usually insertion — and
discovering later that the hot operation is a lookup you did not consider.

```text
  operations × frequency × size  ──▶  structure

  "I insert once and look up by id 10,000 times, n ≈ 50,000"
     ──▶ hash map, obviously

  "I insert constantly and always read them in order, n ≈ 200"
     ──▶ a plain array you sort on read; a tree is not worth it at n=200
```

## The decision tree

```text
  Do you need to look things up by a KEY?
   │
   ├─ YES ─ Do you need them in sorted order,
   │        or range queries ("all keys between X and Y")?
   │         ├─ YES ──▶ balanced tree / sorted map      O(log n)
   │         └─ NO ───▶ hash map                        O(1) average
   │
   └─ NO ── Do you only ever touch the ends?
            │
            ├─ YES ─ Both ends? ──▶ deque (circular buffer)
            │        One end?   ──▶ stack or queue (same thing)
            │
            └─ NO ── Do you need the min or max repeatedly?
                     │
                     ├─ YES ──▶ heap / priority queue
                     │
                     └─ NO ── Do you need positional access by index?
                              ├─ YES ──▶ dynamic array
                              └─ NO ───▶ set, if membership is the question
```

Two additions the tree does not capture:

- **Relationships between items** → graph.
- **Prefix queries on strings** ("everything starting with `foo`") → trie, or a
  sorted structure, since a sorted map supports prefix ranges too.

## The comparison table, with the caveats attached

| Structure     | Access   | Search   | Insert    | Delete   | Ordered?       | Note                |
| ------------- | -------- | -------- | --------- | -------- | -------------- | ------------------- |
| Dynamic array | O(1)     | O(n)     | O(1)* end | O(n) mid | insertion      | best constants      |
| Sorted array  | O(1)     | O(log n) | O(n)      | O(n)     | yes            | great if built once |
| Linked list   | O(n)     | O(n)     | O(1)†     | O(1)†    | insertion      | cache-hostile       |
| Hash map      | —        | O(1)‡    | O(1)‡     | O(1)‡    | **no**         | needs good hash     |
| Balanced tree | —        | O(log n) | O(log n)  | O(log n) | yes            | ranges, successors  |
| Heap          | O(1) min | O(n)     | O(log n)  | O(log n) | partial        | min/max only        |
| Trie          | —        | O(k)     | O(k)      | O(k)     | yes, by prefix | k = key length      |
| Bloom filter  | —        | O(1)     | O(1)      | ✗        | no             | probabilistic       |

\* amortized † given a node reference ‡ average, not worst

## Where the table lies

**"O(1) beats O(log n)."** For small `n`, no. A hash map must compute a hash,
mask it, follow a pointer to a bucket, and compare a key — perhaps 20–50 ns. A
linear scan of a 16-element array is a handful of cache-resident comparisons,
perhaps 5 ns. **Below roughly 8–16 elements, linear search over an array beats
every "smarter" structure**, and this is not a curiosity: it is why real hash
map implementations use small-size optimisations, why `std::sort` switches to
insertion sort under ~16 elements, and why a `Map` for three config entries is
slower and less readable than an array.

**"Hash maps are O(1)."** On average, with a decent hash and a bounded load
factor. Adversarial keys make them O(n), which is a real denial-of-service
vector, and is why runtimes seed their hash functions randomly per process.

**"A tree is fine, it's only log n."** log₂(1,000,000) ≈ 20, and each of those
20 steps may be a cache miss on a pointer-chasing structure. 20 × 100 ns = 2 µs
versus a hash map's ~50 ns. Both are "fast"; one is 40× the other.

**"Memory doesn't matter."** It is often the binding constraint, and the
overhead is larger than people expect:

```text
  1,000,000 32-bit integers

  int array (contiguous) ........  4 MB
  Python list of ints ........... 40+ MB   (8-byte pointers + 28-byte objects)
  HashMap<Integer,Integer> ...... 80+ MB   (boxing, entry objects, load factor)
  linked list of nodes .......... 40+ MB   (node + pointer + allocator header)
```

A structure that does not fit in cache — or worse, does not fit in RAM — loses
to a "worse" structure that does.

## The composite answer

Real systems rarely use one structure. The strong move is combining two so each
answers what it is good at:

| Need                                     | Combination                                     |
| ---------------------------------------- | ----------------------------------------------- |
| O(1) lookup **and** recency order        | hash map + doubly linked list (LRU)             |
| O(1) lookup **and** ordering             | hash map + sorted structure over the same items |
| Priority queue with updatable priorities | heap + hash map from item → heap index          |
| O(1) insert, delete **and** random pick  | array + hash map from item → its index          |
| Fast membership on a huge set            | Bloom filter in front of the real store         |

The last two are common interview questions ("insert, delete, getRandom in
O(1)"), and both are the same trick: one structure gives you the ordering or
compactness, the other gives you the O(1) address into it.

The Bloom filter deserves its own note because it is the one genuinely
counter-intuitive structure here. It answers "is X in the set?" with either
"definitely not" or "probably yes", in constant time and a fraction of the
memory — around 10 bits per element for a 1% false-positive rate, regardless of
how large the elements are. You cannot delete from one and you cannot enumerate
it. It is used as a _filter_: check the Bloom filter first, and only touch the
expensive store when it says "probably". Every LSM-tree database does this to
avoid reading files that cannot contain your key.

## Mistakes that survive code review

**A list used as a set.** `if x in my_list` is O(n). Inside a loop over n items
that is O(n²), and it looks completely innocent. This is the single most common
accidental quadratic in production code.

```python
seen = []                          seen = set()
for x in items:                    for x in items:
    if x not in seen:      ──▶         if x not in seen:
        seen.append(x)                     seen.add(x)
# O(n²)                             # O(n)
```

**`list.pop(0)` in a queue loop.** O(n) per call because every remaining element
shifts down. Use a deque.

**Sorting inside a loop.** Sorting once outside is O(n log n); sorting each
iteration is O(n² log n). Usually invisible until the data grows.

**Rebuilding a lookup each call.** Constructing a dict from a list inside a
function that is called per item, instead of once outside.

**Mutable objects as hash keys.** Mutate the key after insertion and the entry
becomes unreachable — still in the map, findable by nothing.

**Choosing for the wrong `n`.** A B-tree for 50 items, or a linear scan for 50
million. Both are the same error with the sign flipped.

## When to stop thinking and measure

The framework gets you to a good default in a minute. Past that, measure — but
measure the right thing:

- **Profile before optimising a structure.** The bottleneck is usually I/O, not
  your container choice.
- **Benchmark with realistic size and realistic data.** A hash map on 100
  sequential integers tells you nothing about 10 million real keys.
- **Watch memory as well as time**, because the cliff when you exceed cache or
  RAM is not gradual.

And know when the question has left the process entirely. When "the data
structure" is measured in terabytes, is shared between machines, or must survive
a restart, you are no longer choosing a container — you are choosing a database,
and the same reasoning applies one level up. A hash map becomes a key-value
store; a sorted tree becomes a B-tree index; a heap becomes a job queue. The
concepts transfer directly, which is the real reason this chapter is worth
knowing cold.

## What to take away

1. Choose from the operations and their frequencies, not from the structure. Write
   the access pattern down first.
2. Below roughly 8–16 elements, a linear scan of an array beats every cleverer
   structure. Small-n constants dominate asymptotics.
3. Hash maps are O(1) on average and unordered; trees are O(log n) and ordered.
   "Do I need range queries or sorted iteration?" is the deciding question.
4. Memory overhead is often the binding constraint, and boxing plus pointers can
   cost 10× the raw data.
5. Composite structures — hash map plus list, heap plus index map, Bloom filter
   plus store — are how real systems get two properties at once.
6. `x in list` inside a loop is the most common accidental quadratic in
   production code.

That completes Data Structures. Next in the track: **Complexity & Analysis**,
which makes the cost reasoning here precise — and shows where big-O stops being
the right tool.
