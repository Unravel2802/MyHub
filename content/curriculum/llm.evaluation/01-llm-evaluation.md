---
title: LLM evaluation
minutes: 19
summary: Measuring a system whose output has no single correct answer, and why public benchmarks mislead.
---

Evaluating a language model is harder than evaluating a classifier, and the
industry's headline numbers are systematically less informative than they appear.
Building your own measurement is not optional — it is the only thing that tells
you whether your system works.

## Why public benchmarks mislead

```text
  CONTAMINATION      the test set may be in the training data
                     → the score measures memorisation

  SATURATION         top models cluster within noise; the
                     benchmark no longer discriminates

  MISMATCH           the benchmark is not your task

  OPTIMISATION       models are tuned toward well-known
                     benchmarks, so the score generalises
                     less than it once did

  METRIC ARTIFACTS   exact-match scoring penalises correct
                     answers phrased differently
```

**Treat leaderboard positions as weak evidence.** They are useful for a first
shortlist and for nothing else. Your own private evaluation set, on your own task,
is the measurement that matters — and it does not need to be large.

## The methods

```text
  EXACT / PROGRAMMATIC
    does it parse? match a schema? pass the tests? contain
    the required fields?
    ✓ objective, cheap, ungameable
    → USE WHEREVER THE TASK ALLOWS

  REFERENCE-BASED
    BLEU, ROUGE, BERTScore against a gold answer
    ~ weak for open generation; a correct paraphrase scores
      badly

  MODEL-AS-JUDGE
    a strong model scores against a rubric
    ✓ scalable, reasonable human correlation
    ✗ measurable biases

  HUMAN
    the ground truth and the bottleneck
    → the calibration reference for everything else
```

The ordering is the guidance: **prefer objective checks, and use judges only where
the output is genuinely open.** A structured-extraction system evaluated by schema
validation and field-level accuracy has an evaluation that cannot drift.

## Judges, done carefully

```text
  the biases, all measured

  POSITION           prefers the first (or last) option
  VERBOSITY          prefers longer answers
  SELF-PREFERENCE    prefers its own family's output
  SYCOPHANCY         agrees with framing in the prompt
  SCALE COMPRESSION  clusters around 7–8 out of 10
```

```text
  what makes a judge trustworthy

  □  PAIRWISE comparison, not absolute scoring
  □  a SPECIFIC RUBRIC with defined criteria
  □  reasoning BEFORE the verdict
  □  randomised presentation order — and evaluate both orders
  □  a judge from a DIFFERENT model family than the system
     under test
  □  CALIBRATE against human labels on a sample, and report
     the agreement rate
```

The calibration step is what turns a judge score from an opinion into a
measurement, and the measured agreement rate is also the ceiling on what the judge
can tell you.

## Building the evaluation set

```text
  □  100–500 REAL examples from actual traffic
  □  covering common, rare and adversarial cases
  □  every past INCIDENT as a regression case
  □  cases with unambiguous correct answers where possible
  □  version-controlled, and NEVER published
```

```text
  START WITH 50.

  a small set run on EVERY change beats a large set built
  over three months and never run.
```

The incident-regression set is the highest-value part, because it accumulates into
an institutional memory of what has broken — and prevents the same class recurring.

## What to measure

```text
  QUALITY        correctness, relevance, completeness,
                 instruction adherence, format validity
  SAFETY         harmful compliance AND over-refusal
  ROBUSTNESS     paraphrases, typos, adversarial inputs,
                 prompt injection
  CONSISTENCY    the same input twice — how much variance?
  OPERATIONAL    latency (TTFT, total), cost per request,
                 error and fallback rates
```

**Over-refusal must be measured alongside harmful compliance**, or you optimise
toward a model that refuses everything and scores perfectly on harm.

## Production evaluation

```text
  □  sample live traffic for judge scoring
  □  EXPLICIT feedback — thumbs, ratings
  □  IMPLICIT feedback — did they accept it? copy it?
     regenerate? rephrase and retry? abandon?
  □  refusal and safety-filter rates
  □  output length, format validity, latency
  □  A/B tests for anything significant
```

Implicit signals are more abundant and usually more honest than explicit ones: a
regeneration is a stronger negative than an unclicked thumbs-down, and an accepted
completion is a stronger positive than a rating.

## Regression testing

```text
  EVERY change runs the evaluation set:
    a prompt edit · a model version · a temperature change ·
    a retrieval parameter · a chunking change · a tool
    description

  because a change that improves one thing routinely
  degrades another, and nothing else will tell you.
```

```text
  PROMPT CHANGES ARE CODE CHANGES.

  they are made constantly, by people making small local
  improvements, and each is an unmeasured global change.
```

This is the single highest-value practice in the topic, and the one most often
absent.

## Statistics

```text
  □  report a CONFIDENCE INTERVAL, not a point estimate
  □  n=50 gives roughly ±14% at 95% confidence — small
     differences are not real
  □  PAIRED comparison on the same examples is far more
     sensitive than comparing two means
  □  run several trials for non-deterministic systems
  □  a difference smaller than your run-to-run variance is
     not a difference
```

The paired-comparison point, from the determinism chapter, applies with full
force here: comparing two prompts on the same 200 examples and counting wins is
dramatically more sensitive than comparing two average scores.

## What to take away

1. Public benchmarks are contaminated, saturated, optimised toward and often
   mismatched — treat leaderboards as weak evidence for a shortlist only.
2. Prefer objective programmatic checks; use judges only for genuinely open output.
3. Judges have measurable biases — use pairwise comparison with a rubric, randomise
   order, and calibrate against human labels to get an agreement rate.
4. Start with 50 real examples and run them on every change, because prompt changes
   are code changes.
5. Measure over-refusal alongside harmful compliance, and prefer implicit
   production signals to explicit ones.
6. Report confidence intervals and use paired comparisons — a difference below your
   run-to-run variance is not a difference.

Next: models that handle more than text.
