---
title: Retrieval-augmented generation
minutes: 20
summary: Giving a model information it was not trained on, and why the retrieval half is where quality comes from.
---

A model's knowledge is frozen at training time, unattributable and impossible to
update. RAG fixes all three by retrieving relevant documents and putting them in
the context. It is the most widely deployed LLM pattern, and most of its failures
are retrieval failures rather than generation failures.

## Why not fine-tune the knowledge in

```text
  RAG                                FINE-TUNING
  ───                                ───────────
  update by changing a document      update by retraining
  CITES its sources                  cannot attribute
  access control per document        knowledge is baked in for
                                       everyone
  works for facts, entities,         teaches BEHAVIOUR, format,
    numbers                            style
  costs context tokens               costs no context
```

**They are complementary, not alternatives.** Facts go in retrieval; format and
tone go in fine-tuning. The frequent mistake — fine-tuning to teach the model your
documentation — produces half-remembered, uncitable, stale knowledge.

## The pipeline

```text
  INDEXING (offline)
    documents ──▶ parse ──▶ CHUNK ──▶ embed ──▶ index
                                              (+ keyword index)

  QUERY (online)
    question ──▶ [rewrite] ──▶ retrieve (dense + sparse)
             ──▶ RERANK ──▶ assemble context ──▶ generate
             ──▶ cite ──▶ [verify]
```

Each stage is a place quality is lost, and the retrieval stages dominate: a
generator given the right passage almost always answers correctly, and a generator
given the wrong passage almost never does.

## Chunking decides more than you expect

```text
  TOO SMALL   a chunk that answers nothing on its own
  TOO LARGE   the relevant sentence is diluted by irrelevant
              context in the embedding

  typical: 200–500 tokens, 10–20% overlap
```

```text
  better than fixed-size splitting

  □  split on STRUCTURE — headings, sections, paragraphs;
     never mid-sentence
  □  keep tables and code blocks INTACT
  □  PREFIX each chunk with its document title and section
     heading, so an isolated chunk is interpretable
  □  store a pointer to the surrounding text and EXPAND at
     retrieval time — retrieve precisely, generate with
     context
```

```text
  the contextual-retrieval refinement

    before embedding, have a model write a one-sentence
    summary of how each chunk fits its document, and prepend
    it.

    → measurably better retrieval, at a one-off indexing cost
```

The retrieve-small-expand-large pattern is the one to reach for first: embed a
precise 200-token chunk so retrieval is accurate, then hand the generator the
surrounding 1,000 tokens so it has context.

## Retrieval

```text
  DENSE (embeddings)   semantic similarity, paraphrase,
                       cross-lingual
  SPARSE (BM25)        exact terms, identifiers, rare words,
                       names and codes

  → HYBRID, fused with reciprocal rank fusion
  → and RERANK the top 50–100 with a cross-encoder
```

As the vector-search topic established: embeddings compress meaning and lose the
ability to match a specific rare token, which is exactly what BM25 is good at.
A system with only dense retrieval fails on error codes, product SKUs and proper
nouns.

```text
  QUERY TRANSFORMATION, in rough order of value

  REWRITE          resolve pronouns and context from the
                   conversation
                   → "what about the second one?" is
                     unretrievable as written
  DECOMPOSE        split a multi-part question into sub-queries
  HyDE             generate a HYPOTHETICAL answer and search
                   with THAT — it is closer in embedding space
                   to real answers than the question is
  EXPANSION        add synonyms and related terms
```

**Query rewriting for conversational context is the highest-value of these** and
the most often missing: in a multi-turn conversation, the literal last message is
frequently not a searchable query at all.

## Generation

```text
  the prompt structure that works

    <instructions: answer ONLY from the context; if the answer
     is not present, say so; cite the source of each claim>

    <context>
      [1] {chunk}  (source: doc A, section 2)
      [2] {chunk}  (source: doc B, section 5)
    </context>

    <question>{question}</question>
```

