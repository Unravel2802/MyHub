---
title: Arrays and the memory model
minutes: 18
summary: Why contiguous memory makes indexing O(1) and insertion O(n).
---

# Arrays and the memory model

An array is the only data structure the hardware gives you directly. Everything
else in this track is built on top of it, so it is worth understanding exactly
what it is before adding abstractions.

## The one-line definition

An array is a **contiguous block of memory** holding `n` elements of equal size
`s`. That single property produces every performance characteristic arrays have.

Given a base address `A` and an index `i`, the address of element `i` is:

```text
address(i) = A + i * s
```

That is one multiply and one add — a constant amount of work regardless of how
large `n` is, and regardless of which `i` you ask for. This is what O(1) random
access means, and it is the reason `arr[999999]` is not slower than `arr[0]`.

## What contiguity costs

The same property that makes indexing free makes structural change expensive.

| Operation           | Cost | Why                                  |
| ------------------- | ---- | ------------------------------------ |
| Read/write at index | O(1) | Address arithmetic                   |
| Append (amortized)  | O(1) | Usually spare capacity at the end    |
| Insert at front     | O(n) | Every later element must shift right |
| Delete at index     | O(n) | Every later element must shift left  |
| Search (unsorted)   | O(n) | No structure to exploit              |

Inserting at the front of a million-element array means moving a million
elements. There is no clever implementation that avoids this — it follows from
the definition.

## Dynamic arrays and amortized cost

A fixed-size array cannot grow, so most languages ship a _dynamic_ array
(`vector`, `ArrayList`, Python's `list`, JavaScript's `Array`). When it runs out
of capacity it allocates a larger block — typically **double** the size — and
copies everything across.

```python
# Conceptually, what append does:
def append(self, value):
    if self.length == self.capacity:
        self._grow(self.capacity * 2)   # allocate + copy: O(n)
    self.data[self.length] = value      # O(1)
    self.length += 1
```

A single append can therefore cost O(n). But the expensive ones are rare: to
trigger the _next_ resize you must perform another `capacity` cheap appends.
Spread over a sequence of `n` appends, the total copying work is
`1 + 2 + 4 + ... + n < 2n`, so the **amortized** cost per append is O(1).

Growing by a _constant_ amount instead of doubling breaks this: you would resize
every `k` appends, giving `n/k` resizes averaging `n/2` copies each — O(n²)
total. The doubling is not an implementation detail; it is what makes the
amortized bound hold.

## Why arrays are faster than their big-O suggests

Big-O counts operations, not time. Arrays win on constants for a reason
Complexity & Analysis will make precise:

- **Cache lines.** Memory moves between RAM and cache in blocks (usually 64
  bytes). Reading `arr[0]` pulls `arr[1..15]` along with it for free.
- **Prefetching.** A sequential scan is a pattern the CPU recognises and runs
  ahead of.

A linked list with identical asymptotic complexity for traversal is routinely
several times slower in practice, because each node may sit anywhere in memory
and every step is a potential cache miss.

## What to take away

1. Random access is O(1) _because_ the elements are contiguous.
2. Insertion and deletion in the middle are O(n) for the _same_ reason.
3. Doubling on growth is what makes append amortized O(1).
4. Constant factors favour arrays heavily; prefer one unless a measured need
   says otherwise.

Next: hash tables, which buy O(1) _search_ by giving up ordering.
