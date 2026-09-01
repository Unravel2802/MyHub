---
title: Linked structures
minutes: 19
summary: When pointers beat contiguity, and why the answer is rarer than textbooks suggest.
---

Linked lists are the second data structure everyone learns and one of the least
used in production code. That combination is worth understanding: the reasons
they are taught are real, and the reasons they are rarely the right answer are
also real, and the gap between them is a lesson about how big-O relates to
actual speed.

## The structure

A linked list stores each element in its own **node**, which also holds a
pointer to the next node. The elements need not be adjacent in memory.

```text
  head ──▶ ┌─────┬───┐   ┌─────┬───┐   ┌─────┬───┐
           │  7  │ ●─┼──▶│  3  │ ●─┼──▶│  9  │ ∅ │
           └─────┴───┘   └─────┴───┘   └─────┴───┘
           0x8f20        0x1c04        0xa730
                    ▲ addresses are unrelated
```

A **doubly** linked list adds a `prev` pointer, allowing backward traversal and
O(1) removal given only a node reference — at the cost of a second pointer per
node and a second pointer to fix on every mutation.

## What it buys, in theory

| Operation                        | Array                  | Linked list              |
| -------------------------------- | ---------------------- | ------------------------ |
| Index `i`                        | O(1)                   | O(n)                     |
| Insert / delete at front         | O(n)                   | **O(1)**                 |
| Insert / delete at back          | O(1)*                  | O(1) with a tail pointer |
| Insert / delete **given a node** | O(n)                   | **O(1)**                 |
| Search                           | O(n)                   | O(n)                     |
| Memory per element               | the element            | element + 1–2 pointers   |
| Growth                           | occasional O(n) resize | never copies             |

\* amortized.

The two bolded cells are the entire case for a linked list: **cheap insertion
and removal at a position you already hold**, and no bulk copying on growth.

## What it costs, in practice

```text
  array:     ┌──┬──┬──┬──┬──┬──┬──┬──┐
             └──┴──┴──┴──┴──┴──┴──┴──┘
             one cache line fetch brings ~16 ints along for free
             the prefetcher sees the pattern and runs ahead

  linked:    ┌──┐        ┌──┐                    ┌──┐
             └─┬┘        └─┬┘                    └─┬┘
               └──────────▶└─────────────────────▶ ...
             each hop is a potential cache MISS (~100ns)
             the prefetcher cannot predict where you're going
```

A cache miss to main memory costs on the order of 100 ns; an L1 hit costs about
1 ns. Traversing a linked list can therefore be **10–50× slower than traversing
an array of the same length**, despite both being O(n). Big-O counts operations
and is silent about the memory hierarchy, and here the memory hierarchy
dominates.

There is a second, subtler cost. Every node is a separate heap allocation:
allocator overhead per element (often 16–32 bytes), pointer overhead, and — in a
garbage-collected language — one more object for the collector to trace. A
linked list of a million 4-byte integers can easily use 40 MB.

This is why `std::vector` is the C++ default, why Java's `ArrayList` is used far
more than `LinkedList`, and why Rust's standard library documentation for
`LinkedList` explicitly tells you to use `Vec` or `VecDeque` unless you have
measured a reason not to.

**The honest rule:** an array beats a linked list unless you are inserting and
removing in the middle _and_ you already hold a reference to the position. If
you have to search for the position first, the O(n) search dominates and the
O(1) splice buys nothing.

## Where they genuinely win

**Intrusive lists in systems code.** The kernel's task list, a memory
allocator's free lists. The pointers live inside the objects that already exist,
so there is no extra allocation, and an object can be unlinked in O(1) from an
arbitrary place.

**LRU caches.** The canonical correct use: a doubly linked list holds entries in
recency order, and a hash map maps key → node. A lookup finds the node in O(1)
via the map, then unlinks and re-inserts it at the head in O(1) via its
pointers. Neither structure can do this alone.

