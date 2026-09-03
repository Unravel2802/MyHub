---
title: Online testing
minutes: 19
summary: The experiment that actually settles it, and the ways an A/B test lies.
---

Offline evaluation tells you a model is different. Only an online experiment tells
you it is better, because only production contains the users, the feedback loops
and the downstream effects. Running the experiment correctly is a distinct
discipline from building the model.

## Why online is required

```text
  offline says +3% AUC.
  online says the business metric did not move.

  the reasons, all common:
    □  the improvement did not change any DECISION
       (better probabilities, same thresholded outcome)
    □  training/serving skew
    □  the offline test set is not the live distribution
    □  a feedback loop the offline data cannot show
    □  latency increased, and the latency cost exceeded the
       quality gain
```

That last one is under-appreciated: a model that is 2% more accurate and 80 ms
slower can be net negative, because latency has its own well-measured effect on
user behaviour. **The experiment measures the whole change, not the model.**

## Progressive exposure

```text
  SHADOW      run on real traffic, DISCARD the output
              → catches skew, latency and errors at zero risk
              → cannot measure user impact

  CANARY      1–5% of traffic, watching for breakage
              → catches operational problems

  A/B TEST    a proper randomised experiment
              → measures effect
```

All three, in that order. Shadow answers "does it work"; canary answers "is it
safe"; A/B answers "is it better". Skipping shadow is how skew reaches users.

## Getting the experiment right

```text
  □  RANDOMISE at the right unit — usually the USER, not the
     request, or a user sees inconsistent behaviour and the
     observations are not independent

  □  CHECK THE SPLIT — a sample ratio mismatch (getting 48/52
     from a 50/50 assignment) means the randomisation or the
     logging is broken, and the whole result is suspect

  □  DECIDE THE METRIC AND DURATION IN ADVANCE

  □  RUN FOR FULL CYCLES — at least a week, to cover the
     weekly pattern

  □  DEFINE GUARDRAILS that must not regress

  □  POWER THE TEST — compute the sample size needed for the
     effect you care about BEFORE running it
```

The sample-ratio-mismatch check is the highest-value validity test and takes one
line. A mismatch means something is systematically different about how the two
groups were assigned or logged, and no amount of analysis rescues the result.

## Power

```text
  detecting a 1% relative change in a 5% conversion rate,
  95% confidence, 80% power:

    ≈ 300,000 users per arm

  → at 10,000 users/day, that is 60 days.
```

```text
  the consequence: SMALL EFFECTS NEED HUGE SAMPLES.

  if you cannot power the test, you have three options:
    □  measure a more sensitive metric (one closer to the
       change, with lower variance)
    □  use variance reduction (CUPED, below)
    □  accept that you cannot detect an effect this small and
       decide on other grounds
```

Running an underpowered test and concluding "no effect" is a common and expensive
error: the test had no ability to detect the effect in the first place, so its
null result carries almost no information.

**CUPED** is the standard variance-reduction technique and is worth using: adjust
each user's metric by their *pre-experiment* value of the same metric. It removes
the variance explained by pre-existing differences between users, often cutting
the required sample size by half or more.

## The ways an A/B test lies

```text
  PEEKING
    checking daily and stopping when it looks significant
    → the false-positive rate rises far above 5%
    → fix: a fixed horizon, or a SEQUENTIAL test designed for
      continuous monitoring

  MULTIPLE COMPARISONS
    twenty metrics, one significant at p<0.05
    → that is what chance produces
    → fix: one primary metric, decided in advance; corrections
      for the rest

  NOVELTY / PRIMACY
    users react to CHANGE, not to quality
    → effects that fade or grow over weeks
    → fix: run longer; segment by new versus existing users

  NETWORK EFFECTS
    treatment leaks between users (social, marketplace)
    → fix: cluster randomisation (by region, by social
      cluster), not by user

  INTERFERENCE
    two experiments overlapping on the same surface
    → fix: an experiment registry and layered assignment

  SIMPSON'S PARADOX
    the treatment wins in every segment and loses overall,
    because the segment MIX differed
    → fix: check the split per segment
```

