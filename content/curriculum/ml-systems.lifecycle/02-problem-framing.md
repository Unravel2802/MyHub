---
title: Problem framing
minutes: 19
summary: Whether this should be ML at all, and how to turn a business goal into a prediction task.
---

The most expensive mistakes in ML happen before any model is trained. They are
framing mistakes: applying ML where rules would do, predicting something that is
not actionable, or optimising a metric that does not correspond to the goal. None
of them are fixable by a better model.

## Should this be ML at all?

```text
  USE RULES WHEN                     USE ML WHEN
  ──────────────                     ──────────
  the logic is known and stable      the pattern is complex and
                                     hard to articulate
  you can enumerate the cases        the cases are effectively
                                     unbounded
  you need to explain every          you have LOTS of labelled
  decision exactly                   examples
  errors are unacceptable            some error rate is tolerable
  you have no labelled data          the pattern CHANGES over time
                                     (rules would need constant
                                      rewriting)
```

**The default should be rules.** A rules engine is debuggable, explainable,
testable, deterministic, needs no data pipeline, no training infrastructure, no
monitoring for drift, and no retraining. It is dramatically cheaper to build and
to operate.

The honest heuristic: **start with a rule, and let it fail.** If a hand-written
rule gets 80% of the value, you have learned the shape of the problem, you have a
baseline, and you have a fallback for when the model is unavailable. Many
projects discover at this point that the rule is sufficient, which is a success
rather than a disappointment.

The strongest argument for ML is the last row: the pattern changes, so a rules
system requires a human to keep rewriting it. Fraud, spam, ranking and
recommendation all have that property, and it is why they were among the first
places ML paid off.

## From business goal to prediction task

The translation step, and it is where most of the difficulty lives.

```text
  BUSINESS GOAL      "reduce customer churn"
        │
        │  ← this step is the hard one
        ▼
  PREDICTION TASK    "predict P(cancels within 30 days)
                      given account activity"
        │
        ▼
  DECISION           "offer a discount when P > 0.7"
        │
        ▼
  MEASURED OUTCOME   "churn rate among the targeted group,
                      versus a holdout"
```

Every arrow can break, and each breaks differently:

**Goal → task.** The prediction may be accurate and irrelevant. Predicting who
will churn is useless if the people most likely to churn are also the people
least responsive to any intervention. What you actually want is not "who will
churn" but "whose behaviour would *change* if we intervened" — which is uplift
modelling, a different and harder problem.

**Task → decision.** A probability is not an action. Someone must choose a
threshold, and that choice is where the cost asymmetry lives, not in the model.

**Decision → outcome.** Without a holdout you cannot tell whether the
intervention worked. Offering discounts to likely churners and observing that
most of them stayed proves nothing, because most of them may have stayed anyway.

## The question that catches bad framings

> **What will we DO differently because of this prediction?**

If there is no answer, or the answer is "we will look at a dashboard", the
project should not be an ML project.

```text
  ✗  "predict next quarter's revenue"
       → and then what? if nothing changes, this is a report

  ✓  "predict which shipments will be late"
       → so we notify the customer proactively and reroute
```

The action determines everything downstream: what latency you need, what
precision/recall trade you want, what the cost of an error is, and whether the
prediction needs to be explainable.

## Choosing the target variable

The target is a modelling decision with product consequences, and proxies leak.

```text
  goal: "show users content they VALUE"

  proxy: CLICKS         → clickbait
  proxy: WATCH TIME     → autoplay, long low-value content
  proxy: ENGAGEMENT     → outrage, because it engages
  proxy: RETENTION      → better, and much sparser and slower
  proxy: explicit
         SATISFACTION   → best signal, tiny volume, biased sample
```

Every one of those is a real system that shipped and produced the failure named
beside it. The pattern is general: **the easiest signal to collect is the one
least aligned with the goal**, because it is immediate and abundant, and
immediacy and abundance are exactly what make it a shallow proxy.

Two mitigations that work:

- **Combine signals**, weighting a sparse high-quality one against a dense
  low-quality one.
- **Constrain rather than only optimise.** Maximise engagement *subject to* a
  diversity floor and a quality threshold. Guardrail metrics are how you stop an
  optimiser from finding the degenerate solution.

## Choosing the label, and when you get it

```text
  □  When does the label ARRIVE?
       fraud chargeback:  60–90 days later
       ad click:          seconds
       loan default:      years

  □  Is it CENSORED?
       we only see repayment for loans we APPROVED —
       we have no labels for the ones we rejected

  □  Is it BIASED by the current system?
       we only see clicks on items we SHOWED, and what we
       showed was chosen by the previous model

  □  Is it CONSISTENT?
       two annotators disagreeing means your ceiling is
       their agreement rate
```

**Label delay determines how fast you can iterate**, and it is often the binding
constraint on the whole project. A model whose labels arrive in 90 days cannot be
evaluated in a two-week sprint, and someone will propose a shorter-horizon proxy
that is not the same thing.

**Feedback loops** — the third bullet — deserve their own emphasis. A model
trained on data generated by the previous model learns that model's biases and
amplifies them. A recommender only sees engagement with what it recommended, so
it never learns that the item it never showed would have done better. The
standard mitigation is deliberate exploration: show a small fraction of random or
uncertain items to collect unbiased data, and treat that as a cost of doing
business rather than wasted impressions.

## Framing patterns worth recognising

```text
  RANKING vs CLASSIFICATION
    "which of these should be first" is usually better modelled
    as ranking than as independent per-item probabilities

  REGRESSION vs CLASSIFICATION
    predicting a bucket is often more robust and more useful
    than predicting an exact number

  ANOMALY DETECTION vs CLASSIFICATION
    if you have almost no positive labels, framing as "unusual"
    beats framing as "fraudulent"

  PREDICTION vs CAUSAL EFFECT
    "who will churn" ≠ "who would STAY if we intervened".
    the second is what the decision needs, and it is harder
```

That last distinction is the one worth internalising. **A great many deployed
models answer a predictive question when the decision required a causal one**,
and the resulting intervention targets the people for whom it does the least
good.

## The framing document

Before writing training code, a page that answers:

```text
  □  What decision does this change, and who makes it?
  □  What is the baseline? (rules, heuristic, status quo, human)
  □  What is the target variable, and why that proxy?
  □  When does the label arrive, and is it biased or censored?
  □  What are the guardrail metrics? What must NOT get worse?
  □  What is the cost of a false positive vs a false negative?
  □  What latency does the decision need?
  □  What happens when the model is unavailable?
  □  How will we know it is working in production, not offline?
```

The last two lines are the ones skipped, and they are the ones that determine
whether the model survives contact with production. A model with no fallback path
becomes a hard dependency of the product; a model with no online measurement is a
model nobody can defend when someone asks whether it helps.

## What to take away

1. Default to rules; start with a hand-written rule and let it fail — it gives you
   a baseline, a fallback, and often enough value to stop there.
2. The hard step is goal → prediction task, and the check is: what will we do
   differently because of this prediction?
3. The easiest signal to collect is usually the worst proxy for the goal; combine
   signals and add guardrail constraints rather than optimising one metric.
4. Label delay is frequently the binding constraint on iteration speed, and
   censored or model-generated labels create feedback loops that need deliberate
   exploration.
5. Many models answer a predictive question when the decision needed a causal one.
6. Write the framing document, including the fallback path and how you will
   measure it *online* — those two determine whether it survives production.

Next: the lifecycle itself, and why drawing it as a pipeline is the mistake.