```text
  map: {"a": ●, "b": ●, "c": ●}
              │        │    │
              ▼        ▼    ▼
  head ──▶ ┌───┐ ⇄ ┌───┐ ⇄ ┌───┐ ──▶ tail
           │ c │   │ a │   │ b │        (evict from here)
           └───┘   └───┘   └───┘
        most recent            least recent
```

**Persistent / immutable lists.** In functional languages, prepending to a list
shares the entire tail:

```text
  xs      = [2, 3]     ──▶ ┌─┬─┐──▶┌─┬─┐──▶ ∅
                           │2│●│   │3│∅│
  ys = 1 : xs          ┌─┬─┐└─┴─┘  └─┴─┘
                       │1│●┼──▶ (same nodes, shared)
                       └─┴─┘
```

`ys` is O(1) to build and `xs` is untouched. Doing this with arrays means
copying. This structural sharing is what makes immutable data affordable at all.

**Stable references.** Elements of a vector move when it reallocates, which
invalidates every pointer and iterator into it — a classic C++ bug. Nodes never
move, so a reference to one stays valid for its lifetime.

## The deque, which is what you usually wanted

Most reaches for a linked list are actually reaches for a **double-ended
queue**: push and pop at both ends, cheaply. The good implementation is not a
linked list; it is a **circular buffer** — an array plus head and tail indices
that wrap.

```text
  capacity 8, currently holding [C, D, E]

    idx:   0    1    2    3    4    5    6    7
         ┌────┬────┬────┬────┬────┬────┬────┬────┐
         │    │    │    │ C  │ D  │ E  │    │    │
         └────┴────┴────┴────┴────┴────┴────┴────┘
                          ▲              ▲
                        head           tail

  push_front: head = (head - 1) mod 8, write there
  pop_back:   tail = (tail - 1) mod 8
```

O(1) at both ends, contiguous memory, cache-friendly, one allocation. This is
Python's `collections.deque`, Rust's `VecDeque`, Java's `ArrayDeque`, and it is
what you should reach for when you need queue or stack behaviour. A queue built
on a plain list with `pop(0)` is O(n) per operation and is a common accidental
quadratic.

## Skip lists, briefly

A skip list is a linked list with extra express lanes, giving O(log n) search
while remaining a linked structure:

```text
  L3: 1 ─────────────────────────────▶ 9
  L2: 1 ─────────▶ 4 ────────────────▶ 9
  L1: 1 ──▶ 3 ──▶ 4 ──▶ 6 ──▶ 7 ─────▶ 9
```

Each node is promoted to the next level with probability ½, so a search drops
down levels and skips roughly half the remaining list each time. The appeal over
a balanced tree is that it is much easier to make lock-free and to implement
correctly. Redis uses one for sorted sets, and LevelDB-style memtables often do
too.

## The interview angle

Linked lists appear constantly in interviews, and the reason is not that they
are useful — it is that they force explicit pointer manipulation with no library
to hide behind. The moves worth being fluent in:

- **Two pointers at different speeds** (fast/slow) — find the middle, detect a
  cycle (Floyd's algorithm), find the k-th from the end in one pass.
- **Reverse in place** by re-pointing each `next` while carrying three pointers.
- **Dummy head node** to make insertion at the front stop being a special case.
  Half of all off-by-one errors in list code disappear with this one trick.
- **Draw the pointers before writing the code.** Every mistake in this family is
  a pointer assigned in the wrong order, and a diagram finds it instantly.

A strong answer notes the cache behaviour when asked to compare with an array;
a weak one quotes the complexity table and stops there.

## What to take away

1. A linked list buys O(1) splicing at a position you already hold, and nothing
   else worth having.
2. Traversal can be 10–50× slower than an array of the same length because of
   cache misses. Big-O is silent about the memory hierarchy.
3. Per-node allocation and pointer overhead make them memory-hungry, especially
   under a garbage collector.
4. The genuine wins are intrusive lists, LRU caches, persistent lists with
   structural sharing, and stable references.
5. When you want a queue or a stack, use a circular-buffer deque, not a list —
   and never `pop(0)` on an array-backed list.

Next: graphs — the structure that generalises all of these, and the one whose
representation choice matters most.