```text
  □  ORDER by relevance, best at the START and END
     (lost-in-the-middle)
  □  NUMBER the sources so citation is mechanical
  □  instruct explicitly to say "not in the provided context"
  □  keep the context focused — 5 good chunks beat 30 mixed
```

## Failure modes

```text
  RETRIEVAL MISSES        the answer is not in the retrieved
                          set
                          → chunking, embeddings, hybrid,
                            reranking, query rewriting

  RETRIEVED BUT IGNORED   the answer is present and the model
                          answers from parametric memory
                          instead
                          → stronger instruction; put context
                            closer to the question

  HALLUCINATED
  DESPITE CONTEXT         the model fabricates beyond what the
                          context supports
                          → explicit grounding instruction;
                            faithfulness evaluation; citation
                            checking

  CONFLICTING SOURCES     two documents disagree
                          → instruct how to handle it; prefer
                            recency; surface the conflict

  STALE INDEX             the document changed; the index did
                          not
                          → freshness monitoring

  "NOT FOUND" WHEN IT IS  over-conservative refusal
                          THERE
                          → measure BOTH directions
```

```text
  the diagnostic that separates retrieval from generation:

    give the generator the GOLD context.
      still wrong → GENERATION problem
      now right   → RETRIEVAL problem
```

That one experiment, from the evaluation topic, saves a great deal of misdirected
work — and it is why an evaluation set must record the correct supporting
documents, not just the correct answer.

## Evaluating RAG

```text
  RETRIEVAL     recall@k · precision · MRR
  GENERATION    FAITHFULNESS (is every claim supported?)
                relevance · citation accuracy
  END TO END    answer correctness on a labelled set
```

```text
  build 100–300 (question, answer, supporting-documents)
  triples from REAL queries, and run them in CI.

  → every change — chunk size, embedding model, k, reranker,
    prompt — silently affects retrieval quality, and nothing
    else detects it
```

## Advanced patterns

```text
  MULTI-HOP        retrieve, reason, retrieve again
                   → for questions needing two facts joined
  AGENTIC RAG      the model DECIDES whether and what to
                   retrieve, iteratively
  SELF-RAG         the model critiques its own retrieval and
                   answer, and retries
  GRAPH RAG        a knowledge graph over entities, traversed
                   → for relationship questions; expensive to
                     build
  HIERARCHICAL     summaries at several levels; drill down
```

**Start simple.** Chunk, embed, hybrid retrieve, rerank, generate, cite. Most RAG
quality problems are solved by better chunking, hybrid retrieval and reranking —
not by a more elaborate architecture. Teams routinely build agentic multi-hop
graph RAG on top of a retrieval system that has no reranker.

## Long context versus RAG

```text
  as context windows grow, why retrieve at all?

  RAG STILL WINS ON
    □  COST — 5 chunks versus 500 documents per query
    □  LATENCY — prefill scales with context length
    □  ATTRIBUTION — you know which document was used
    □  ACCESS CONTROL — filter before retrieval
    □  SCALE — corpora exceed any context window
    □  ACCURACY — quality degrades in very long contexts

  LONG CONTEXT WINS ON
    □  a small, fixed corpus
    □  questions needing the WHOLE document
    □  no retrieval infrastructure to build
```

The pragmatic answer is both: retrieve aggressively, then use a generous context
for what you retrieve.

## What to take away

1. RAG and fine-tuning are complementary — facts belong in retrieval where they can
   be updated, cited and access-controlled.
2. Most RAG failures are retrieval failures; the gold-context experiment localises
   the problem in minutes.
3. Chunk on structure, prefix chunks with their document and section titles, and
   retrieve small while generating with the expanded surroundings.
4. Hybrid dense+sparse retrieval with a cross-encoder reranker is the baseline;
   query rewriting for conversational context is the most commonly missing piece.
5. Order context by relevance with the best at the extremes, number sources for
   mechanical citation, and explicitly permit "not in the context".
6. Start simple and build a 100–300 triple evaluation set in CI — most quality
   problems are chunking, hybrid retrieval and reranking rather than architecture.

Next: agents, where the model chooses actions rather than just producing text.
