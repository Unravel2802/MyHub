---
title: What a program actually is
minutes: 24
summary: From source text to instructions a CPU executes, and why the path taken changes everything downstream.
---

You can write working software for years without a clear picture of what
happens between saving a file and the machine doing something. It works until
it doesn't: until a program is fast in a benchmark and slow in production,
until a bug appears only in the release build, until a stack trace points at a
line that cannot possibly be wrong. Every one of those is a question about the
gap between the text you wrote and the instructions that ran. This chapter
closes that gap.

## The only thing a CPU can do

A CPU executes a loop. It has a register holding an address — the _program
counter_ — and it repeats three steps forever:

```text
    ┌──────────────────────────────────────────────┐
    │                                              │
    ▼                                              │
  fetch instruction at [PC]                        │
    │                                              │
    ▼                                              │
  decode it (what operation? which operands?)      │
    │                                              │
    ▼                                              │
  execute it, and update PC ─────────────────────► ┘
    (usually PC+1; a jump sets it to somewhere else)
```

The instructions are tiny: move eight bytes from this address into that
register, add two registers, compare two registers, jump to an address if the
last comparison set the zero flag. There are no strings, no objects, no
functions, no loops. There is memory — one enormous array of bytes — and a
handful of registers, and arithmetic, and conditional jumps.

Everything above that is a fiction that some tool maintains for you. A `for`
loop is a compare and a backward jump. A function call is pushing a return
address and jumping. An object is an address plus an agreement about what lives
at which offset from it. A string is a length and some bytes. None of these
exist at the level that actually runs; they exist in the _translation_.

That is the whole subject of this chapter: who does the translation, and when.

## Three ways to get from source to execution

### Ahead-of-time compilation

A compiler reads your entire program, checks it, and emits machine code for a
specific instruction set before you run anything. C, C++, Rust, Go and Swift
work this way.

```text
  hello.c ──▶ [compile] ──▶ hello.o ──▶ [link] ──▶ ./hello ──▶ CPU
              (per file)      object      (+libs)   machine
                              code                   code
```

The important consequences:

- **Errors are found before shipping.** A type error is a build failure, not a
  3am page.
- **The compiler can see everything, so it can optimise aggressively.** It will
  inline functions, unroll loops, keep values in registers, delete code it can
  prove is unreachable, and reorder anything it can prove is unobservable.
- **The binary targets one architecture and OS.** `x86-64 Linux` and
  `arm64 macOS` need separate builds.
- **The code that runs is not the code you wrote.** This is the one people are
  unprepared for, and the reason a debugger in an optimised build shows the
  line number jumping around and variables "optimised out".

### Interpretation

An interpreter reads your program and executes it directly, usually by walking
a data structure derived from the source. Classic Ruby, older Python and shell
scripts work this way.

```text
  script.py ──▶ [parse] ──▶ AST ──▶ [walk the tree, doing what each node says]
```

There is no separate build step, the source is what ships, and the same file
runs anywhere the interpreter runs. The price is speed: for every addition your
program performs, the interpreter performs dozens of operations deciding _what_
to do. An interpreted loop is routinely 20–100× slower than a compiled one.

### The middle path: bytecode plus a JIT

Nearly every mainstream dynamic language today is a hybrid. Source is compiled
to _bytecode_ — instructions for a virtual machine that does not exist in
hardware — and the VM executes that. Java, C#, Python, JavaScript and Lua all
do this.

```text
  source ──▶ [compile] ──▶ bytecode ──▶ [VM interprets]
                                             │
                                    (this function is hot:
                                     called 10,000 times)
                                             ▼
                                    [JIT compiles it to
                                     machine code] ──▶ CPU
```

A **just-in-time compiler** watches which code actually runs, and compiles the
hot parts to machine code _while the program is running_. This is not a
consolation prize. A JIT knows things an ahead-of-time compiler cannot: which
branch is actually taken, which types actually flow through this function, what
the real values look like. It can specialise on that and then throw the
specialisation away if the assumption stops holding.

This is why JVM and V8 code can approach C speed in steady state, and also why
they are slow for the first few hundred milliseconds, and why microbenchmarks
of JIT languages are so easy to get wrong — measuring before the JIT has warmed
up measures the interpreter.

|                    | AOT compiled        | Interpreted | Bytecode + JIT    |
| ------------------ | ------------------- | ----------- | ----------------- |
| Startup            | Fast                | Fast        | Slow (warm-up)    |
| Steady-state speed | Fastest             | Slowest     | Fast              |
| Errors found       | Build time          | Run time    | Mixed             |
| Deploy artifact    | Per-platform binary | Source      | Portable bytecode |
| Peak memory        | Lowest              | Higher      | Highest           |

Notice that "compiled vs interpreted" is a property of an _implementation_, not
of a language. There are C interpreters and Python compilers. The question is
always "what does this toolchain do", never "what kind of language is this".

## What the compiler is allowed to change

Compilers work under an _as-if_ rule: the emitted program must behave as if it
executed your source exactly, for programs that follow the language's rules.
Anything unobservable is fair game. Consider:

