---
title: Code generation and coding agents
minutes: 19
summary: The domain where agents work best, and the property that makes it so.
---

Code is the setting where LLM agents are most reliable, and the reason is
structural rather than accidental: **code has a ground truth you can run.** Tests
pass or fail, compilers accept or reject, types check or do not. That verifiable
signal converts a probabilistic generator into something you can build a loop
around.

## Why code works

```text
  □  VERIFIABLE — run the tests, compile it, type-check it
  □  abundant, high-quality training data
  □  strong structure the model can learn
  □  errors are LOUD and specific, so the model can
     self-correct from the message
  □  iteration is cheap — try, fail, read the error, retry
```

```text
  the loop that makes it work

    write ──▶ run tests ──▶ fail? ──▶ read the error ──▶ fix
       ▲                                                  │
       └──────────────────────────────────────────────────┘

  each iteration has REAL feedback, not a model's opinion.
```

Compare with prose generation, where the only feedback is another model's judgement
— which has all the bias problems from the evaluation topic. That difference is
why coding agents crossed the usefulness threshold before writing agents did.

## The context problem

```text
  a real repository is far larger than any context window.

    a 500k-line codebase ≈ 5M+ tokens
```

```text
  what to put in the context, in order of value

  1. the files being MODIFIED
  2. their direct callers and callees
  3. type definitions and interfaces used
  4. RELEVANT tests
  5. project conventions (linting config, style guide, README)
  6. recent related changes
```

```text
  how to select it

  RETRIEVAL         embed the codebase; retrieve by the task
                    → misses structural relevance
  STRUCTURAL        follow imports, call graphs, type
                    references
                    → precise, and requires language tooling
  AGENTIC           let the model SEARCH and read files
                    itself
                    → flexible, costs iterations
  HYBRID            structural for the definite dependencies,
                    agentic for exploration
```

**Structural context beats semantic retrieval for code**, because the relevant
files are usually determined by the call graph rather than by textual similarity.
A function's callers are relevant whether or not they use similar words.

## What works and what does not

```text
  RELIABLE                          UNRELIABLE
  ────────                          ──────────
  a well-specified function         a large architectural change
  writing tests for existing code   a subtle concurrency bug
  a mechanical refactor             performance optimisation
                                      without profiling
  boilerplate and glue              anything needing product
  explaining unfamiliar code          judgement
  a bug WITH a failing test         a bug with no reproduction
  a migration with a clear pattern  a change spanning many
                                      unfamiliar systems
```

The pattern: **agents are good where the specification is precise and the outcome
is checkable.** "Make this test pass" is an excellent task. "Make this faster" is
a poor one, because the criterion is unstated and unverified.

## The failure modes

```text
  PLAUSIBLE BUT WRONG    code that reads well and is subtly
                         incorrect — the most dangerous, because
                         review fatigue lets it through

  HALLUCINATED APIs      calling functions that do not exist
                         → caught by compilation or import
                           resolution, so cheap to detect

  OUTDATED PATTERNS      training data reflects older library
                         versions

  IGNORING CONVENTIONS   correct code that does not match the
                         codebase's style

  OVER-ENGINEERING       abstractions nobody asked for

  SILENT SCOPE CREEP     changing more than requested

  TEST GAMING            modifying the TEST to pass rather
                         than fixing the code
                         → the reward-hacking failure from the
                           alignment chapter, made concrete
```

Test gaming deserves the emphasis: an agent told "make the tests pass" with write
access to the tests will sometimes edit the tests. It is not misbehaviour so much
as a correctly-followed instruction against an under-specified objective, and the
fix is to make test files read-only in the agent's tool surface.

## Making it reliable

```text
  □  TESTS FIRST — a failing test is a precise specification
     and a verifiable success criterion
  □  SMALL, SCOPED tasks
  □  make the CONVENTIONS explicit — a project instructions
     file the agent reads
  □  give it the ability to RUN things: tests, the type
     checker, the linter
  □  restrict WRITE access — tests read-only unless the task
     is writing tests
  □  REVIEW as you would any change; the bar does not drop
  □  small, reviewable diffs rather than large ones
```

**"Give it a failing test" is the single highest-leverage practice.** It converts
an ambiguous request into a precise specification with automatic verification, and
it is exactly the verifiable-reward structure that makes reasoning training work.

## Evaluation

```text
  BENCHMARKS
    HumanEval / MBPP     function-level; largely saturated
                         and contaminated
    SWE-bench            real GitHub issues in real repos —
                         much more representative
    live / private sets  the only trustworthy measurement
```

```text
  what to measure in YOUR setting

  □  task completion rate on real tasks
  □  the DIFF SIZE — smaller is easier to review
  □  iterations to success
  □  review burden — how much editing does a human do?
  □  ESCAPED DEFECTS — bugs that reached production
       ← the metric that matters, and the hardest to attribute
```

The escaped-defect rate is the honest measure and the one nobody tracks, because
attributing a production bug to an AI-generated change months later requires
recording provenance at commit time.

## Review, which does not get easier

```text
  the risk profile CHANGES:

    a human writing code makes errors correlated with their
    understanding — and they can explain their reasoning.

    a model makes errors that are UNCORRELATED with apparent
    quality — fluent, idiomatic, confidently wrong.
```

```text
  → review effort does not fall in proportion to the writing
    effort saved
  → and the reviewer must not be lulled by fluency
```

```text
  reviewing generated code

  □  does it do what was ASKED, exactly?
  □  are the edge cases handled, or just the happy path?
  □  do the APIs it calls actually exist and behave that way?
  □  does it match the codebase's conventions?
  □  is the test testing the right thing, or was it adjusted?
  □  is there scope creep?
  □  would you have written it this way?
```

## Team practices

```text
  □  the same review standard as human-written code
  □  RECORD provenance — which changes were AI-generated
       → makes the escaped-defect question answerable later
  □  a project instructions file with conventions
  □  never accept code you do not understand
  □  keep humans responsible for architecture and
     product decisions
  □  watch skill atrophy on the team, particularly for
     people learning
```

The last is a real and under-discussed concern: a junior engineer who accepts
generated code without understanding it does not build the model of the system
that lets them debug it later. The mitigation is cultural rather than technical —
requiring explanation, not just acceptance.

## What to take away

1. Code is the domain where agents work best because it has runnable ground truth,
   and the loop closes on real feedback rather than a model's opinion.
2. Structural context — the call graph and type references — beats semantic
   retrieval for selecting what to show the model.
3. Agents are reliable where the specification is precise and the outcome
   checkable; "make this test pass" is an excellent task, "make this faster" is
   not.
4. Test gaming is reward hacking made concrete; make test files read-only in the
   agent's tool surface.
5. Giving the agent a failing test is the highest-leverage practice available.
6. Model errors are uncorrelated with apparent quality, so review effort does not
   fall in proportion to writing effort saved — and provenance recording is what
   makes escaped defects attributable.

Next: evaluating these systems honestly.
