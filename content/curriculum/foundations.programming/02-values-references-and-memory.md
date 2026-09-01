---
title: Values, references and memory
minutes: 26
summary: Why "a variable holds a value" is misleading, and what aliasing actually costs you.
---

Almost every confusing bug that is not a logic error is a question about
identity: two names turned out to refer to the same thing, or one name turned
out to refer to a copy. `list2 = list1` then mutating `list2` and watching
`list1` change. Passing an object to a function and finding it modified.
Comparing two things that look identical and getting `false`. These are not
language quirks to memorise separately. They are one idea, and once you have it
the whole class disappears.

## Two questions, always

For any name in any language, ask:

1. **Does this name hold the data, or hold a pointer to the data?**
2. **Can the data be changed in place?**

Those are independent, and every language picks a combination — sometimes
different combinations for different types in the same language, which is why
this is confusing to learn piecemeal.

```text
  VALUE semantics                    REFERENCE semantics

  x ┌─────────┐                      x ┌────────┐
    │  42     │                        │  addr ─┼───┐
    └─────────┘                        └────────┘   │
  y ┌─────────┐                      y ┌────────┐   ▼
    │  42     │  ← independent copy    │  addr ─┼──▶┌──────────┐
    └─────────┘                        └────────┘   │ [1,2,3]  │
                                                    └──────────┘
                                          both names, one object
```

With value semantics, `y = x` copies the data; changing `y` cannot affect `x`.
With reference semantics, `y = x` copies the _pointer_; both names now see the
same object, and a mutation through either is visible through both. That
situation — two or more names reaching the same mutable thing — is called
**aliasing**, and it is the source of the entire bug class.

## Where languages sit

| Language   | Primitives                         | Objects / collections                           |
| ---------- | ---------------------------------- | ----------------------------------------------- |
| C          | value                              | value (structs), pointers are explicit          |
| Java       | value                              | reference                                       |
| Python     | reference (but ints are immutable) | reference                                       |
| JavaScript | value                              | reference                                       |
| Go         | value                              | value (structs), reference (slices, maps)       |
| Rust       | value                              | value, with _borrowing_ tracked by the compiler |
| Swift      | value                              | value (structs), reference (classes)            |

Python deserves a note because it is the language people most often describe
incorrectly. Everything in Python is a reference to an object. `x = 5` does not
put 5 in a box called `x`; it makes `x` point at an integer object. What makes
integers _feel_ like values is that they are **immutable** — there is no
operation that changes an integer object in place, so aliasing is unobservable.
`x += 1` rebinds `x` to a different object.

That is the general rule, and it is worth stating on its own:

> **Aliasing is only observable when the aliased thing is mutable.**

Which is the entire argument for immutability by default. If a value cannot
change, it does not matter how many names reach it, and questions 1 and 2 above
collapse into one you never have to ask.

## The copy that isn't: shallow versus deep

```python
import copy

original = {"name": "config", "tags": ["a", "b"]}

alias    = original                  # same dict
shallow  = original.copy()           # new dict, SAME inner list
deep     = copy.deepcopy(original)   # new dict, new inner list

shallow["tags"].append("c")

original["tags"]   # ['a', 'b', 'c']  ← surprised?
```

Drawn out, the reason is immediate:

```text
  original ──▶ ┌────────────────────┐
               │ name: "config"     │
               │ tags: ────────────┐│
               └───────────────────┼┘
                                   │
  shallow  ──▶ ┌───────────────────┼┐
               │ name: "config"    ││
               │ tags: ────────────┼┼──▶ ┌───────────────┐
               └───────────────────┘│    │ ["a","b","c"] │
                                    └───▶└───────────────┘
                                              one list
```

A shallow copy copies one level. Everything it contained is still shared. This
is the correct default — deep copying is expensive and often wrong, since it
duplicates things that were deliberately shared — but it means "I made a copy"
is never sufficient information. The question is _how deep_.

## Pass by value, pass by reference, and the phrase that causes the trouble

Java and Python are both **pass by value**, always. What confuses everyone is
that the value being passed is often a reference.

```python
def rename(cfg):
    cfg["name"] = "changed"      # mutates the object both names see

def replace(cfg):
    cfg = {"name": "changed"}    # rebinds the LOCAL name only

c = {"name": "original"}
rename(c);   c["name"]   # 'changed'
replace(c);  c["name"]   # 'changed' — from rename; replace did nothing
```

The parameter `cfg` is a fresh local name initialised to a copy of the caller's
_pointer_. Following that pointer and changing what is at the other end affects
the caller. Assigning to the name itself just points the local name somewhere
else, and the caller never sees it.

True pass-by-reference — where the callee can rebind the caller's variable —
exists in C++ (`int&`), C# (`ref`), and is emulated in C by passing a pointer to
a pointer. It is rare, and when a language does not have it, no amount of
argument passing will let a function reassign a caller's variable.

