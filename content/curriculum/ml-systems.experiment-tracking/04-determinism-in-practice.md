---
title: Determinism in practice
minutes: 17
summary: Why identical inputs give different models, how far to chase it, and where to stop.
---

You run the same training script twice with the same seed and get slightly
different weights. This is normal, it is mostly not fixable, and the useful
question is not how to eliminate it but how to work productively despite it.

## Where the non-determinism comes from

```text
  FLOATING-POINT ADDITION IS NOT ASSOCIATIVE

    (a + b) + c  ≠  a + (b + c)      for floats

  a GPU reduction sums thousands of values across thousands of
  threads. the order those threads complete is not fixed.
  → a different sum, in the last bits, every run
```

That tiny difference compounds:

```text
  step 1:   gradients differ in the 7th decimal place
  step 100: weights differ in the 5th
  step 10k: the model has taken a MEASURABLY different path
  → final accuracy differs by a few tenths of a percent
```

The other sources:

```text
  □  non-deterministic cuDNN kernels — the fast implementation
     for some operations uses atomics
  □  cuDNN autotuning — benchmark mode picks a different
     algorithm depending on machine state
  □  multi-worker data loading — batch composition varies with
     thread scheduling
  □  distributed all-reduce — the order gradients are combined
     across ranks varies
  □  library and driver versions changing a default kernel
```

## How much variance to expect

```text
  same seed, same machine, deterministic OFF
    → typically 0.1–0.5% metric variation

  DIFFERENT seeds
    → 0.5–2% on many tasks, more on small datasets
    → this is the number that matters for judging results

  different hardware generation
    → similar magnitude, occasionally larger

  a library minor version
    → usually none, occasionally a surprise
```

**The practical rule follows directly: an improvement smaller than your
seed-to-seed variance is not an improvement.** Measure that variance once, on your
task, by running the same config with five seeds — then you have a threshold for
every future claim. Teams that skip this step spend months chasing gains that were
noise.

## Forcing determinism

```python
def make_deterministic(seed: int):
    random.seed(seed); np.random.seed(seed)
    torch.manual_seed(seed); torch.cuda.manual_seed_all(seed)
    os.environ["PYTHONHASHSEED"] = str(seed)
    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
    torch.use_deterministic_algorithms(True)   # raises if no
                                               # deterministic kernel
    torch.backends.cudnn.benchmark = False     # no autotuning
    torch.backends.cudnn.deterministic = True
```

```text
  cost:  10–30% slower, sometimes more
  risk:  some ops have NO deterministic implementation and
         will raise — you may have to change the model
  scope: only within the SAME hardware, drivers and library
         versions. it is not portable determinism.
```

That last line is the one people are surprised by. Deterministic mode makes a run
repeatable on *that machine with that stack*; it does not make it repeatable on a
different GPU generation.

## When to use it

```text
  USE DETERMINISM                    DON'T
  ──────────────                     ─────
  debugging "why did this differ"    production training runs
  a regression test on a tiny        large-scale training where
    fixture                            10–30% is real money
  regulatory reproducibility         hyperparameter search
  isolating a bug to one change      any run whose result you
                                       will average over seeds
```

**Determinism is a debugging tool.** Turn it on to make a comparison clean, then
turn it off. Paying for bit-identical weights on a production run whose output you
will never compare byte-for-byte is waste.

## Working with non-determinism

```text
  1. RUN MULTIPLE SEEDS
       3 for exploration, 5+ for anything you will act on
       report mean ± std, not a single number

  2. KNOW YOUR NOISE FLOOR
       measure the seed-to-seed spread once. treat it as the
       minimum detectable effect.

  3. USE PAIRED COMPARISONS
       run A and B with the SAME set of seeds, and compare
       per-seed. this removes seed variance from the comparison
       and is far more sensitive than comparing two means.

  4. PREFER LARGER EFFECTS
       a change worth shipping is usually well above the noise.
       if you need statistics to see it, question whether it
       will survive a retrain.

  5. TEST THE PIPELINE, NOT THE WEIGHTS
       assert on shapes, ranges, invariants and rough metric
       bounds — not on exact values.
```

Paired comparison is under-used and cheap:

```text
  UNPAIRED                          PAIRED
  ────────                          ──────
  A: mean 0.912 ± 0.006             seed 1:  A 0.910  B 0.916  +0.006
  B: mean 0.917 ± 0.007             seed 2:  A 0.908  B 0.915  +0.007
  → overlapping. inconclusive.      seed 3:  A 0.919  B 0.924  +0.005
                                    → B wins on EVERY seed,
                                      consistently. conclusive.
```

## Testing ML code

```text
  DETERMINISTIC — test exactly
    □  feature transformations
    □  data validation logic
    □  preprocessing
    □  the serving request/response path
    □  metric computations
    → ordinary unit tests. these are most of your code.

  NON-DETERMINISTIC — test properties
    □  loss decreases over a few steps
    □  the model overfits a batch of 10 examples
       ← the single best smoke test for a training loop
    □  output shapes and ranges
    □  the model loads and scores a fixture
    □  metrics are within a broad band
```

**"Can it overfit ten examples?"** is worth adopting as a standard test. A
training loop that cannot drive the loss to near zero on a tiny fixed batch has a
bug — a wrong loss, a detached gradient, a shuffled label, a frozen layer — and it
runs in seconds. It catches the majority of training-loop defects and almost
nobody writes it.

## Determinism in serving

Serving determinism is a different and stricter requirement, and it is usually
achievable:

```text
  the SAME input to the SAME model version must give the
  same output.

  threats:
    □  batching — a request's result changing depending on
       what it was batched with (batch norm in training mode,
       or a padding-sensitive kernel)
    □  a non-deterministic kernel at inference
    □  a different GPU model in the fleet
    □  features fetched at slightly different times
```

The batching one is a genuine production surprise: if outputs vary with batch
composition, then the same request produces different answers depending on load,
which is very hard to debug and undermines any caching or A/B analysis. Test it
explicitly — score a fixture alone and inside a large batch, and compare.

## What to take away

1. Floating-point addition is not associative and GPU reduction order varies, so
   identical runs diverge in the last bits and compound from there.
2. Expect 0.1–0.5% variation with the same seed and 0.5–2% across seeds; an
   improvement below your measured seed variance is not an improvement.
3. Deterministic mode costs 10–30%, may have no kernel for some ops, and only
   holds on the same hardware and stack — use it for debugging, not production.
4. Run multiple seeds and use paired comparisons across the same seeds, which is
   far more sensitive than comparing two means.
5. Unit-test the deterministic majority of the code exactly; property-test the
   model — and always include "can it overfit ten examples?".
6. Serving determinism is stricter and achievable; test that batch composition does
   not change a single request's output.

That completes experiments and reproducibility. Next in the track: **training
infrastructure** — running these jobs at scale without wasting the accelerators.