**Peeking is the most common, and the least appreciated.** A test monitored daily
and stopped on significance has an actual false-positive rate several times the
nominal one. Either fix the horizon in advance, or use a sequential method (mSPRT,
always-valid confidence sequences) built for continuous looking.

## Interleaving, for ranking

A far more sensitive alternative when comparing ranked lists:

```text
  A/B                            INTERLEAVING

  user X → ranker A              user X → a list MIXED from
  user Y → ranker B                       both rankers
                                          → whose items get
  between-user variance                     clicked?
  dominates
                                 within-user comparison:
  needs ~100k users              variance is far lower
                                 needs ~1k users
```

Interleaving is roughly 10–100× more sensitive because each user compares both
rankers directly, removing between-user variance entirely. It only works for
ranking, and it measures relative preference rather than an absolute business
effect — so it is a fast screening tool, with an A/B test to confirm the winner.

## Bandits versus A/B

```text
  A/B TEST                       MULTI-ARMED BANDIT

  fixed allocation               shifts traffic toward the
  → half the users get the         winner as evidence accrues
    worse variant for the        → less regret
    full duration                → biased for inference:
  → clean statistics; a            you cannot cleanly estimate
    trustworthy effect size        the loser's effect

  → use when you need to         → use when you need to
    LEARN                          EARN
```

The distinction is worth being explicit about: bandits optimise cumulative reward,
A/B tests estimate an effect. Using a bandit and then reporting "variant B was 4%
better" is a misuse — the allocation was adaptive, so the estimate is confounded.

Bandits are right for content selection, creative optimisation and anything with
many arms and a short feedback loop. A/B is right when the answer must be
defensible.

## Long-term effects

```text
  short-term metrics can move in the WRONG direction relative
  to long-term value:

    engagement ↑ today, retention ↓ next month
    clicks ↑, satisfaction ↓
    revenue ↑ this quarter, churn ↑ next year
```

```text
  mitigations
    □  GUARDRAIL metrics that must not regress
    □  HOLDBACK groups kept on the old experience for months
    □  long-term follow-up on shipped experiments
    □  a metric hierarchy: which short-term proxy is
       VALIDATED against which long-term outcome?
```

The metric hierarchy is the piece that requires real work: knowing which
short-term movement actually predicts long-term value requires having run
long-horizon experiments to establish it, and most organisations assume the
relationship instead of measuring it.

## The infrastructure

```text
  □  deterministic ASSIGNMENT (hash of user id + experiment id)
     so a user's variant is stable and reproducible
  □  an experiment REGISTRY — what is running, on what surface
  □  LAYERS so orthogonal experiments can overlap safely
  □  exposure logging: who saw what, when
  □  automated analysis with correct statistics
  □  guardrail monitoring with automatic stop
```

**Automatic stop on a guardrail breach** is the feature that makes aggressive
experimentation safe: a variant that degrades a critical metric beyond a threshold
is disabled without waiting for a human to read a dashboard.

## What to take away

1. Only online testing settles it, because the experiment measures the whole
   change — including latency, feedback loops and downstream effects.
2. Shadow, then canary, then A/B: they answer "does it work", "is it safe", and
   "is it better".
3. Check the sample ratio; a mismatch invalidates the result and takes one line to
   detect.
4. Small effects need enormous samples — power the test in advance, and use CUPED
   to reduce variance rather than running underpowered tests.
5. Peeking inflates the false-positive rate; fix the horizon or use a sequential
   method designed for continuous monitoring.
6. Interleaving is 10–100× more sensitive for ranking; bandits earn rather than
   learn, and their estimates are confounded by adaptive allocation.

Next: evaluating generative systems, where there is no single correct answer.
