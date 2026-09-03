---
title: Agents and tool use
minutes: 20
summary: Letting a model take actions, the loop that drives it, and the failure modes that follow.
---

An agent is a model in a loop with tools: it decides what to do, does it, observes
the result, and decides again. That structure turns a text generator into
something that can accomplish tasks — and introduces every failure mode of a
distributed system driven by a probabilistic controller.

## The loop

```text
  ┌─────────────────────────────────────────────┐
  │  observe state / conversation                │
  │        │                                     │
  │        ▼                                     │
  │  MODEL decides: respond, or call a tool      │
  │        │                                     │
  │        ▼                                     │
  │  execute the tool                            │
  │        │                                     │
  │        ▼                                     │
  │  append the result to the context ───────────┘
  │
  │  until: a final answer, a step limit, or a failure
  └──────────────────────────────────────────────
```

```text
  every iteration APPENDS to the context.

  → context grows monotonically
  → cost per step grows
  → and eventually the window is exhausted
  → which is why context management (next topic) is the
    binding constraint on long agent runs
```

## Tool definitions are prompts

```text
  {
    "name": "search_orders",
    "description":
      "Search a customer's orders by date range or status.
       Use when the user asks about past orders. Does NOT
       cancel or modify anything.",
    "parameters": {
      "customer_id": {"type": "string", "required": true},
      "status": {"enum": ["pending","shipped","delivered"]},
      "from_date": {"type": "string", "format": "date"}
    }
  }
```

```text
  the description is the ONLY thing the model has to decide
  with. it is a prompt, and it should say:

    □  what the tool does
    □  WHEN to use it
    □  when NOT to use it       ← most often omitted
    □  what it returns
    □  any side effects
```

```text
  □  fewer tools work better — past roughly 10–20 the model
     starts choosing badly
  □  make them ORTHOGONAL; overlapping tools cause thrashing
  □  use ENUMS rather than free-text parameters wherever
     possible
  □  return STRUCTURED, COMPACT results — a 50 KB JSON blob
     consumes the context and buries the answer
```

**Error messages are also prompts.** A tool that fails should return something the
model can act on:

```text
  ✗  "Error: 400"
  ✓  "Invalid date format. Expected YYYY-MM-DD, got '3rd
      March'. Retry with the corrected format."
```

The second lets the model self-correct in one step; the first causes it to retry
identically or give up.

## The patterns

```text
  ReAct            reason, act, observe, repeat
                   → the standard single-agent loop

  PLAN-AND-EXECUTE plan the full sequence first, then execute
                   → fewer model calls; brittle when reality
                     diverges from the plan

  REFLECTION       act, critique the result, retry
                   → helps when the model can evaluate better
                     than it can generate

  MULTI-AGENT      specialised agents with a coordinator
                   → appealing on a diagram; expensive, hard
                     to debug, and frequently WORSE than one
                     well-prompted agent

  ROUTER           classify the request, dispatch to a
                   specialised handler
                   → simple, reliable, under-used
```

**Try a single agent with good tools before a multi-agent architecture.**
Multi-agent systems multiply the failure modes, the cost and the latency, and the
communication between agents is itself lossy. The cases where they genuinely win
are ones with real parallelism or genuinely separate contexts.

## Failure modes

```text
  LOOPS              calling the same tool repeatedly with the
                     same arguments
                     → detect repetition; cap iterations

  DRIFT              losing the original objective over many
                     steps
                     → restate the goal periodically in context

  CASCADING ERRORS   an early mistake propagates and is never
                     revisited

  CONTEXT EXHAUSTION the window fills with tool output

  OVER-TOOLING       calling tools when it already knows the
                     answer
  UNDER-TOOLING      answering from memory when it should have
                     looked it up

  HALLUCINATED CALLS inventing tools or parameters
                     → schema validation catches this

  PARTIAL FAILURE    a multi-step task half-completes
                     → the saga problem from distributed
                       transactions, now with a probabilistic
                       controller
```

That last one deserves the connection made explicitly: **an agent performing a
sequence of side-effecting actions is a saga**, and it needs the same treatment —
compensating actions, an explicit pivot point, idempotent steps, and a durable
record of progress. Agents that book flights, send emails or move money without
that structure will eventually half-complete something.

## Safety and permissions

```text
  the model's tool calls are UNTRUSTED INPUT to your system.

  □  LEAST PRIVILEGE — scope credentials per user and per
     session, not per application
  □  VALIDATE every argument server-side; the model can and
     will produce nonsense
  □  APPROVAL GATES for irreversible or expensive actions
  □  RATE LIMIT tool calls per session
  □  SANDBOX anything executing code
  □  AUDIT every call with the reasoning that led to it
  □  never let tool RESULTS be treated as instructions
```

The last line is the prompt-injection boundary from the prompting chapter, and it
is far more dangerous here: a document retrieved by an agent, or a web page it
reads, can contain instructions. **An agent with a browsing tool and an email tool
can be induced by a web page to exfiltrate data.**

```text
  the durable defence is CAPABILITY, not detection:

    what is the worst thing this agent can do if it is fully
    controlled by an attacker?

  → design so that the answer is acceptable
```

## Making agents reliable

```text
  □  CONSTRAIN the action space — fewer, safer tools
  □  make steps IDEMPOTENT and retryable
  □  CHECKPOINT progress so a failure can resume
  □  cap iterations and cost per task
  □  VERIFY results where possible — run the tests, check the
     schema, confirm the row exists
  □  fall back to a human on repeated failure
  □  log the full trace: state, decision, call, result
```

**Verification is what separates agents that work from agents that demo.** An
agent that writes code and runs the tests has a ground-truth signal; one that
writes code and asserts it is correct does not. Wherever a checkable outcome
exists, checking it converts a probabilistic system into a reliable one.

## Evaluation

```text
  TASK COMPLETION   did it achieve the goal? (end-to-end,
                    on a labelled set)
  EFFICIENCY        steps, tokens, cost, wall-clock
  TOOL ACCURACY     right tool, right arguments
  SAFETY            did it do anything it should not?
  RECOVERY          does it handle tool failures?
```

```text
  agent evaluation is EXPENSIVE and NOISY — multi-step runs
  compound variance.

  → run several trials per task and report a success RATE
  → build a fixed task set with deterministic mock tools for
    CI, and a smaller live set for release gates
```

Mock tools in CI are the practical answer to cost and flakiness: the loop is
exercised deterministically, and only the release gate pays for real calls.

## What to take away

1. An agent is a loop whose context grows monotonically — context management is the
   binding constraint on long runs.
2. Tool descriptions are prompts, and the most-omitted part is when *not* to use
   the tool; error messages are prompts too.
3. Fewer, orthogonal tools work better; try one well-prompted agent before a
   multi-agent architecture.
4. An agent taking side-effecting actions is a saga and needs the same treatment:
   idempotent steps, compensations, a pivot, and durable progress.
5. Tool results are untrusted input; the durable defence against injection is
   least privilege on what the agent can do, not detection.
6. Verification against a checkable outcome is what separates agents that work from
   agents that demo.

Next: keeping an agent coherent over a long session — memory and context
management.
