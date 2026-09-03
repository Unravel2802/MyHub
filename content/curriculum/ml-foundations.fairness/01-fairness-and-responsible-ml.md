---
title: Fairness and responsible ML
minutes: 18
summary: Definitions that provably conflict, where bias enters, and what can actually be done.
---

Fairness in ML is not a single property that a model either has or lacks. There
are several formal definitions, they conflict mathematically, and choosing between
them is a value judgement that engineering cannot make. Understanding that is the
starting point.

## Where bias enters

```text
  HISTORICAL       the world the data records is unequal
                   → past hiring reflects past discrimination
  REPRESENTATION   groups under-sampled in the data
                   → worse accuracy where there were fewer
                     examples
  MEASUREMENT      the LABEL is a biased proxy
                   → "arrested" ≠ "committed a crime";
                     policing intensity differs by area
  AGGREGATION      one model for groups needing different
                   ones
  LEARNING         the objective optimises average accuracy,
                   which favours the majority group
  DEPLOYMENT       the model is used differently, or on a
                   different population, than intended
  FEEDBACK         the model's decisions shape future data
```

**Measurement bias is the deepest and the least fixable technically.** If the label
itself encodes historical inequity, a model that predicts it accurately reproduces
that inequity — and no post-processing repairs a target variable that means the
wrong thing.

## The definitions

```text
  DEMOGRAPHIC PARITY      P(ŷ=1 | A=a) equal across groups
                          → equal selection rates
                          → ignores whether the groups
                            genuinely differ on the outcome

  EQUAL OPPORTUNITY       equal TRUE POSITIVE RATE
                          → among those who qualify, equal
                            chance of being selected

  EQUALISED ODDS          equal TPR and FPR

  PREDICTIVE PARITY       equal PRECISION
                          → a given score means the same thing
                            for everyone

  INDIVIDUAL FAIRNESS     similar individuals treated
                          similarly
                          → requires a similarity metric,
                            which is the hard part

  COUNTERFACTUAL          the decision would be the same in a
                          world where the person's group
                          differed
```

```text
  THE IMPOSSIBILITY RESULT

    when base rates differ between groups, you CANNOT
    simultaneously have
      □  equal false-positive rates
      □  equal false-negative rates
      □  equal precision

    (Kleinberg et al.; Chouldechova)

  → this is a theorem, not an engineering limitation.
```

That result is what makes fairness a choice rather than a checkbox. The COMPAS
recidivism debate was precisely this: the tool satisfied predictive parity and
violated equalised odds, and both sides were mathematically correct about different
definitions.

```text
  → so: choose the definition DELIBERATELY, with the people
    affected and with legal input, and DOCUMENT the choice
    and its reasoning.
```

## Measuring

```text
  □  DISAGGREGATE every metric by group — the slice
     requirement from the evaluation chapter, applied to
     protected attributes
  □  measure across INTERSECTIONS, not just single
     attributes: a model can be fair by gender and by race
     and unfair for a specific intersection
  □  check calibration per group
  □  check DATA representation, not just outcomes
  □  measure error COSTS, not only error rates — the same
     error rate can have different consequences
```

```text
  the practical obstacle:

    you often cannot COLLECT the protected attribute, for
    legal or ethical reasons.

    → proxy methods exist and are unreliable
    → and "we don't collect it" is a common reason fairness
      goes unmeasured, which is a policy problem rather than
      a technical one
```

## Mitigation

```text
  PRE-PROCESSING    reweight or resample the data;
                    remove proxies
                    ✓ model-agnostic
                    ✗ proxies are hard to find — removing
                      "race" leaves postcode, name, school

  IN-PROCESSING     add a fairness constraint or penalty to
                    the objective
                    ✓ directly optimises the trade-off
                    ✗ requires the protected attribute at
                      training time

  POST-PROCESSING   group-specific thresholds
                    ✓ simple, effective, model-agnostic
                    ✗ requires the attribute at DECISION
                      time, which may be illegal
```

```text
  the fairness/accuracy trade-off is real but frequently
  SMALLER than assumed — and sometimes negative, because
  fixing representation improves accuracy for the
  under-represented group without hurting others.

  → measure it rather than assuming it.
```

**Removing the protected attribute does not remove the bias.** "Fairness through
unawareness" fails because proxies are abundant: postcode correlates with race,
first name correlates with gender and ethnicity, and the model finds them. This is
the most common well-intentioned mistake in the area.

## Beyond the model

```text
  □  is the SYSTEM fair, not just the model? a fair score
     with an unfair appeals process is not fair
  □  who bears the cost of an error, and do they have
     recourse?
  □  is there a human in the loop, and can they actually
     override?
  □  is the deployment CONTEXT the one the model was built
     for?
  □  who was CONSULTED — including the people affected?
```

```text
  documentation
    MODEL CARDS      intended use, performance by group,
                     limitations, what it must NOT be used for
    DATASHEETS       how the data was collected, by whom,
                     what it represents and does not
    IMPACT
    ASSESSMENTS      increasingly a regulatory requirement
```

## What to take away

1. Bias enters at seven distinct points; measurement bias — a label that encodes
   inequity — is the deepest and least fixable technically.
2. Fairness definitions provably conflict when base rates differ, so choosing one is
   a value judgement to be made deliberately and documented.
3. Disaggregate every metric by group and by intersection, and check calibration per
   group, not only error rates.
4. Removing the protected attribute does not remove bias — proxies are abundant, and
   fairness through unawareness is the common well-intentioned mistake.
5. The fairness/accuracy trade-off is often smaller than assumed and sometimes
   negative; measure it.
6. Ask whether the *system* is fair — recourse, appeals, human override and
   deployment context — not just the model.

Next: hyperparameter optimisation.
