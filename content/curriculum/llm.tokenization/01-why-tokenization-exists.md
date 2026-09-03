---
title: Why tokenization exists
minutes: 18
summary: The compromise between characters and words, and the bugs it quietly causes.
---

A language model operates on a fixed vocabulary of integers. Text is not integers,
so something must convert between them, and that converter — the tokenizer — is
where a surprising share of model behaviour originates.

## The two bad options

```text
  CHARACTERS                         WORDS
  ──────────                         ─────
  vocabulary ~100                    vocabulary 100k+, and still
  no unknown tokens ever             incomplete
  sequences are LONG — 5× more       "running" and "run" are
    tokens per document                unrelated entries
  attention is quadratic, so         unknown words are lost
    long sequences are expensive     morphology is invisible
  the model must learn spelling
    from scratch
```

Subword tokenization is the compromise: frequent words stay whole, rare words
split into meaningful pieces.

```text
  "unhappiness"  →  ["un", "happiness"]
  "tokenization" →  ["token", "ization"]
  "the"          →  ["the"]
  "xyzzyx"       →  ["xy", "zz", "yx"]

  → a fixed vocabulary that can represent ANY string
  → morphologically related words share pieces
  → sequence length stays manageable
```

## Byte-pair encoding

The dominant algorithm, and it is trained on a corpus like anything else.

```text
  TRAINING

  1. start with a vocabulary of individual bytes (256 entries)
  2. count all adjacent pairs in the corpus
  3. MERGE the most frequent pair into a new token
  4. repeat until the vocabulary reaches the target size

  each merge is recorded, in order.
```

```text
  corpus: "low low lower lowest"

  merge 1:  "l"+"o"  → "lo"      (most frequent pair)
  merge 2:  "lo"+"w" → "low"
  merge 3:  "e"+"r"  → "er"
  ...

  ENCODING applies the recorded merges in the same order.
```

**Byte-level BPE** starts from raw bytes rather than characters, which guarantees
every possible input is representable — no unknown token, ever, including emoji,
malformed UTF-8 and binary data. This is what GPT-family and most modern models
use.

```text
  the alternatives you will see named

  WORDPIECE      like BPE, but merges by likelihood gain rather
                 than raw frequency (BERT)
  UNIGRAM        starts large and PRUNES; can produce several
                 valid segmentations with probabilities
                 (SentencePiece, T5)
  SENTENCEPIECE  a library, not an algorithm — treats the input
                 as a raw stream including spaces, so it is
                 language-agnostic and reversible
```

## The consequences you will actually meet

**Token counts are not word counts.**

```text
  English prose        ~1.3 tokens per word
  code                 ~2–3 tokens per word (punctuation,
                       identifiers split)
  JSON                 heavy — every brace and quote is a token
  non-Latin scripts    2–4× worse than English
  a UUID               ~20 tokens for 36 characters
```

**Non-English text costs more.** A tokenizer trained mostly on English splits
other languages into many small pieces:

```text
  the same sentence

    English    12 tokens
    German     18
    Japanese   30
    Thai       45

  → the same content costs 4× as much and consumes 4× the
    context window. this is a real cost and fairness issue,
    not a curiosity.
```

**Numbers tokenize badly.**

```text
  "1234"  might be  ["123", "4"]  or  ["12", "34"]

  the model sees no consistent digit structure, which is a
  large part of why arithmetic is hard for language models.

  → newer tokenizers deliberately split numbers into single
    digits or fixed groups of three
```

**Whitespace matters and is invisible.**

```text
  " hello"  and  "hello"  are DIFFERENT TOKENS

  a prompt ending in a space can produce noticeably worse
  output, because it forces the model to continue a token
  boundary it did not expect.

  → do not end prompts with trailing whitespace
```

## Special tokens

```text
  <|begin_of_text|>   sequence start
  <|end_of_text|>     sequence end — the stop signal
  <|user|> <|assistant|>
                      chat role markers
  <|im_start|>        instruction/message delimiters
  <pad> <unk> <mask>  training-time utilities
```

**Chat models are trained on a specific template**, and using the wrong one
degrades quality substantially:

```text
  the model was trained on:
    <|im_start|>user\nHello<|im_end|>\n<|im_start|>assistant\n

  sending plain "Hello" is out of distribution — the model has
  never seen a bare instruction without its scaffolding.
```

Always use the tokenizer's own `apply_chat_template`. Hand-writing the format is a
reliable source of quality loss that looks like a model problem.

The security angle: **if user input can contain special-token strings, a user can
forge role markers** and inject a fake system turn. Tokenizers should be
configured to not parse special tokens from user content.

## Practical implications

```text
  □  COUNT TOKENS, not characters, for cost and context limits
     — and count with the MODEL'S OWN tokenizer
  □  budget context in tokens; non-English content needs more
  □  compact your formats: JSON is expensive; consider
     line-based or CSV-like structures in prompts
  □  avoid trailing whitespace in prompts
  □  use the model's chat template
  □  identifiers, hashes and UUIDs are token-expensive — do
     not put them in prompts unnecessarily
  □  a changed tokenizer means a changed model — embeddings
     from two tokenizers are incomparable
```

## Where tokenization causes visible failures

```text
  ARITHMETIC            inconsistent digit grouping
  SPELLING / REVERSAL   the model sees tokens, not letters —
                        "how many r's in strawberry" is hard
                        because "strawberry" may be 3 tokens
  RHYMING / WORDPLAY    same reason
  CODE INDENTATION      whitespace runs tokenize unevenly
  NON-ENGLISH quality   more tokens, less training signal per
                        concept
  GLITCH TOKENS         rare tokens present in the vocabulary
                        but almost absent from training data
                        produce bizarre behaviour
```

The "count the letters" failure is worth understanding precisely because it is so
often cited as evidence of a deep limitation: it is largely a *representational*
one. The model never sees the characters, only the token ids, so it must have
memorised spellings rather than being able to inspect them.

## What to take away

1. Subword tokenization is the compromise between character-level (too long) and
   word-level (unbounded vocabulary); byte-level BPE guarantees any input is
   representable.
2. Token counts are not word counts, and non-English text can cost 2–4× more — a
   real cost and fairness consequence.
3. Numbers and whitespace tokenize inconsistently, which explains much of the
   arithmetic and spelling weakness.
4. Chat models are trained on a specific template; use `apply_chat_template` rather
   than hand-writing it, and never let user text be parsed as special tokens.
5. Count tokens with the model's own tokenizer, and prefer compact prompt formats.
6. A different tokenizer means a different model — their embeddings are not
   comparable.

Next: what the model does with those tokens — the modern transformer stack.
