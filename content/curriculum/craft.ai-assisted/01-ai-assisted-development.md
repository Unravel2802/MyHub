---
title: AI-assisted development
minutes: 15
summary: Models and agents in the loop — where they genuinely help, how to review their output, and where they don't belong yet.
---

An AI coding assistant changes what part of the work is expensive. Typing
code becomes nearly free; understanding, verifying, and taking responsibility
for what it produced does not become any cheaper — and treating the two as
equally solved is where most of the real risk in this workflow lives.

## What actually gets faster

```text
  GENUINELY FASTER
    ✓  boilerplate — a CRUD repository, a form's validation
       wiring, a test file's setup/teardown scaffolding
    ✓  translating a CLEAR spec into code in an unfamiliar
       language/framework
    ✓  a first draft to react to, when starting from a blank
       file is the hard part

  NOT MADE FASTER, JUST FASTER TO PRODUCE
    ✗  the DESIGN decision of where a boundary goes, what the
       data model should be — an assistant can propose one,
       but evaluating whether it's the RIGHT one still needs
       the same judgment it always needed
    ✗  understanding WHY a change is needed — the assistant
       can execute a decision quickly; it doesn't make the
       decision correct
```

```text
  → the risk this creates: code that LOOKS complete and
    confident is easier to under-review than code that looks
    rough — a fluent, well-formatted wrong answer reads as more
    trustworthy than it deserves to, purely because of how
    polished the output looks.
```

## Reviewing AI-generated code

```text
  the same code-review discipline applies, with ONE addition:
  an AI assistant can be confidently, fluently WRONG in ways a
  human reviewer's intuition for "this looks off" doesn't
  always catch, because the output doesn't have the tells of
  human uncertainty (hedging, a comment admitting "not sure
  this handles X").
```

```text
  → verify against the SAME bar as human-written code: does it
    handle the edge cases, does it match the codebase's
    existing patterns, is the abstraction the right shape —
    plus specifically checking for a few AI-generated failure
    modes:

    ✗  a plausible-sounding API call to a function/method that
       DOESN'T EXIST (a "hallucinated" API) — confident,
       correctly-formatted, and wrong
    ✗  code that solves a slightly DIFFERENT problem than the
       one asked, because the prompt was ambiguous and the
       model picked one reasonable interpretation
    ✗  a security-relevant edge case skipped silently — input
       validation, an authorization check — with nothing in the
       output flagging the gap
```

## Where an agent should and shouldn't operate autonomously

```text
  the useful distinction is REVERSIBILITY and BLAST RADIUS —
  the same criteria that govern any autonomous action, applied
  specifically to code changes:

    LOWER RISK, more autonomy reasonable
      a local, reversible change — editing a file, running
      tests, iterating in a sandbox nothing else depends on

    HIGHER RISK, needs a human checkpoint
      anything hard to reverse or affecting shared state —
      pushing to a shared branch, running a migration against
      a real database, deleting data, deploying
```

```text
  → this project's own CLAUDE.md is a real-world instance of
    this exact judgment: it explicitly delegates full
    implementation to an agent for MOST of the codebase, while
    keeping migrations, published contracts, and correctness-
    critical domain logic as the parts a human (or a more
    careful review pass) still owns directly — the split isn't
    "AI vs. no AI," it's "which changes are cheap to reverse if
    wrong."
```

## Prompting as a design skill, not a trick

```text
  "add validation"                    ✗ validation of WHAT
                                          rule, returning WHAT
                                          on failure, to WHOM

  "add validation that email contains
  '@', returning a ValidationError
  with the field name — matching the
  pattern in backend/rest/errors.ts"    ✓ the same
                                            specificity a
                                            human teammate
                                            would need to do
                                            this correctly
                                            without guessing
```

```text
  → a vague prompt gets a plausible guess at what you meant,
    the same way a vague ticket gets a plausible guess from a
    human engineer — the fix for both is the same specificity,
    not a special "prompting trick."
```

## What to take away

1. An AI assistant makes typing code cheap; it does not make the underlying
   design decision or the verification of correctness any cheaper — treating
   the two as equally solved is the real risk.
2. Fluent, well-formatted output reads as more trustworthy than it deserves
   to — polish is not evidence of correctness.
3. Review AI-generated code against the same bar as human code, plus
   specifically checking for hallucinated APIs, silently-solved-a-different-
   problem, and silently-skipped security edge cases.
4. Autonomy should scale with reversibility and blast radius, the same
   criteria that govern any automated action — this project's own delegation
   split (full implementation for most code, human ownership of migrations
   and correctness-critical logic) is exactly that judgment applied.
5. A vague prompt gets a plausible guess, the same way a vague ticket does
   from a human — the fix is the same specificity a human teammate would
   need, not a special prompting trick.
