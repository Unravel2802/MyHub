---
title: Reasoning and test-time compute
minutes: 20
summary: Spending compute per query instead of per model, and what reasoning training actually changes.
---

The dominant axis of progress shifted around 2024: instead of only making models
larger, spend more compute *at inference* on hard problems. A model that thinks
before answering solves problems a same-sized model cannot, and the resulting
scaling curve is a second lever alongside pretraining.

## Chain of thought

```text
  DIRECT
    Q: A shop has 23 apples, sells 8, buys 15. How many now?
    A: 30                                    ✗

  CHAIN OF THOUGHT
    A: Start with 23. Sells 8 → 23 − 8 = 15.
       Buys 15 → 15 + 15 = 30.
       Answer: 30                            ✓
```

Why it works, mechanically: a transformer performs a fixed amount of computation
per token. A hard problem needing many steps cannot be solved in one forward pass —
but *writing the intermediate steps* gives the model more forward passes, with each
step's result available as input to the next.

```text
  → the generated tokens are a SCRATCHPAD, and they are
    genuinely extra computation, not merely an explanation
```

That reframing matters: chain of thought is not the model "showing its working"
for the reader's benefit. The working *is* the computation.

## The techniques

```text
  ZERO-SHOT CoT      append "Let's think step by step."
                     → surprisingly effective on base
                       instruction models

  FEW-SHOT CoT       demonstrate worked examples with
                     reasoning
                     → stronger; costs context

  SELF-CONSISTENCY   sample N reasoning paths at temperature,
                     take the MAJORITY answer
                     → substantial accuracy gains
                     → N× the cost, and it is the simplest
                       test-time-compute method

  LEAST-TO-MOST      decompose into sub-problems, solve in order

  TREE OF THOUGHTS   explore several branches, evaluate, prune,
                     backtrack
                     → expensive; helps on search-like problems

  DEBATE / CRITIQUE  generate, then critique and revise
                     → works when the model can evaluate better
                       than it can generate
```

**Self-consistency is the highest value-per-complexity of these.** Sample five to
ten paths, take the majority — no training, no architecture change, and a
consistent accuracy improvement on anything with a verifiable answer.

## Reasoning-trained models

Rather than prompting for chain of thought, train the model to produce long
reasoning by default.

```text
  train with RL against VERIFIABLE rewards:

    maths     → is the final answer correct?
    code      → do the tests pass?
    logic     → does it satisfy the constraints?

  → the reward is a PROGRAM, not a preference model
  → so it cannot be reward-hacked in the usual way, and the
    model can be trained for a long time against it
```

```text
  what emerges from this training

    □  much longer reasoning traces
    □  BACKTRACKING — "wait, that's wrong, let me reconsider"
    □  self-verification — checking the answer
    □  exploring alternatives before committing
    □  spending more tokens on harder problems, automatically
```

The verifiable-reward point is the important one. Preference-based RL is limited by
reward hacking (as the alignment chapter described); a reward that is *checked by
running the code* has no such ceiling, which is why reasoning training could be
pushed much further than RLHF.

```text
  the trade

  ✓  large gains on maths, code, logic, science
  ✓  the model allocates effort adaptively
  ✗  much higher latency and cost per query
  ✗  smaller gains on tasks with no verifiable structure —
     writing, summarisation, open conversation
  ✗  can overthink simple questions
```

## Test-time compute scaling

```text
  accuracy
     │                    ┌──────── (a larger model)
     │                ╱───┘
     │            ╱
     │        ╱               ← a SMALLER model with more
     │    ╱                     thinking can match a larger
     │ ╱                        model answering directly
     └──────────────────────────▶ inference compute
```

```text
  the practical consequence:

    you can TRADE model size against thinking time.

    a small model + 10× thinking ≈ a large model answering
    directly, on problems with verifiable structure

  → and thinking time is elastic per request, where model
    size is not
```

The methods, in increasing sophistication:

```text
  MORE TOKENS         simply let it think longer
  PARALLEL SAMPLING   N attempts, pick by majority or by a
                      verifier
  BEST-OF-N + VERIFIER
                      a separate model scores candidates
                      → only as good as the verifier
  SEARCH              tree search over reasoning steps, guided
                      by a process reward model
```

**A verifier is what makes parallel sampling scale.** Majority voting plateaus;
a good verifier keeps improving with N, which is why process reward models — which
score each *step* rather than the final answer — are an active area.

## Practical guidance

```text
  USE A REASONING MODEL FOR       DO NOT FOR
  ─────────────────────────       ──────────
  maths, logic, planning          simple extraction
  complex code                    classification
  multi-step analysis             formatting, rewriting
  debugging                       summarisation
  anything with a checkable       high-volume, latency-critical
    answer                          paths
```

```text
  ROUTE by difficulty — the cascade pattern again

    a cheap model handles the easy majority
    escalate to a reasoning model when
      □  the cheap model's confidence is low
      □  the task is known to be hard
      □  the user asks for it
      □  the first attempt failed verification

  → most of the quality at a fraction of the average cost
```

```text
  and the interface points

  □  reasoning tokens usually cost the same as output tokens —
     budget for them
  □  many providers HIDE the reasoning trace; do not build
     product features that depend on seeing it
  □  a "thinking budget" is often exposed — tune it per task
     rather than leaving it at the default
```

## Limitations worth stating plainly

```text
  □  the stated reasoning may not be the ACTUAL computation.
     models can produce a plausible chain and an answer
     arrived at otherwise.
     → do not treat a trace as an explanation for audit
       purposes

  □  more thinking can make things WORSE on simple problems —
     overthinking is real

  □  errors early in a chain propagate and are rarely caught

  □  gains are concentrated where there is verifiable
     structure
```

The first is the one with real consequences. A reasoning trace is *evidence about*
the model's behaviour, not a faithful record of its computation, and treating it as
an explanation in a regulated or safety-critical setting is a mistake.

## What to take away

1. Chain of thought works because generated tokens are extra computation, not
   because the model is explaining itself.
2. Self-consistency — sample N paths, take the majority — is the highest
   value-per-complexity test-time technique.
3. Reasoning models are trained with RL against *verifiable* rewards, which cannot
   be reward-hacked the way preference models can — that is why the training could
   be pushed so far.
4. Test-time compute trades against model size, and unlike model size it is elastic
   per request.
5. Route by difficulty: a cheap model for the easy majority, escalating to a
   reasoning model, gets most of the quality at a fraction of the cost.
6. A reasoning trace is evidence about behaviour, not a faithful record of the
   computation — do not treat it as an audit explanation.

Next: prompting, which is the interface to all of this.
