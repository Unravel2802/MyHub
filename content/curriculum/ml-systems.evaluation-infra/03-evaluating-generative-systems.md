---
title: Evaluating generative systems
minutes: 18
summary: Measuring quality when there is no single correct answer, and building an eval that catches regressions.
---

Classification has a label to compare against. Generation does not: there are many
acceptable answers, quality is multidimensional, and the failure modes are things
like "confidently wrong" that no string comparison detects. This changes what an
evaluation looks like without changing the need for one.

## What breaks

```text
  □  no single correct output — string matching is useless
  □  quality has several dimensions: correctness, relevance,
     tone, safety, format, conciseness
  □  small prompt changes produce large output changes
  □  the model is non-deterministic (unless temperature 0)
  □  BENCHMARK CONTAMINATION — the model may have trained on
     the test set
  □  the failure mode is a confident, plausible falsehood
```

The contamination point deserves emphasis when reading published results: a model
scoring highly on a public benchmark may have memorised it, and the number tells
you nothing about your task. **Your own evaluation set, never published, is the
only trustworthy measurement.**

## The methods

```text
  EXACT / STRUCTURAL
    valid JSON? matches a schema? contains the required
    fields? passes a unit test?
    → cheap, objective, and only works for constrained output
    → for code: RUNNING THE TESTS is the strongest possible
      evaluation

  REFERENCE-BASED
    BLEU, ROUGE, BERTScore against a gold answer
    → weak for open generation: a correct answer phrased
      differently scores badly

  MODEL-BASED (LLM-as-judge)
    a strong model scores the output against a rubric
    → scalable, correlates reasonably with humans, and has
      known biases

  HUMAN
    the ground truth, and the bottleneck
    → the calibration reference for everything else
```

**Prefer objective checks wherever the task allows them.** A code-generation
system evaluated by running tests, or a structured-extraction system evaluated by
schema validation, has an evaluation that cannot drift or be gamed. Reach for
judges only where the output is genuinely open.

## LLM-as-judge, done carefully

```text
  the biases, all measured and all real:

  POSITION      prefers the first (or last) option presented
                → randomise order; evaluate both orders
  VERBOSITY     prefers longer answers
                → control for length, or penalise it explicitly
  SELF-
  PREFERENCE    prefers its own family's outputs
                → use a different model family as judge
  SYCOPHANCY    agrees with framing in the prompt
                → do not reveal which output is "the new one"
  SCALE         clusters on 7–8 out of 10
                → prefer PAIRWISE comparison to absolute scores
```

```text
  what makes a judge usable

  □  a SPECIFIC RUBRIC with defined criteria, not "rate 1–10"
  □  PAIRWISE comparison rather than absolute scoring
  □  ask for REASONING before the verdict
  □  randomise presentation order
  □  CALIBRATE against human labels on a sample, and report
     the agreement rate
```

The calibration step is what turns a judge from an opinion into a measurement.
Without a measured agreement rate against humans on a sample of your own data, a
judge score is a number of unknown quality — and the agreement rate is also the
ceiling on what the judge can tell you.

## RAG evaluation

Retrieval-augmented systems have two components that must be evaluated separately,
or you cannot tell which one is broken:

```text
  RETRIEVAL
    □  recall@k — is the answer-bearing document retrieved?
    □  precision — how much irrelevant context is included?

  GENERATION
    □  FAITHFULNESS — is the answer supported by the retrieved
       context? (the anti-hallucination metric)
    □  RELEVANCE — does it answer the question asked?
    □  CITATION accuracy — do the citations point at text that
       actually supports the claim?
```

```text
  the diagnostic that separates them:

    give the generator the GOLD context.
      still wrong  → a GENERATION problem
      now right    → a RETRIEVAL problem
```

That one experiment saves a great deal of misdirected work, and it requires only
that your evaluation set includes the correct supporting documents.

## Building the evaluation set

```text
  □  100–500 real examples, drawn from actual traffic
  □  covering the distribution: common, rare, adversarial
  □  every past INCIDENT as a regression case
  □  known-hard cases
  □  cases with unambiguous correct answers where possible
  □  version-controlled, and NEVER published
```

**Start with 50 examples.** A small evaluation set used on every change is worth
far more than a large one built over three months and never run. It will be
inadequate, and it will still catch the regressions that matter, and it grows
naturally as incidents arrive.

## Regression testing

```text
  every change — prompt, model, retrieval, chunking, temperature
  — runs the evaluation set in CI.

  a change that improves one thing usually degrades another, and
  nothing else will tell you.
```

```text
  the specific value: PROMPT CHANGES ARE CODE CHANGES.

  an "obvious improvement" to a prompt routinely breaks cases
  that used to work, and without an eval set the breakage is
  discovered by users.
```

This is the highest-value practice in this chapter. Generative systems are
modified constantly by people making small local improvements, and each one is an
unmeasured global change.

## Production evaluation

```text
  □  sample a fraction of live traffic for judge scoring
  □  collect user feedback (thumbs, edits, regeneration,
     abandonment)
  □  IMPLICIT signals: did the user accept the suggestion?
     copy the output? rephrase and try again?
  □  track refusal and safety-filter rates
  □  monitor output length, format validity, latency
```

Implicit signals are usually more honest than explicit ones, and far more
abundant: a regeneration is a stronger negative signal than an unclicked
thumbs-down, and an accepted code completion is a stronger positive than a rating.

## Safety evaluation

```text
  □  a red-team set of adversarial prompts
  □  jailbreak attempts, refreshed as new techniques appear
  □  prompt injection through retrieved content or tool output
  □  measure BOTH failure directions:
       harmful compliance   AND   over-refusal
  □  automated scanning of outputs for policy violations
```

**Over-refusal is a real failure and is usually under-measured**, because a model
that refuses everything scores perfectly on harm metrics while being useless.
Tracking both directions keeps the trade-off visible.

## What to take away

1. Public benchmark scores may reflect contamination; your own unpublished
   evaluation set is the only trustworthy measurement.
2. Prefer objective checks — running tests, validating schemas — wherever the task
   allows; reach for judges only for genuinely open output.
3. LLM judges have measurable position, verbosity and self-preference biases; use
   pairwise comparison with a rubric, randomise order, and calibrate against human
   labels.
4. Evaluate RAG's retrieval and generation separately; giving the generator gold
   context immediately localises the problem.
5. Start with 50 real examples run on every change — prompt changes are code
   changes, and nothing else catches the regressions they cause.
6. Measure over-refusal alongside harmful compliance, or you optimise toward a
   model that refuses everything.

That completes evaluation and online testing. Next in the track: **recommendation
and ranking systems** — where most of these ideas come together.
