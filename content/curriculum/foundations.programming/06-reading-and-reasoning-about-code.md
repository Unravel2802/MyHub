---
title: Reading and reasoning about code
minutes: 22
summary: Invariants, mental execution, and the skill that dominates writing in every real codebase.
---

You will spend far more time reading code than writing it — the commonly cited
ratio is ten to one, and on a mature system it is worse. Yet reading is taught
almost nowhere, and most engineers do it by scanning until something looks
familiar. It is a learnable skill with actual technique, and it is the skill
that separates someone who is productive in a new codebase in a week from
someone who is productive in a quarter.

## Why reading is harder than writing

When you write, you have the intent in your head and you are producing text
from it. When you read, you have text and must reconstruct the intent — a
strictly harder direction, and the information you need was often never written
down.

Worse, working memory holds famously few things at once. A function that
requires you to track seven interacting variables is not "complex" in the
abstract; it exceeds a specific human limit, and past that limit comprehension
does not degrade gracefully, it fails. This is why guidance about function
length and nesting depth exists at all — not aesthetics, but a budget.

```text
  cost of understanding

     │                                    ╱
     │                                  ╱
     │                               ╱          ← past ~7 live variables,
     │                          ╱                  you stop tracking and
     │                    ╱                        start guessing
     │           ╱────
     │  ────
     └──────────────────────────────────────
        number of things you must hold at once
```

## Invariants: the thing to look for first

An **invariant** is a statement that is always true at a given point. They are
the load-bearing structure of any codebase, and they are usually undocumented —
which is why breaking one is the easiest way to introduce a bug in unfamiliar
code.

```python
class RingBuffer:
    def __init__(self, capacity):
        self._items = [None] * capacity
        self._head = 0
        self._count = 0
    # invariants, holding before and after every public method:
    #   0 <= self._count <= len(self._items)
    #   0 <= self._head  <  len(self._items)
    #   the live elements are _items[(_head + i) % cap] for i in range(_count)
```

Method bodies are allowed to break invariants _temporarily_ — that is what a
method is for — but must restore them before returning. Reading code
invariant-first turns a wall of statements into a small number of questions:
what must be true here, which lines could break it, and is it restored?

Three ways to find invariants when nobody wrote them down:

- **Read the constructor.** It establishes the initial ones.
- **Read the assertions and the guard clauses.** Each is an invariant someone
  cared enough to check.
- **Read the tests.** A test is an executable claim about what must hold.

When you work out an invariant that was not written down, **write it down.** It
is the highest-value comment there is, because it cannot be recovered from the
code without doing the work you just did.

## Mental execution, done properly

"Just trace through it" fails because people trace vaguely. Do it concretely:
pick actual values and write the state down.

```python
def merge(a, b):
    out, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    return out + a[i:] + b[j:]
```

```text
  a = [1, 4]   b = [2, 3]

  i  j  a[i]  b[j]  taken   out
  ─  ─  ────  ────  ─────   ─────────
  0  0   1     2     a[0]   [1]
  1  0   4     2     b[0]   [1,2]
  1  1   4     3     b[1]   [1,2,3]
  1  2    -     -    exit   [1,2] + a[1:] + [] = [1,2,3,4]
```

Then — and this is the part that finds bugs — trace the cases you would rather
not:

- Empty inputs. `merge([], [])`, `merge([1], [])`.
- One element.
- All elements equal. (Does `<=` vs `<` change stability here? Yes.)
- The loop exiting immediately.
- The largest realistic size, for overflow and for cost.

Bugs live at boundaries. Tracing the happy path confirms what you already
believed; tracing the boundary is where you learn something.

## Reading a codebase you have never seen

A structured approach beats wandering. Roughly two hours, in this order:

1. **Read the README and the top-level directory listing.** Ten minutes. You are
   after vocabulary — the nouns this system uses — not understanding.
2. **Find the entry points.** `main`, the route table, the CLI definition, the
   job registry. Everything is downstream of one of these.
3. **Follow ONE request all the way through.** Pick the simplest real operation
   and trace it from entry to response, opening every file it touches. This one
   exercise teaches you the layering, the conventions, the error style and the
   data model at once — far more than reading ten files in isolation.
4. **Read the data model.** Schema, migrations, core types. The shape of the
   data constrains everything the code can be.
5. **Read the tests for the module you must change.** They are a specification
   with worked examples.
