---
title: The call stack and closures
minutes: 25
summary: What a function call costs, what a closure captures, and why recursion has a ceiling.
---

A stack trace is the most useful debugging artifact there is, and most people
read one without knowing what it is a picture of. It is a picture of the call
stack: a literal region of memory, with a literal structure, that the CPU
maintains as your program runs. Understanding it explains stack overflows,
closure capture bugs, why tail recursion matters in some languages and not
others, and what an `async` function actually does differently.

## A frame per call

When a function is called, a **stack frame** is pushed. It holds everything that
call needs and nothing that outlives it:

```text
  void outer() {  int a = 1;  inner(a);  }
  void inner(int x) { int y = x + 1; }

  stack while inner() is executing:

    ┌──────────────────────────┐  ◀── stack pointer (top)
    │ inner's frame            │
    │   y            = 2       │
    │   x (param)    = 1       │
    │   return addr  → outer+0x14
    │   saved frame ptr        │
    ├──────────────────────────┤
    │ outer's frame            │
    │   a            = 1       │
    │   return addr  → main+0x08
    │   saved frame ptr        │
    ├──────────────────────────┤
    │ main's frame             │
    └──────────────────────────┘
```

The **return address** is the whole trick. `call` pushes the address of the
instruction after itself, then jumps. `ret` pops that address into the program
counter. That is the entire mechanism by which a function knows where to go
back to — and it is why a stack trace exists at all: walking the saved frame
pointers and reading the return addresses reconstructs who called whom.

It is also why buffer overflows on the stack are so dangerous. Writing past the
end of a local array writes over the saved return address, and `ret` then jumps
wherever the attacker chose. Stack canaries, ASLR and non-executable stacks are
all defences against exactly this picture.

## What a call actually costs

Roughly, in the non-inlined case:

| Step                                            | Approximate cost                       |
| ----------------------------------------------- | -------------------------------------- |
| Push arguments (often just registers)           | ~0–1 cycles                            |
| `call` — push return address, jump              | ~1–2 cycles, plus possible branch miss |
| Prologue — save registers, adjust stack pointer | a few cycles                           |
| Epilogue + `ret`                                | a few cycles                           |

So: a handful of nanoseconds at worst, and frequently zero, because the
compiler **inlines** small functions — pasting the body at the call site and
deleting the call entirely. This is why "extract that into a function" is
essentially never a performance concern in a compiled language, and why
micro-optimising by hand-inlining is almost always a mistake: you have made the
code worse to duplicate work the compiler already does.

The exception worth knowing: inlining cannot happen through a **dynamic**
call whose target is unknown — a virtual method with many implementations, a
function pointer, an interface value. JITs handle this with _inline caching_:
observe that this call site has hit the same type 10,000 times, speculate,
inline, and guard the assumption with a cheap type check. When the speculation
breaks, the code is deoptimised. This is also why a megamorphic call site — one
that sees many different types — is genuinely slower, and why "make it generic"
sometimes costs measurable performance in a JIT language.

## Recursion and the ceiling

Recursion works because each call gets its own frame. That is also the limit:

```text
  factorial(4)

    ┌─────────────────┐
    │ factorial(1)    │  ← 4 live frames at the deepest point
    ├─────────────────┤
    │ factorial(2)    │
    ├─────────────────┤
    │ factorial(3)    │
    ├─────────────────┤
    │ factorial(4)    │
    └─────────────────┘
```

Stack size is fixed at thread creation — typically 1 MB on Windows, 8 MB on
Linux main threads, often 512 KB–1 MB for spawned threads, and much smaller for
green threads (a Go goroutine starts at 2–8 KB and grows). Divide by frame size
and you get your depth limit: usually tens of thousands of frames, sometimes far
fewer if frames are large.

Two failure modes, and they are different:

- **Deep but finite recursion** on a large input — walking a linked list of a
  million nodes recursively, or a degenerate BST that is really a list. This is a
  correctness bug that only appears at scale.
- **Missing base case** — infinite recursion. This is a plain bug, and the stack
  overflow is the symptom, not the disease.

CPython adds its own guard (`sys.setrecursionlimit`, default 1000) so you get a
clean `RecursionError` instead of a hard crash. Raising it does not raise the
actual stack limit; it just moves where you crash from Python's check to the
operating system's.

### Tail calls

If the recursive call is the _last_ thing a function does, the current frame is
dead — nothing happens after the call returns except returning it. A compiler
can therefore reuse the frame instead of pushing a new one, turning the
recursion into a loop with constant stack usage.

```text
  # NOT a tail call — the multiply happens AFTER the call returns
  def fact(n):
      return 1 if n <= 1 else n * fact(n - 1)
                               ^^^^^^^^^^^^^ frame must stay alive

  # tail call — nothing left to do
  def fact(n, acc=1):
      return acc if n <= 1 else fact(n - 1, acc * n)
```

