---
title: Reading the frontier
minutes: 18
summary: What is actually changing, how to evaluate a claim, and how to keep up without drowning.
---

The field moves fast enough that specific facts date quickly, and slowly enough
that the underlying structure is stable. This chapter is about telling the two
apart: which claims to take seriously, and what to watch.

## What has actually changed, and what has not

```text
  STABLE SINCE 2017
    □  the transformer, essentially unchanged in its core
    □  next-token prediction as the pretraining objective
    □  scaling laws holding over many orders of magnitude
    □  attention as the mechanism

  CHANGED SIGNIFICANTLY
    □  compute-optimal → inference-optimal training
    □  RLHF → DPO and simpler preference methods
    □  dense → mixture of experts at the frontier
    □  4k → 100k+ context, routinely
    □  bigger models → more test-time compute
    □  text-only → natively multimodal
    □  chat interfaces → tool-using agents
```

The shape of that list is the useful observation: **the architecture is stable and
almost everything else has moved.** An engineer who understands attention,
scaling and the training pipeline can absorb each new development; one who has
memorised current model names cannot.

## Evaluating a claim

```text
  □  BENCHMARK or REAL TASK? benchmark gains are frequently
     contamination or optimisation toward the benchmark
  □  what is the BASELINE, and is it a fair one?
  □  ABLATIONS — is the claimed component responsible?
  □  COMPUTE-MATCHED? "better than X" at 10× the compute is
     a different claim
  □  INDEPENDENTLY REPRODUCED?
  □  what does it cost at inference?
  □  does it survive being tried on YOUR task?
```

```text
  the reliable heuristic:

    ignore the announcement. wait for INDEPENDENT
    REPRODUCTION on tasks you care about, and for people
    who have used it in production to report back.

  most claimed improvements do not survive that.
```

## What to watch

```text
  EFFICIENCY        cost per capability keeps falling fast —
                    frequently more consequential for products
                    than capability gains
  CONTEXT           length, and the QUALITY across that length,
                    which lags the advertised number
  REASONING         test-time compute scaling, and where it
                    generalises beyond verifiable domains
  AGENTS            reliability over long horizons is the
                    binding constraint
  MULTIMODAL        video and audio as first-class inputs
  OPEN WEIGHTS      the gap to frontier closed models, which
                    determines what you can self-host
  SPECIALISATION    small models matching large ones on
                    narrow tasks
```

**Efficiency is the trend to plan around.** A capability that is impractical at
current prices becomes practical when cost falls an order of magnitude, and that
has happened repeatedly. Designs should assume the cost curve continues.

## What has not been solved

Worth being explicit about, because the discourse tends to assume otherwise:

```text
  □  HALLUCINATION — reduced, not solved. models still state
     falsehoods confidently.
  □  RELIABILITY — the same input can produce different
     quality; long agent runs still fail.
  □  PROMPT INJECTION — unsolved in the general case.
  □  CONTINUAL LEARNING — models do not learn from
     deployment; updating means retraining.
  □  INTERPRETABILITY — we cannot fully explain why a model
     produced a given output.
  □  LONG-HORIZON COHERENCE — degrades over very long
     interactions.
  □  CALIBRATION — stated confidence correlates only loosely
     with correctness.
```

Designing as though these are solved is the most common source of systems that
demo well and fail in production. Every one of them has an engineering response —
retrieval and citation for hallucination, verification for reliability, least
privilege for injection — and none has a model-level fix.

## How to keep up

```text
  □  read the SYSTEM CARDS and technical reports, not the
     marketing
  □  follow independent evaluators rather than leaderboards
  □  BUILD something with each significant release — hands-on
     tells you more than a benchmark table
  □  maintain your own evaluation set and run new models
     against it
  □  read a few foundational papers properly rather than many
     superficially
  □  ignore most of it: the majority of announcements do not
     change what you should build
```

```text
  the foundational reading, if you read only a handful

    Attention Is All You Need            the architecture
    Scaling Laws / Chinchilla            the economics
    InstructGPT                          alignment as practised
    Direct Preference Optimization       its simplification
    Retrieval-Augmented Generation       the dominant pattern
    Hidden Technical Debt in ML Systems  the engineering reality
```

## Building on a moving foundation

```text
  □  ABSTRACT the model behind your own interface, so
     swapping providers is configuration
  □  keep prompts and tool schemas in YOUR format
  □  maintain an evaluation set — it is how you decide
     whether a new model helps
  □  do not build around a specific model's quirks
  □  do not over-invest in workarounds for current
     limitations; some will disappear
  □  DO invest in the parts that will not change: data
     quality, evaluation, retrieval, verification,
     capability limits
```

That last line is the practical conclusion of the whole track. **The durable
engineering is around the model, not in it.** Retrieval infrastructure, evaluation
sets, verification loops, permission boundaries and data pipelines keep their value
across model generations; prompt tricks and model-specific workarounds do not.

## What to take away

1. The transformer architecture has been stable since 2017; almost everything else
   — training economics, alignment methods, context length, test-time compute — has
   moved.
2. Evaluate claims by asking for compute-matched comparisons, ablations and
   independent reproduction, and wait for production reports.
3. Efficiency gains are frequently more consequential for products than capability
   gains — assume the cost curve continues.
4. Hallucination, reliability, prompt injection, continual learning,
   interpretability and calibration are not solved; each has an engineering
   response and no model-level fix.
5. Keep up by building with each release against your own evaluation set, and by
   ignoring most announcements.
6. Invest in what does not change — data quality, evaluation, retrieval,
   verification and capability limits. The durable engineering is around the model,
   not in it.

That completes the LLMs & Frontier AI track. It connects back to **ML Systems** for
how these models are served, and to **Deep Learning** for how they are built.