## Where the bytes live: stack and heap

```text
  high addresses
   ┌────────────────────────────┐
   │  stack                     │  ← function frames; grows downward
   │    ↓                       │     automatic, LIFO, very fast
   ├────────────────────────────┤
   │                            │
   │  (unmapped)                │
   │                            │
   ├────────────────────────────┤
   │    ↑                       │  ← explicit allocation; grows upward
   │  heap                      │     arbitrary lifetime, slower
   ├────────────────────────────┤
   │  static / globals          │  ← fixed size, lives for the process
   ├────────────────────────────┤
   │  code (read-only)          │
   └────────────────────────────┘
  low addresses
```

**Stack** allocation is a single instruction: move the stack pointer. Freeing is
another. Everything in a frame dies when the function returns, in exactly the
reverse order it was created. There is no bookkeeping and no fragmentation, and
the memory is almost certainly in L1 cache because you were just there.

**Heap** allocation asks an allocator for a block of a given size. The allocator
must find a free block, possibly split it, record it, and hand it back —
typically tens to hundreds of nanoseconds, versus roughly one for a stack push.
The block lives until something frees it, which is what allows an object to
outlive the function that created it.

That is the trade. Stack memory is fast and its lifetime is fixed by scope; heap
memory is slower and its lifetime is yours to manage. Everything about memory
management (the next topic) is about who does that managing.

Two consequences worth carrying:

- **Stack size is small and fixed** — commonly 1–8 MB per thread. Deep or
  unbounded recursion overflows it, and a large array declared as a local can
  too.
- **Returning a pointer to a local is a use-after-free.** The frame is gone the
  moment the function returns. In C this compiles with a warning and corrupts
  silently; in Rust the borrow checker rejects it; in GC languages the object was
  on the heap anyway and it is a non-issue.

## Equality and identity

Two different questions, and languages disagree about which one an operator
answers.

```text
  identity:  are these the SAME object?          (compare addresses)
  equality:  do these have the same CONTENTS?    (compare fields)
```

| Language   | Identity         | Equality                                                  |
| ---------- | ---------------- | --------------------------------------------------------- |
| Python     | `is`             | `==` (via `__eq__`)                                       |
| Java       | `==`             | `.equals()`                                               |
| JavaScript | `===` on objects | deep compare must be hand-written                         |
| Go         | `==` on pointers | `==` on comparable structs, `reflect.DeepEqual` otherwise |
| Rust       | `ptr::eq`        | `==` (via `PartialEq`)                                    |

Java's choice — `==` meaning identity — is the origin of the most common Java
bug there is: comparing strings with `==`, having it work in testing because the
compiler interned both literals into one object, and having it fail in
production where one string came off the network.

```java
String a = "hello";
String b = "hello";
a == b            // true  — both are the SAME interned literal

String c = new String("hello");
a == c            // false — different objects
a.equals(c)       // true  — same contents
```

Python has the same trap for small integers, which it caches:

```python
a = 256; b = 256; a is b     # True  — cached
a = 257; b = 257; a is b     # False — separate objects
```

Neither of these is a puzzle to memorise. They are both "you asked about
identity when you meant equality, and the cache made the wrong answer look
right".

## The rules that make this go away

1. **Default to immutable.** If it cannot change, aliasing cannot hurt you and
   you can share it freely across threads.
2. **Copy at the boundary, not everywhere.** When you accept a mutable
   collection from a caller and intend to keep it, copy it once at the door.
   When you return internal state, return a copy or an immutable view.
   Otherwise your invariants are enforceable only by hoping.
3. **Make ownership explicit in names and types.** `get_items()` returning the
   live internal list is a landmine. Rust makes this a type-system question;
   everywhere else it is a discipline.
4. **Never use an identity comparison unless you mean identity.** And when you
   do mean it — cycle detection, cache keys, "is this the same node" — say so in
   a comment, because the next reader will assume it is a bug.

## What to take away

1. Every name either holds data or holds a pointer to data; every type is either
   mutable or not. Those two answers explain the entire class of aliasing bugs.
2. Aliasing is only _observable_ when the target is mutable — which is the whole
   argument for immutability by default.
3. "I copied it" is incomplete information. Shallow copies share everything one
   level down.
4. Java and Python pass by value; the value is frequently a reference. A callee
   can mutate through the pointer but cannot rebind the caller's name.
5. Stack allocation is a pointer bump with scope-bound lifetime; heap allocation
   is bookkeeping with arbitrary lifetime. That trade drives everything in
   memory management.
6. Identity and equality are different questions, and caching makes the wrong
   one look correct in testing.

Next: the call stack in detail — how a function call actually works, what a
closure captures, and why recursion has a depth limit.
