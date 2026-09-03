---
title: Pretraining
minutes: 20
summary: What next-token prediction actually teaches, and why the data pipeline is most of the work.
---

Pretraining is one objective — predict the next token — applied to an enormous
corpus. Everything a base model can do comes from that, and the engineering is
overwhelmingly about the data rather than the objective.

## The objective

```text
  given tokens t₁ ... tₙ₋₁, predict tₙ

  loss = −Σ log P(tₙ | t₁ ... tₙ₋₁)      cross-entropy
```

```text
  every position in every sequence is a training example
  simultaneously, because of causal masking:

    "the cat sat on the mat"
       ↑    ↑   ↑   ↑  ↑   ↑
     predict each from everything before it
    → one 2,048-token sequence gives 2,048 examples
```

That density is why the objective works: no labelling, and every token of every
document is supervision.

**Why next-token prediction produces capability** is worth stating, because it is
not obvious. To predict well, a model must implicitly learn syntax, facts, the
structure of arguments, arithmetic, code semantics, and — where the text records a
person reasoning — the shape of reasoning. Compression and understanding converge:
the best way to predict the next token of a proof is to follow the proof.

## The data pipeline is the work

```text
  raw web crawl (petabytes)
       │
       ├─▶ LANGUAGE identification and filtering
       ├─▶ QUALITY filtering       heuristics, then classifiers
       ├─▶ DEDUPLICATION           exact, then near-duplicate
       ├─▶ SAFETY / PII removal
       ├─▶ DECONTAMINATION         remove evaluation benchmarks
       ├─▶ MIXING                  weight the sources
       └─▶ tokenize, shuffle, shard
             │
             ▼
        training corpus (trillions of tokens)
```

**Deduplication is the highest-value step.** Duplicated documents are memorised
rather than learned from, they waste compute, and — from the privacy topic — they
are what makes verbatim extraction possible. Near-duplicate removal (MinHash/LSH
over shingles) typically removes 20–40% of a web crawl and improves quality.

**Decontamination matters for honest evaluation.** If benchmark test sets are in
the training data, the reported score measures memorisation. This is why published
benchmark numbers should be treated sceptically and why your own private
evaluation set is the only trustworthy measurement.

```text
  quality filtering, in ascending order of sophistication

  HEURISTICS     length, punctuation ratio, repeated lines,
                 stopword presence, symbol-to-word ratio
  CLASSIFIER     train on "known good" (reference corpora)
                 versus random crawl
  PERPLEXITY     score with a small model; drop the extremes
  MODEL-BASED    an LLM rates educational value
                 → expensive and currently the strongest
```

## Data mixing

```text
  a representative mixture

    filtered web        60–70%
    code                10–20%   ← improves REASONING, not just
                                   coding ability
    books               5–10%    long-range coherence
    academic / papers   3–5%
    reference (wiki)    2–5%
    curated / synthetic 2–10%    growing
    multilingual        varies
```

Two findings worth carrying:

**Code improves general reasoning.** Models trained with a substantial code
fraction perform better on non-code reasoning, presumably because code is text
with unusually explicit logical structure.

**Quality beats quantity past a point.** A smaller, heavily filtered corpus often
beats a larger raw one — which is why the frontier has shifted from "collect more"
to "filter harder", and why synthetic and curated data are a growing fraction.

Data is also **curriculum-ordered** in modern runs: higher-quality data is often
weighted more heavily near the end of training, which measurably improves the
final model.

## Training at scale

```text
  a representative run

    parameters      70B
    tokens          15T
    hardware        2,000–16,000 accelerators
    duration        weeks to months
    parallelism     tensor within a node, pipeline across,
                    data across groups (the 3D scheme)
    precision       bf16 with fp32 master weights
    optimizer       AdamW
    schedule        linear warmup, then cosine or WSD decay
    batch           millions of tokens, often ramped up
```

```text
  the instabilities that actually happen

  LOSS SPIKES        the loss jumps and may or may not recover
                     → gradient clipping; skip bad batches;
                       rewind to a checkpoint and skip forward
                       past the offending data

  DIVERGENCE         unrecoverable
                     → lower LR, better initialisation, bf16

  A DEAD RUN         weeks of compute lost
                     → which is why checkpointing and
                       monitoring gradient norms matter so much
```

**Gradient-norm monitoring is the leading indicator**, as the training-infra topic
noted: a rising norm precedes a loss spike by many steps, and catching it allows
intervention before the run is damaged.

## Stages

```text
  1. PRETRAINING          the bulk. next-token prediction on
                          the corpus.
  2. MID-TRAINING         continued pretraining with a shifted
                          mixture — more code, more curated
                          data, longer context
  3. CONTEXT EXTENSION    fine-tune at longer sequence length
                          with adjusted RoPE scaling
  4. POST-TRAINING        instruction tuning and alignment
                          (the next topics)
```

Mid-training has become a distinct and important stage: rather than one fixed
mixture, the distribution shifts over the run, and the last portion has
disproportionate influence on the final model.

## What a base model is and is not

```text
  A BASE MODEL
    ✓ completes text plausibly
    ✓ has broad knowledge
    ✓ can do few-shot tasks from examples in the prompt

    ✗ does not follow instructions — it continues them
    ✗ has no notion of being an assistant
    ✗ will happily produce anything in its training
       distribution
    ✗ may not stop
```

```text
  prompt:  "Write a poem about the sea."

  base model output:
    "Write a poem about the ocean. Write a poem about a river.
     Write a poem about..."

  → it is continuing a LIST OF PROMPTS, which is a plausible
    continuation of that text. it is not disobeying; it was
    never taught to obey.
```

Everything that makes a model *usable* — instruction following, refusal, a
consistent persona, stopping — comes from post-training. The base model is raw
capability with no interface.

## What to take away

1. Next-token prediction over a huge corpus produces capability because predicting
   well requires learning the structure that generated the text.
2. The data pipeline is most of the work; deduplication is the highest-value step
   and also reduces memorisation and extraction risk.
3. Decontaminate against evaluation sets, and treat published benchmark numbers
   sceptically for the same reason.
4. Code in the mixture improves general reasoning, and quality beats quantity past
   a point — the frontier shifted from collecting to filtering.
5. Loss spikes and divergence are routine at scale; gradient-norm monitoring is the
   leading indicator and checkpointing is what makes recovery possible.
6. A base model completes text; it does not follow instructions. Everything usable
   comes from post-training.

Next: how much data and how many parameters — the scaling laws that decide.
