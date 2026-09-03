---
title: Fine-tuning and PEFT
minutes: 20
summary: Adapting a pretrained model, when it beats prompting, and why LoRA changed the economics.
---

Fine-tuning updates a pretrained model's weights on your data. It is more
expensive than prompting, less flexible, and sometimes the only thing that works —
and parameter-efficient methods have made the decision far less costly than it
was.

## When to fine-tune

```text
  TRY FIRST                          FINE-TUNE WHEN
  ─────────                          ──────────────
  a better prompt                    you need a consistent
  few-shot examples                    FORMAT or STYLE
  retrieval (RAG)                    the task is narrow and
  a better model                       high-volume
                                     latency or cost demands a
                                       smaller model
                                     prompting has plateaued
                                     you have 1,000+ good
                                       examples
```

**The most common mistake is fine-tuning to add knowledge.** Fine-tuning teaches
*behaviour* — format, style, task structure — far more reliably than it teaches
facts. Facts belong in retrieval, where they can be updated, cited and audited.

```text
  ✗  fine-tune so the model knows our product catalogue
       → it will half-remember, hallucinate confidently, and
         be stale the moment the catalogue changes

  ✓  retrieve the catalogue; fine-tune so the model answers
     in the required format and tone
```

## Full fine-tuning versus PEFT

```text
  FULL FINE-TUNING          all parameters updated
    memory: ~16 bytes/parameter (weights, gradients,
            optimizer state) — a 7B model needs ~112 GB
    → multiple GPUs for a model that INFERS on one

  LoRA                      a small low-rank adapter
    freeze W; learn ΔW = B·A where A is [r × d], B is [d × r]
    r is typically 8–64, so ΔW has ~0.1–1% of W's parameters

         W (frozen)
         ↓
    x ──┬──────────▶ Wx ──┬──▶ output
        │                 │
        └──▶ A ──▶ B ─────┘    only A and B are trained
```

```text
  memory for a 7B model

    full fine-tune     ~112 GB
    LoRA               ~16 GB
    QLoRA (4-bit base) ~6 GB     ← fits on a consumer GPU
```

**QLoRA** quantises the frozen base model to 4-bit and trains the adapter in
higher precision. Quality is usually close to full fine-tuning, and it is what
makes fine-tuning a 70B model feasible on a single node.

```text
  the operational advantage that matters most

    an adapter is ~10–200 MB.

    → store hundreds of task-specific adapters
    → SWAP them at serving time against ONE base model in
      memory
    → a per-customer or per-task model without a per-model
      GPU
```

That multi-adapter serving pattern is the reason LoRA changed the economics rather
than just the training cost.

```text
  the parameters that matter

    r (rank)        8–16 for style; 32–64 for harder tasks
    alpha           scaling; commonly 2×r
    target modules  attention projections at minimum;
                    including the FFN projections usually
                    helps more than raising r
    dropout         0.05–0.1
```

## Instruction tuning

Turning a base model into one that follows instructions:

```text
  a training example

    {"instruction": "Summarise this in one sentence.",
     "input":  "<a long document>",
     "output": "<the summary>"}

  loss is computed on the OUTPUT tokens only — the model
  learns to produce responses, not to reproduce prompts.
```

```text
  what matters, in order

  1. QUALITY over quantity
       1,000 excellent examples beat 100,000 mediocre ones.
       LIMA demonstrated strong instruction following from
       ~1,000 carefully curated examples.

  2. DIVERSITY of task types
       narrow data produces a model good at one thing and
       worse at everything else

  3. CONSISTENT format
       the model learns the template as much as the task

  4. the right RESPONSE LENGTH and style — the model imitates
     what it sees, including verbosity
```

## Catastrophic forgetting

```text
  fine-tuning on a narrow task degrades everything else.

    before:  good at reasoning, code, chat, your task (poor)
    after:   excellent at your task, WORSE at the rest
```

```text
  mitigations

  □  LoRA rather than full fine-tuning — a small perturbation
     forgets less
  □  a LOWER learning rate (1e-5 to 1e-4 range)
  □  FEWER epochs — 1–3, not 10
  □  MIX IN general data (5–20%) alongside task data
  □  EVALUATE ON GENERAL BENCHMARKS, not only your task
```

The last is the one that is skipped. A fine-tune that improves your task by 15%
and degrades general reasoning by 20% may be a net loss, and nothing in a
task-specific evaluation reveals it.

## The recipe

```text
  □  start from an INSTRUCT model unless you have a lot of data
  □  1,000–10,000 high-quality examples
  □  hold out 10% for evaluation
  □  LoRA r=16, alpha=32, targeting attention + FFN projections
  □  learning rate 1e-4 (LoRA) or 1e-5 (full)
  □  1–3 epochs, watching for overfitting
  □  cosine schedule with warmup
  □  evaluate on BOTH your task and general capability
  □  compare against a well-prompted baseline — always
```

That final comparison is the honest gate. A fine-tune that does not beat a good
prompt on the same model is not worth its operational cost, and it happens more
often than teams expect.

## Data curation

The part that determines the outcome:

```text
  □  REAL examples from production beat synthetic ones
  □  include the HARD cases, not just the easy ones
  □  ensure the OUTPUT is what you actually want — the model
     imitates it exactly, including its flaws
  □  DEDUPLICATE
  □  check for LEAKAGE into your evaluation set
  □  a few hundred hand-checked examples beat thousands of
     unreviewed ones
```

```text
  a common failure:

    training data scraped from past support tickets, including
    the mediocre responses.
    → the model learns to write mediocre responses, faithfully.

  → curate for the responses you WANT, not the ones you HAVE.
```

## Continued pretraining

A distinct option, worth naming:

```text
  more NEXT-TOKEN pretraining on domain text (legal, medical,
  a codebase) before instruction tuning.

  → for genuine DOMAIN ADAPTATION where vocabulary and
    conventions differ from general text
  → needs much more data (hundreds of millions of tokens)
  → and it forgets general capability faster
```

Use it when the domain is genuinely distributionally different, not merely
specialised.

## What to take away

1. Try prompting, few-shot and retrieval first; fine-tune for consistent format,
   narrow high-volume tasks, or when a smaller model is required.
2. Fine-tuning teaches behaviour, not facts — knowledge belongs in retrieval where
   it can be updated and cited.
3. LoRA cuts memory by ~7× and QLoRA by ~20×, and small swappable adapters against
   one base model is the change that mattered operationally.
4. Instruction tuning rewards quality over quantity — a thousand excellent examples
   can be enough.
5. Catastrophic forgetting is real; use LoRA, low LR, few epochs, mixed-in general
   data, and evaluate general capability.
6. Always compare against a well-prompted baseline, and curate training data for
   the outputs you want rather than the ones you have.

Next: alignment — teaching a model what a good answer is when there is no label.
