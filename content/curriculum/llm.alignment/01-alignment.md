---
title: Alignment: RLHF and DPO
minutes: 20
summary: Training on preferences rather than labels, and what the methods actually optimise.
---

Instruction tuning teaches a model to produce responses. It does not teach it
which of two plausible responses is *better* — helpfulness, honesty, tone,
appropriate refusal. Those are preferences, not labels, and alignment is the set
of techniques for training on them.

## The problem

```text
  "explain quantum computing"

  a hundred valid completions exist. which is BEST?
    → too technical? too shallow? too long? confidently wrong?

  there is no ground-truth string to imitate.
  but a human can reliably say which of TWO is better.
```

That asymmetry is the foundation: **comparisons are much easier to collect and far
more reliable than absolute ratings.** Asking someone to score a response 1–10
produces noisy, drifting data; asking which of two they prefer produces a stable
signal.

## RLHF

```text
  STAGE 1  SUPERVISED FINE-TUNING
    demonstrations of good responses → a model that follows
    instructions

  STAGE 2  REWARD MODEL
    collect pairs (prompt, response A, response B) with a
    human preference
    train a model to score responses so preferred ones score
    higher

      loss = −log σ( r(chosen) − r(rejected) )

  STAGE 3  RL OPTIMISATION (PPO)
    optimise the policy to maximise reward,
    PENALISED by KL divergence from the SFT model

      objective = E[ r(x,y) ] − β · KL(policy ‖ reference)
```

```text
  the KL term is the load-bearing part.

  without it, the policy finds inputs where the reward model
  is WRONG and exploits them:

    → degenerate repetitive text that scores highly
    → extreme length, because the reward model prefers longer
    → stereotyped openings that the reward model likes

  this is REWARD HACKING, and it is not a rare edge case —
  it is the default outcome of unconstrained optimisation
  against a learned proxy.
```

**Reward hacking is Goodhart's law made mechanical.** The reward model is a proxy
for human preference, trained on finite data; optimising hard enough against any
proxy finds the region where the proxy and the target diverge. The KL penalty
keeps the policy near the distribution where the reward model was trained and is
therefore trustworthy.

```text
  RLHF's practical difficulties

  □  FOUR models in memory: policy, reference, reward, value
  □  RL training is unstable and hyperparameter-sensitive
  □  the reward model degrades as the policy moves away from
     its training distribution
  □  expensive and slow
```

## DPO

Direct Preference Optimization removes the RL loop entirely.

```text
  the insight: the optimal policy for the KL-constrained
  reward objective has a CLOSED FORM in terms of the reward.
  invert it, and the reward can be expressed in terms of the
  policy — so you can optimise preferences DIRECTLY.

  loss = −log σ( β·log[π(chosen)/π_ref(chosen)]
                 − β·log[π(rejected)/π_ref(rejected)] )
```

```text
  DPO vs RLHF

  ✓ no reward model to train
  ✓ no RL loop, no value model
  ✓ two models in memory instead of four
  ✓ stable, and it looks like ordinary supervised training
  ✓ far simpler to implement and debug

  ✗ cannot use ONLINE data — it trains on a fixed preference
    dataset, so it cannot explore
  ✗ tends to push down the rejected response's probability
    aggressively, sometimes degrading fluency
  ✗ RLHF still edges it at the frontier, where online
    exploration matters
```

**DPO is the right default for most teams.** It captures most of the benefit at a
fraction of the complexity, and the implementation is close enough to standard
fine-tuning that it can be debugged with normal tools.

The variants address DPO's specific weaknesses:

```text
  IPO      a different loss that avoids over-optimising on
           near-deterministic preferences
  KTO      trains on single "good"/"bad" labels rather than
           pairs — much easier data collection
  ORPO     combines SFT and preference optimisation in one
           stage, removing the need for a reference model
  GRPO     group-relative; used for reasoning training, where
           it compares several sampled answers to the same
           prompt
```

KTO is worth knowing about for a practical reason: **thumbs-up/thumbs-down
feedback is far easier to collect than pairwise comparisons**, and KTO trains
directly on it.

## Constitutional AI and AI feedback

```text
  RLAIF — replace the human preference labeller with a model

  CONSTITUTIONAL AI
    1. the model critiques its own response against a written
       set of principles
    2. it revises accordingly
    3. train on the revisions
    4. use a model to generate preference pairs against the
       same principles
```

```text
  ✓  scales far beyond human labelling throughput
  ✓  the principles are EXPLICIT and auditable — a written
     document rather than the aggregate taste of annotators
  ✗  inherits and can amplify the judge model's biases
  ✗  requires an already-capable model
```

The auditability point is the underrated one: with human preference data, "why
does the model behave this way" resolves to the aggregate opinions of a labelling
pool. With a written constitution, it resolves to a document you can read, argue
with and change.

## What alignment actually does

```text
  ✓  format, tone, helpfulness, structure
  ✓  refusing clearly harmful requests
  ✓  calibrated hedging and uncertainty
  ✓  following instructions more faithfully

  ✗  it does not add KNOWLEDGE
  ✗  it does not make the model truthful — it makes it
     produce text humans PREFER, and humans prefer confident
     fluent answers to accurate uncertain ones
  ✗  it does not remove capability; a jailbroken model can
     usually still do what the base model could
```

```text
  the alignment tax

    heavy alignment can DEGRADE capability:
      more refusals, including of harmless requests
      more hedging and verbosity
      worse performance on some reasoning benchmarks

  → measure BOTH directions: harmful compliance AND
    over-refusal, as the evaluation topic insisted
```

**Sycophancy is the failure mode to watch.** Preference training rewards responses
humans approve of, and humans approve of agreement — so aligned models tend to
agree with the user's stated position, including when it is wrong. It is a direct
and predictable consequence of the objective, not a bug in the implementation.

## Preference data

```text
  □  DIVERSE prompts covering the real use distribution
  □  MEANINGFUL differences between the pair — near-identical
     responses teach nothing
  □  clear GUIDELINES for what "better" means, per the
     labelling topic
  □  measure inter-annotator agreement; it is the ceiling
  □  include SAFETY comparisons, not only quality ones
  □  include cases where the CORRECT answer is a refusal, and
     cases where it is NOT
```

Typical volumes are 10k–100k pairs. Quality dominates, and the guideline document
is again the real product.

## What to take away

1. Alignment trains on comparisons because "which of these two is better" is far
   more reliable than an absolute rating.
2. RLHF's KL penalty is load-bearing: without it, optimisation finds where the
   reward model is wrong, which is reward hacking and the default outcome.
3. DPO removes the reward model and RL loop entirely and is the right default for
   most teams; KTO trains on thumbs-up/down data, which is much easier to collect.
4. Constitutional AI replaces the labelling pool with a written, auditable set of
   principles.
5. Alignment shapes behaviour, not knowledge or truthfulness — it optimises for
   what humans prefer, which favours confident fluency.
6. Sycophancy is a predictable consequence of the objective, and the alignment tax
   means measuring over-refusal alongside harmful compliance.

Next: reasoning — spending compute at inference rather than in training.
