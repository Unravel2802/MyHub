---
title: Multi-armed bandits
minutes: 18
summary: Learning while earning, and when a bandit beats an A/B test.
---

An A/B test sends half your traffic to the worse variant for the full duration.
A bandit shifts traffic toward what is winning as evidence accumulates. The
trade-off between them is precise: bandits minimise regret, A/B tests estimate
effects, and confusing the two produces unusable conclusions.

## The problem

```text
  K arms, each with an unknown reward distribution.
  choose one per round; observe its reward only.

  → the EXPLORE/EXPLOIT dilemma:
      exploit  the best-so-far arm and possibly miss a
               better one
      explore  a worse arm and pay for the information
```

```text
  REGRET = the reward you would have earned always playing
           the best arm, minus what you earned.

  → the quantity a bandit algorithm minimises.
```

## The algorithms

```text
  ε-GREEDY          play the best arm; with probability ε
                    play a random one
                    ✓ trivial to implement
                    ✗ explores uniformly forever, including
                      arms already known to be bad
                    → decay ε over time

  UCB               play the arm with the highest
                    (estimate + uncertainty bonus)

                      argmax  μ̂ᵢ + √(2 ln t / nᵢ)

                    → "optimism in the face of uncertainty":
                      an arm tried rarely gets a large bonus
                    ✓ strong theoretical guarantees
                    ✓ deterministic

  THOMPSON SAMPLING sample a value from each arm's POSTERIOR;
                    play the argmax
                    ✓ usually the best empirical performance
                    ✓ naturally handles delayed feedback
                    ✓ trivial with a Beta posterior — two
                      counters per arm
                    → the practical default
```

```text
  Thompson sampling, for binary rewards, in full:

    per arm: successes s, failures f
    sample  θᵢ ~ Beta(1+sᵢ, 1+fᵢ)   for each arm
    play    argmax θᵢ
    update  s or f

  that is the entire algorithm. exploration falls out of the
  posterior's width — an uncertain arm sometimes samples
  high.
```

The elegance is the point: exploration is not a parameter, it is a consequence of
uncertainty, and it shrinks automatically as evidence accumulates.

## Contextual bandits

```text
  the best arm DEPENDS on the context (the user, the time,
  the device).

    observe context x → choose arm a → observe reward r

  → a model per arm, or one model taking (context, arm)
```

```text
  LinUCB          linear reward model with a confidence bound
  neural bandits  a network with an uncertainty estimate
                  (dropout, ensembles, or a Bayesian layer)
```

```text
  this is where most real applications sit:

    which article to show THIS user
    which price to offer THIS customer
    which creative for THIS segment

  → and it is a middle ground between a bandit and full RL:
    the action does not change the future state.
```

That last distinction is the one that decides the tool. **If the action affects the
next state, you need reinforcement learning; if it does not, a contextual bandit is
simpler, more stable and sufficient.** Most recommendation and pricing problems are
in the second category.

## Bandit versus A/B test

```text
  A/B TEST                          BANDIT

  fixed allocation                  adaptive allocation
  → half get the worse variant      → traffic shifts to the
    for the whole test                winner
  clean statistics                  BIASED for inference
  a trustworthy effect size         the loser's estimate is
                                    confounded by the changing
                                    allocation

  → use when you must LEARN         → use when you must EARN
```

```text
  the misuse to avoid:

    running a bandit and then reporting "variant B was 4%
    better".

  the allocation was adaptive, so that estimate is
  confounded. a bandit optimises cumulative reward; it does
  not produce a clean effect size.
```

```text
  when a bandit is right
    ✓ many arms (A/B tests scale badly past ~4)
    ✓ short feedback loops
    ✓ the cost of showing a bad variant is real and ongoing
    ✓ content or creative selection, where arms come and go
    ✓ continuous optimisation with no "decision date"

  when an A/B test is right
    ✓ you need a defensible effect size
    ✓ a permanent decision is being made
    ✓ the effect is small and needs careful measurement
    ✓ long feedback delays
```

## Practical complications

```text
  DELAYED FEEDBACK       conversion arrives days later
                         → Thompson sampling handles it
                           gracefully; UCB needs care

  NON-STATIONARITY       the best arm CHANGES over time
                         → discount old observations, or use a
                           sliding window; otherwise the
                           algorithm converges and stops
                           adapting

  ARMS APPEARING /
  DISAPPEARING           new content constantly
                         → contextual bandits with content
                           features generalise to unseen arms

  BATCHED DECISIONS      you cannot update per impression
                         → batch updates; slightly more regret

  SAFETY                 a genuinely harmful arm should not
                         be explored
                         → constrain the arm set; do not rely
                           on the algorithm learning to avoid
                           it
```

**Non-stationarity is the most common real-world failure.** A bandit that has
converged on an arm stops exploring, so when the world changes it does not notice.
Discounting past observations — treating older data as less informative — keeps a
floor under exploration.

## What to take away

1. Bandits minimise regret by shifting traffic toward what is winning; A/B tests
   estimate effects with fixed allocation.
2. Thompson sampling is usually the best empirical choice and is trivially
   implementable with a Beta posterior — exploration falls out of uncertainty
   rather than being a parameter.
3. Contextual bandits cover most real applications, and are the right tool when the
   action does not change the future state.
4. Never report an effect size from a bandit — adaptive allocation confounds the
   estimate.
5. Bandits win with many arms, short feedback loops and ongoing costs; A/B tests win
   when you need a defensible number.
6. Non-stationarity is the common failure: discount old observations, or a converged
   bandit stops adapting when the world changes.

Next: classical NLP.