Scheme _requires_ tail call elimination. Most functional languages do it. C and
C++ compilers do it at `-O2` when they can. The JVM does not. **Python does
not, and never will** — Guido's stated reason is that it destroys stack traces,
which he values more than the optimisation. So in Python, the rewrite above buys
you nothing; convert to an explicit loop instead.

## Closures: a function plus captured environment

A closure is a function value that carries part of the environment it was
created in. That environment cannot live on the stack, because the closure
outlives the frame that made it — so it is on the heap.

```python
def make_counter():
    count = 0
    def increment():
        nonlocal count
        count += 1
        return count
    return increment          # the frame dies; `count` does not
```

```text
  make_counter() returns, its frame is popped:

    increment ──▶ ┌──────────────────┐
                  │ code: increment  │
                  │ captured: ───────┼──▶ ┌───────────┐
                  └──────────────────┘    │ count: 0  │   ◀── on the HEAP
                                          └───────────┘
```

Two closures made by two calls to `make_counter` capture two different cells.
Two closures made in the _same_ call share one cell — which is exactly what you
want for a shared counter, and exactly what bites you here:

```python
# The classic. What do these print?
fns = [lambda: i for i in range(3)]
[f() for f in fns]          # [2, 2, 2]   ← not [0, 1, 2]
```

Every lambda captured the same variable `i`, not its value at creation time. By
the time any of them run, the loop has finished and `i` is 2. The fix is to bind
a fresh cell per iteration:

```python
fns = [lambda i=i: i for i in range(3)]     # default arg evaluates NOW
# or
fns = [functools.partial(lambda i: i, i) for i in range(3)]
```

JavaScript had precisely this bug with `var`, and `let` was given per-iteration
binding in ES6 specifically to fix it — which is why `for (let i...)` works and
`for (var i...)` does not. Go had it for loop variables until Go 1.22 changed
the semantics.

**Capture by reference versus by value** is the general question, and languages
answer it differently:

| Language           | Default capture                                               |
| ------------------ | ------------------------------------------------------------- |
| Python, JavaScript | by reference (the variable, not its value)                    |
| Java               | by value, and the captured variable must be effectively final |
| C++                | explicit: `[=]` by value, `[&]` by reference                  |
| Rust               | inferred, or forced with `move`                               |
| Go                 | by reference (per-iteration since 1.22)                       |

Java's restriction looks annoying and is actually a deliberate sidestep: by
forbidding capture of a mutable local, it makes the by-value copy always
correct, and removes the entire bug class above.

## The stack a coroutine does not have

An `async` function cannot use the normal call stack, because it needs to
suspend in the middle and return control to a scheduler — but a stack frame can
only be popped in LIFO order, and a suspended function is not finished.

So the compiler transforms the function into a **state machine** whose local
variables live in a heap-allocated object:

```text
  async def handle():          becomes, roughly:
      a = await read()
      b = compute(a)             ┌────────────────────────┐
      await write(b)             │ state: 0 | 1 | 2 | done│
                                 │ a:     ...             │  ◀── heap
                                 │ b:     ...             │
                                 └────────────────────────┘
                                 resume(): switch on state,
                                 jump to the right point
```

This is why async functions "colour" your code — a normal function cannot await,
because it has no such object — and why a million concurrent async tasks is
cheap while a million threads is not: each task is one small heap object rather
than a megabyte of reserved stack. It also explains why async stack traces used
to be useless: the real caller chain is not on the stack at all, and runtimes
had to learn to reconstruct it.

## Reading a stack trace properly

```text
  Traceback (most recent call last):
    File "app.py", line 42, in handle_request      ← outermost, called first
      result = process(payload)
    File "svc.py", line 17, in process
      return parse(data["body"])
    File "svc.py", line 9, in parse                ← innermost, threw
      return json.loads(raw)
  json.decoder.JSONDecodeError: Expecting value: line 1 column 1 (char 0)
```

- **Read from the bottom for the error, from the top for the story.** The bottom
  frame is where it broke; the frames above it are how you got there.
- **The bottom frame is rarely the bug.** `json.loads` is fine. Something two
  frames up passed it an empty body, and _that_ is the defect.
- **Missing frames mean inlining or tail calls.** Not corruption.
- **Repeated frames** mean recursion; a `[Previous line repeated 996 more times]`
  is a base-case bug.

## What to take away

1. A call pushes a frame holding parameters, locals and a return address. Walking
   those frames is what a stack trace is.
2. Function calls are nearly free and are usually inlined away; hand-inlining is
   almost always a mistake. Dynamic dispatch is what blocks inlining.
3. Stack depth is bounded by a fixed per-thread stack. Deep recursion over
   user-sized data is a correctness bug that appears only at scale.
4. Tail calls can be optimised into loops, but only where the implementation does
   it — and Python deliberately does not.
5. A closure captures the _variable_, not its value, in most languages. The loop
   -variable bug follows directly, and per-iteration binding is the fix.
6. Async functions are compiled into heap-allocated state machines, which is why
   they are cheap in bulk and why they colour the call graph.

Next: types — what a type system is actually checking, and what you get for the
cost of writing them down.
