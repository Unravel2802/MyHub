---
title: Privacy-preserving machine learning
minutes: 19
summary: Training on data you cannot see, and the fact that models memorise.
---

Models trained on personal data carry that data with them in ways that are not
obvious. A model is not an anonymised summary — it can be induced to reveal its
training examples, and it inherits the legal obligations attached to the data it
was trained on. The techniques here address that, at real cost.

## Models memorise

```text
  LARGE MODELS MEMORISE TRAINING EXAMPLES, VERBATIM.

  demonstrated repeatedly: language models emitting phone
  numbers, addresses and code from their training data,
  extractable with the right prompt.
```

```text
  the attacks

  MEMBERSHIP INFERENCE   "was this record in the training set?"
                         → often possible from confidence
                           patterns alone
                         → a privacy violation on its own:
                           knowing someone was in a medical
                           dataset reveals their condition

  EXTRACTION             recover actual training examples
                         → strongest for rare, unique strings —
                           which is exactly what identifiers are

  MODEL INVERSION        reconstruct representative inputs for
                         a class

  ATTRIBUTE INFERENCE    infer an unseen attribute of a
                         training record
```

```text
  what makes memorisation worse

    □  DUPLICATED data — a record appearing many times is
       memorised far more strongly
    □  rare, unique sequences (identifiers, keys, addresses)
    □  overfitting / many epochs on a small dataset
    □  very large models
```

**Deduplication is the cheapest and most effective single mitigation**, and it is
frequently skipped. Removing duplicates reduces memorisation substantially, and it
improves training efficiency at the same time.

## The techniques, and what each actually gives you

```text
  ANONYMISATION       remove identifiers
                      ✗ WEAK. re-identification from
                        quasi-identifiers is routine —
                        birthdate + postcode + sex identifies
                        most people uniquely.

  AGGREGATION         report only group statistics
                      ✗ differencing attacks: two queries whose
                        groups differ by one person reveal
                        that person

  k-ANONYMITY         each record indistinguishable from k−1
                      others
                      ~ better; still vulnerable to homogeneity
                        and background-knowledge attacks

  DIFFERENTIAL
  PRIVACY             a mathematical guarantee, with a
                      quantified budget
                      ✓ the only rigorous option

  FEDERATED
  LEARNING            data never leaves the device
                      ✓ addresses data movement, NOT
                        memorisation (combine with DP)

  SECURE
  COMPUTATION         encrypted computation (MPC, homomorphic)
                      ✓ strong; currently very expensive
```

The first row is worth being blunt about: **"we removed the names" is not
privacy.** It is the most common approach and the weakest.

## Differential privacy

```text
  a mechanism is ε-differentially private if its output
  distribution changes by at most a factor of e^ε when any
  ONE record is added or removed.

  → an observer cannot tell whether any specific individual
    was in the dataset
  → the guarantee holds regardless of the attacker's
    background knowledge, which is what makes it rigorous
```

```text
  ε — the privacy budget

    ε = 0.1   very strong; substantial utility cost
    ε = 1     strong
    ε = 10    weak-ish, and often what is actually deployed

  budgets COMPOSE: running two ε=1 analyses costs ε=2.
  → the total budget is finite and spending it is permanent
```

**DP-SGD** is how it is applied to training:

```text
  per training step:
    1. compute PER-EXAMPLE gradients
    2. CLIP each to a maximum norm  (bound one example's
       influence)
    3. sum, add calibrated Gaussian NOISE
    4. step

  costs
    □  per-example gradients are expensive in memory and time
    □  accuracy loss, worst for underrepresented groups
    □  more hyperparameters (clip norm, noise multiplier)
```

```text
  the honest trade-off:

    DP disproportionately hurts the TAIL — rare classes and
    minority groups — because their signal is exactly what
    noise obscures.

  → a fairness cost that must be measured, not assumed away
```

## Federated learning

```text
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ device 1 │  │ device 2 │  │ device 3 │
  │ trains   │  │ trains   │  │ trains   │   data NEVER leaves
  │ locally  │  │ locally  │  │ locally  │
  └────┬─────┘  └────┬─────┘  └────┬─────┘
       └─────────────┼─────────────┘
                     ▼
              model UPDATES only
                     │
              ┌──────▼──────┐
              │  aggregate  │  (FedAvg)
              └─────────────┘
```

```text
  the real difficulties

  NON-IID DATA      each device's data is unrepresentative;
                    naive averaging converges poorly
  SYSTEM
  HETEROGENEITY     devices differ in speed, and drop out
                    mid-round
  COMMUNICATION     the bottleneck; updates are large
  NO VISIBILITY     you cannot inspect the data, so debugging
                    is severely limited
  UPDATES LEAK      gradients can reveal training data —
                    federation alone is NOT privacy
```

That last point is the one most often misunderstood. **Federated learning moves
the data, it does not protect it**: gradient inversion attacks can reconstruct
inputs from updates. Production deployments combine it with **secure
aggregation** (the server sees only the sum, never an individual update) and
differential privacy.

## Compliance in practice

```text
  □  DATA MINIMISATION — collect only what you need
  □  PURPOSE LIMITATION — consent for training is not the
     same as consent for the original collection
  □  the RIGHT TO DELETION
        → deleting the row does not remove its influence on
          a trained model
        → options: retrain on a schedule, machine unlearning
          (immature), or scope models so retraining is cheap
  □  EXPLAINABILITY where decisions affect individuals
  □  CROSS-BORDER transfer restrictions
  □  RETENTION limits — including on features and embeddings
```

**The deletion problem is genuinely unsolved.** A user exercising a deletion right
whose data trained a model that is still serving has not really been deleted, and
the practical answers — periodic retraining, and keeping a record of which model
versions include which data — are mitigations rather than solutions. Designing so
that retraining is cheap is the most useful thing you can do about it in advance.

**And embeddings are personal data.** A user embedding derived from behaviour is
subject to the same obligations as the behaviour, and it is easy to forget when
it lives in a vector index rather than a database table.

## Practical guidance

```text
  START HERE — cheap and effective
    □  DEDUPLICATE training data
    □  scrub identifiers, keys, credentials before training
    □  minimise: do not collect what you will not use
    □  retention limits, applied to features and embeddings too
    □  access control and audit on training data

  THEN, if the risk warrants it
    □  measure memorisation — attempt extraction yourself
    □  DP-SGD for genuinely sensitive training data
    □  federated learning + secure aggregation + DP where
      data cannot move
    □  filter model OUTPUTS for leaked personal information
```

The first block is achievable in days and removes most of the risk. The second is
weeks to months of work and real accuracy cost, and should follow from an actual
threat assessment rather than from the presence of the word "personal" in a
requirements document.

## What to take away

1. Models memorise verbatim, and duplicated or rare unique strings — exactly what
   identifiers are — are memorised most strongly.
2. Deduplication is the cheapest and most effective mitigation, and it improves
   training efficiency too.
3. Removing names is not privacy; differential privacy is the only rigorous
   guarantee, and its budget composes and is finite.
4. DP disproportionately degrades rare classes and minority groups — a fairness
   cost that must be measured.
5. Federated learning moves data but does not protect it; gradients leak, so it
   needs secure aggregation and DP.
6. Deletion rights are unsolved for trained models — design so retraining is cheap,
   and remember that embeddings are personal data.

Next: on-device and edge inference, where the model runs on someone else's
hardware.