```c
int sum(int n) {
    int total = 0;
    for (int i = 1; i <= n; i++) {
        total += i;
    }
    return total;
}
```

At `-O2`, a modern compiler will not emit a loop. It recognises the pattern and
emits the closed form — roughly `n * (n + 1) / 2` — as a handful of
instructions. The loop you wrote does not exist in the binary.

That is a gift when it makes your code fast, and a trap in three specific
places:

1. **Benchmarks.** If you time a loop whose result you never use, the compiler
   deletes the whole loop and you measure nothing. Real benchmark harnesses have
   a `black_box` / `DoNotOptimize` primitive for exactly this.
2. **Debugging.** Variables are gone, lines are reordered, functions are
   inlined out of existence. Debug builds disable optimisation for this reason,
   and "it only reproduces in release" almost always means undefined behaviour.
3. **Undefined behaviour.** If your program breaks the language's rules — signed
   overflow in C, a data race in almost anything — the as-if rule no longer
   constrains the compiler, because there is no defined behaviour for it to
   preserve. The result is not "some arbitrary value"; it is often whole
   branches being deleted because the compiler proved they could only be reached
   via UB, and therefore assumed they were unreachable.

## The layers underneath your process

Your program does not talk to hardware. It talks to the operating system, which
talks to hardware.

```text
   ┌─────────────────────────────────────────────┐
   │  your code                                  │
   ├─────────────────────────────────────────────┤
   │  language runtime  (GC, scheduler, stdlib)  │  ← may be huge or absent
   ├─────────────────────────────────────────────┤
   │  libc / system call interface               │  ← the OS boundary
   ├─────────────────────────────────────────────┤
   │  kernel  (memory, scheduling, filesystem,   │
   │           network, devices)                 │
   ├─────────────────────────────────────────────┤
   │  hardware                                   │
   └─────────────────────────────────────────────┘
```

Crossing the OS boundary is expensive — hundreds of nanoseconds to a few
microseconds for a syscall, versus around a nanosecond for an arithmetic
instruction. That single fact explains an enormous amount of practical
performance work: buffered I/O exists so that printing a million lines is not a
million syscalls; connection pooling exists so that a request is not a fresh
socket; batching exists everywhere for the same reason.

The **language runtime** is the layer people forget. Go ships a scheduler and a
garbage collector inside every binary. Java ships an entire virtual machine.
Rust and C ship almost nothing. This is why a "hello world" is 2 MB in one
language and 20 KB in another, why some languages can have millions of
concurrent tasks and others cannot, and why interop between two runtimes is
always harder than it looks.

## A worked example: what one line becomes

Take a line of Python:

```python
total = a + b
```

Here is roughly what happens, with everything the fiction was hiding:

```text
  1. bytecode:   LOAD_FAST a
                 LOAD_FAST b
                 BINARY_OP +
                 STORE_FAST total

  2. BINARY_OP is not "add". It is:
       - look at a's type object
       - find its __add__ slot
       - call it with (a, b)
       - if that returns NotImplemented, try b's __radd__
       - if a and b are both small ints, a fast path skips most of this

  3. the result is a NEW heap-allocated object
       (unless it is a small int, which CPython caches: -5..256)

  4. STORE_FAST rebinds the local slot `total` to point at it,
     and drops a reference to whatever `total` pointed at before
```

The same line in C is one `add` instruction. Neither is "better" — the Python
version supports operator overloading, arbitrary-precision integers and
duck typing, and you are paying for those features on every addition whether
you use them or not. Understanding what you are paying for is the point.

## What this buys you in practice

- When someone says "just rewrite it in a faster language", you can ask the
  right question: is this workload dominated by interpreter overhead, by
  syscalls, by memory traffic, or by waiting on the network? Only the first one
  is fixed by the rewrite.
- When a bug appears only in release, you look for undefined behaviour, not for
  a compiler bug. It is almost never a compiler bug.
- When a benchmark says a function takes 0.3 ns, you know that is less than one
  clock cycle and the function was deleted.
- When startup latency matters — a CLI, a serverless function — you know the
  runtime and the JIT warm-up are the things to look at, before your own code.

## What to take away

1. Hardware executes a fetch-decode-execute loop over tiny instructions. Every
   abstraction above that is maintained by a translation step.
2. "Compiled" versus "interpreted" describes an implementation, not a language;
   most modern runtimes are bytecode plus a JIT, which is why they are slow to
   start and fast in steady state.
3. Compilers may change anything unobservable. That deletes your benchmarks,
   scrambles your debugger, and turns undefined behaviour into deleted branches.
4. Syscalls cost roughly a thousand times an arithmetic instruction, which is
   the reason buffering, pooling and batching exist everywhere.
5. The language runtime is a real layer with real cost — in binary size,
   startup time, memory, and what concurrency model you can have.

Next: what a _value_ is once you look underneath — and why "a variable holds a
value" is the single most misleading sentence in programming.
