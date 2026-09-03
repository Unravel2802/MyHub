---
title: Memory and long-horizon context
minutes: 19
summary: Staying coherent past the context window, and the compaction that makes long sessions possible.
---

A model has no state between calls. Everything it "remembers" is text you resend,
and that text has a hard limit and a per-token cost. Managing what occupies the
context is the central engineering problem of long conversations and long agent
runs.

## The constraint

```text
  every request re-sends the ENTIRE relevant history.

  turn 1     500 tokens
  turn 10    8,000
  turn 50    60,000
  turn 100   context exhausted

  and cost per turn grows with the conversation, so a long
  session is quadratic in total cost.
```

```text
  and quality degrades before the limit:

    lost-in-the-middle — material in the centre of a long
    context is used less reliably
    → a 200k window does not mean 200k of usable working
      memory
```

## The strategies

```text
  TRUNCATION       keep the last N turns
    ✓ trivial
    ✗ loses everything earlier, abruptly

  SUMMARISATION    compress older turns into a summary
    ✓ retains the gist within a bounded budget
    ✗ lossy, and errors COMPOUND across repeated
      summarisation

  RETRIEVAL        store history; retrieve what is relevant
    ✓ scales indefinitely; only pays for what is needed
    ✗ needs an index; may miss relevant history

  STRUCTURED STATE extract facts into a schema and maintain it
    ✓ compact, inspectable, updatable
    ✗ only captures what the schema anticipates

  HYBRID           recent turns verbatim + a running summary
                   + retrieval over the archive
    → what production systems converge on
```

```text
  the standard layout

  ┌──────────────────────────────────────────────┐
  │ SYSTEM PROMPT          stable, prefix-cached  │
  ├──────────────────────────────────────────────┤
  │ STRUCTURED STATE       user facts, task state │
  ├──────────────────────────────────────────────┤
  │ RETRIEVED CONTEXT      relevant to this turn  │
  ├──────────────────────────────────────────────┤
  │ RUNNING SUMMARY        of older conversation  │
  ├──────────────────────────────────────────────┤
  │ RECENT TURNS           verbatim               │
  ├──────────────────────────────────────────────┤
  │ CURRENT MESSAGE                               │
  └──────────────────────────────────────────────┘
      stable at the top → prefix caching works
```

**Ordering is a performance decision.** Stable content first means the prefix
cache covers it, which as the inference topic showed can be a large latency and
cost win. Putting the retrieved context — which changes every turn — above the
system prompt defeats it entirely.

## Compaction

```text
  when the context approaches its budget:

  1. identify what is SAFE to compress
       old tool output, superseded intermediate steps,
       resolved sub-tasks
  2. SUMMARISE it, preserving:
       □  decisions made and WHY
       □  facts established
       □  the current objective
       □  open questions
       □  constraints stated by the user
  3. replace the raw content with the summary
  4. keep recent turns verbatim
```

```text
  what to preserve versus drop

  PRESERVE                     DROP
  ────────                     ────
  the user's stated goal       verbose tool output already
  decisions and rationale        acted on
  constraints and preferences  failed attempts (keep the
  established facts              LESSON, drop the transcript)
  the current state            redundant confirmations
```

**Summarisation error compounds.** Summarising a summary of a summary loses
progressively more, and the drift is invisible — the model behaves as if it knows
things it has forgotten. Compact from the *original* content where you still have
it, rather than re-summarising the summary.

## Structured state beats prose

For anything the system genuinely needs to remember:

```text
  ✗  a prose summary
       "The user mentioned they prefer Python and are working
        on a data pipeline, and earlier said they use Postgres."

  ✓  a structured record
       {
         "language": "python",
         "database": "postgres",
         "project": "data pipeline",
         "constraints": ["no new dependencies"]
       }
```

```text
  ✓ compact
  ✓ INSPECTABLE and correctable by a user
  ✓ updatable in place rather than by re-summarising
  ✓ queryable
  ✓ does not drift with repeated compression
```

The inspectability matters for product reasons as well as technical ones: a user
who can see and edit what the system believes about them is a user who can fix it
when it is wrong.

## Memory types

```text
  WORKING       the current context window
  EPISODIC      past conversations, retrievable
  SEMANTIC      facts extracted about the user or domain
  PROCEDURAL    learned patterns — "this user prefers terse
                answers"
```

```text
  the write path is the hard part

  □  WHAT is worth remembering? (writing everything is
     expensive and noisy)
  □  WHEN to write — at the end of a session, or on a
     detected fact?
  □  CONFLICT: the new fact contradicts a stored one. which
     wins?
  □  DECAY: preferences change. old facts should age out.
  □  DELETION: the user must be able to remove what is stored
     — and it is personal data, per the privacy topic
```

**Extract sparingly.** A memory system that records everything accumulates noise
that degrades retrieval, and it creates a growing privacy surface. Extracting a
handful of durable, high-confidence facts works better than logging every
statement.

## Cost management

```text
  □  PREFIX CACHING — the largest single win for multi-turn.
     stable prefix first, and prompts structured so it is
     reusable.
  □  compact BEFORE the limit, not at it — an emergency
     compaction mid-task loses more
  □  do not resend large tool outputs; store them and
     reference by id
  □  cheaper models for summarisation than for the main task
  □  measure tokens per turn; a rising trend means compaction
     is not keeping up
```

```text
  the tool-output pattern

    a tool returns 40 KB of JSON.
    → store it, put a SUMMARY plus an id in the context
    → the model can request the full content if it needs it

  otherwise every subsequent turn re-sends 40 KB, forever.
```

## Multi-session identity

```text
  □  a stable user identifier
  □  a per-session context that starts fresh but loads
     relevant memory
  □  cross-session retrieval over past conversations
  □  explicit "remember this" and "forget that" affordances
  □  a visible, editable memory view
```

The explicit affordances are worth building. Automatic memory extraction is
unreliable and slightly unsettling; letting a user say "remember that I prefer
X" produces higher-quality memory and better-calibrated trust.

## What to take away

1. A model has no state — everything remembered is text you resend, so a long
   session is quadratic in cost and degrades before the window limit.
2. The converged design is recent turns verbatim, a running summary, retrieved
   history, and structured state, with stable content first for prefix caching.
3. Compact from the original content rather than re-summarising summaries; the
   error compounds invisibly.
4. Structured state beats prose memory — compact, inspectable, correctable and
   drift-free.
5. Extract memories sparingly; a system that remembers everything accumulates noise
   and a privacy surface.
6. Store large tool outputs and reference them by id rather than resending them
   every turn.

Next: making the model's output reliably parseable.