6. **Check the git history of the file you are about to edit.**
   `git log -p --follow <file>` and `git blame`. Why a line exists is usually
   findable, and "why" is what you actually need.

Resist the urge to read everything. Comprehension is depth-first, one path at a
time — breadth-first over a large codebase produces a vague sense of having read
a lot and no ability to change anything.

## Chesterton's fence

> Do not remove a fence until you know why it was put there.

Weird code is not automatically bad code. That redundant-looking null check, the
retry with an oddly specific count, the sleep before a call — each is often a
scar from an outage. Before deleting something strange:

```bash
git log -S "the_strange_line" --oneline
```

`-S` finds commits where that string was added or removed. The commit message,
and any linked ticket, usually explains it in one line. If the reason is
genuinely gone — the API it worked around was fixed — delete it _and say so in
the commit message_, so the next person does not have to redo this.

## Names, and what they are hiding

Names are the highest-bandwidth documentation in a codebase, and the most
reliable signal of trouble.

| Name                                | What it usually means               |
| ----------------------------------- | ----------------------------------- |
| `data`, `info`, `manager`, `helper` | Nobody knew what this was           |
| `process()`, `handle()`             | Does several unrelated things       |
| `flag`, `temp`, `result2`           | Written in a hurry, never revisited |
| `utils.py` at 2,000 lines           | A module that was never designed    |
| `doXAndY()`                         | Two functions in a trench coat      |

A name that requires a comment to explain it is a name that should change.
Conversely, when you find genuinely precise names — `pending_settlement`,
`retryable_error`, `expand_phase_migration` — you are in a codebase where
somebody was thinking, and you can trust the structure more.

## Reading for a specific purpose

You almost never need to understand a file. You need to answer a question, and
different questions want different reading strategies:

- **"Where does X happen?"** Don't read — search. Grep for the user-visible
  string, the error message, the endpoint path, the column name. Text search
  beats navigation for locating things.
- **"What breaks if I change this?"** Find callers, not implementations. Then
  find the tests covering those callers. Then check whether it is public API.
- **"Why is this slow?"** Do not read at all first. Profile. Reading code to
  guess at performance is famously unreliable — the bottleneck is somewhere you
  would not have looked.
- **"Is this correct?"** Invariants and boundaries, as above. Trace the empty
  case and the maximum case.
- **"How do I use this?"** Read the tests before the implementation. They are
  usage examples that are guaranteed to compile and pass.

## Complexity you can measure

Two quick, honest metrics:

**Cyclomatic complexity** — the number of independent paths through a function,
which is roughly `1 + the number of branch points` (`if`, `&&`, `case`, loops,
`catch`). It is also a lower bound on how many tests you need for full path
coverage.

```text
  1–5    simple, one sitting
  6–10   needs attention when changing it
  11–20  refactor before touching
  20+    nobody understands this, including its author
```

**Nesting depth** — how many levels of indentation the deepest line sits at.
Depth 4+ is almost always fixable, usually by inverting conditions and returning
early:

```python
# depth 4                          # depth 1
if user:                           if not user:      return None
    if user.active:                if not user.active: return None
        if user.has_plan:          if not user.has_plan: return None
            return charge(user)    return charge(user)
```

The right-hand version reads top to bottom as a list of preconditions followed
by the point of the function. Nothing is nested, and the happy path is not
indented into the margin. This transform — **guard clauses** — is the single
highest-yield readability change available.

Neither metric is a target to optimise. They are smoke detectors: useful for
noticing, useless as a goal.

## What to take away

1. Reading dominates writing, is harder than writing, and has technique.
   Comprehension fails past roughly seven simultaneously live facts.
2. Find the invariants first — from the constructor, the assertions and the
   tests — and write down any you had to reconstruct.
3. Trace with real values on paper, and trace the boundaries: empty, one, all
   equal, maximum. The happy path teaches you nothing you did not assume.
4. To learn a codebase, follow one request end to end rather than reading
   broadly. Depth-first beats breadth-first.
5. Strange code is often a scar; `git log -S` usually explains it in one line.
6. Guard clauses, precise names and shallow nesting are what make the next
   reader's job possible — and the next reader is usually you.

That completes the programming fundamentals. Next in the track: **Data
Structures**, where the question shifts from "how does a program run" to "how
should the data be arranged so the operations you need are cheap".
