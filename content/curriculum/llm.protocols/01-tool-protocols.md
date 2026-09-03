---
title: Tool protocols and interop
minutes: 18
summary: Wiring a model to real systems, and the standards emerging around it.
---

Every model provider invented its own way to describe tools, and every
integration was bespoke. The convergence around shared protocols matters for a
practical reason: it turns an N×M integration problem into N+M.

## Function calling

```text
  the flow

  1. you send the model a request PLUS tool schemas
  2. the model responds with a tool CALL — a name and
     arguments — rather than text
  3. YOU execute it (the model never does)
  4. you send the result back
  5. the model continues
```

```text
  what the model actually produces is TOKENS shaped like a
  call. the provider parses them.

  → so it inherits every property of generation: it can
    hallucinate a tool, produce invalid arguments, or call
    the wrong one
  → which is why schema validation server-side is mandatory,
    not defensive
```

**Parallel tool calls** are supported by most current models: the model can emit
several calls in one turn, which you execute concurrently. This matters for
latency — three sequential round trips become one — and it requires your executor
to actually run them in parallel rather than in a loop.

## Model Context Protocol

MCP standardises how a model-facing application connects to external
capabilities.

```text
  ┌─────────────┐         ┌──────────────────────┐
  │  HOST       │ ◀─MCP─▶ │  SERVER              │
  │  (the app   │         │  exposes:            │
  │   with the  │         │    TOOLS     (actions)│
  │   model)    │         │    RESOURCES (data)   │
  └─────────────┘         │    PROMPTS   (templates)
                          └──────────────────────┘
```

```text
  the point:

    WITHOUT a standard: every app × every integration
    WITH:               every app speaks MCP; every
                        integration speaks MCP

    N × M   →   N + M
```

```text
  the three primitives

  TOOLS       model-invoked actions, with side effects
  RESOURCES   application-controlled data the model can read
  PROMPTS     user-invoked templates
```

The distinction between tools and resources is the useful part of the design:
**a tool is something the model decides to invoke; a resource is something the
application decides to provide.** Conflating them is how applications end up
letting the model choose to read things it should simply have been given — or
letting it act when it should only have been reading.

Transport is stdio for local servers and HTTP with server-sent events for remote
ones, which means an MCP server can be a local process or a hosted service with no
change to the host.

## The security model, which is the important part

```text
  an MCP server (or any tool) is CODE running with some set
  of permissions, driven by a probabilistic controller,
  reading untrusted content.
```

```text
  the questions to answer before connecting one

  □  what can this server actually DO?
  □  with WHOSE credentials, and scoped how?
  □  can its output influence subsequent model decisions?
     (yes — always)
  □  is it reading content an attacker can write?
  □  what is the worst case if it is fully controlled?
```

```text
  THE COMPOSITION HAZARD

    a server that READS untrusted content
    + a server that TAKES CONSEQUENTIAL ACTION
    = an injection path from the content to the action

  each is safe alone. together they are a vulnerability, and
  neither server's author can see it.
```

That composition problem is the genuinely hard part of tool ecosystems, and it has
no clean technical answer yet. The practical mitigations:

```text
  □  LEAST PRIVILEGE per server, per session, per user
  □  approval gates on irreversible actions
  □  do not combine untrusted-content readers with
     high-privilege actors in one session unless necessary
  □  audit the full trace: what was read, what was decided,
     what was done
  □  treat all tool output as untrusted data, never as
     instructions
```

## Designing a tool surface

```text
  □  FEW tools, ORTHOGONAL
  □  descriptions that say when NOT to use them
  □  enums over free text
  □  compact structured results — not raw API dumps
  □  actionable error messages
  □  IDEMPOTENT where possible, and idempotency keys where not
  □  separate READ tools from WRITE tools clearly, so
     permissions can differ
```

The read/write separation is worth designing in from the start: it lets you give
an agent broad read access and narrow, gated write access, which is the shape most
real deployments want.

## Interop beyond tools

```text
  □  OpenAI-compatible chat completions has become a de facto
     API shape, which many self-hosted servers implement —
     so clients are portable
  □  OpenTelemetry conventions for LLM spans are emerging,
     which makes tracing across providers uniform
  □  evaluation harnesses and prompt formats remain
     fragmented
```

**Design for provider portability.** Wrap model calls behind your own interface,
keep prompts and tool schemas in your own format, and translate at the edge. The
cost is a thin adapter; the benefit is that changing provider — for price, for
capability, or because one is down — is a configuration change rather than a
project.

## What to take away

1. A tool call is generated tokens shaped like a call, so it inherits every
   generation failure mode — server-side schema validation is mandatory.
2. Parallel tool calls turn sequential round trips into one, if your executor
   actually runs them concurrently.
3. MCP turns N×M integrations into N+M, and its tool/resource distinction separates
   what the model chooses to invoke from what the application chooses to provide.
4. The composition hazard — a content-reading server plus an action-taking server —
   is a vulnerability neither author can see.
5. Separate read tools from write tools so permissions can differ, and make writes
   idempotent or keyed.
6. Wrap model calls behind your own interface so changing provider is configuration
   rather than a project.

Next: applying all of this to code — the domain where agents work best.
