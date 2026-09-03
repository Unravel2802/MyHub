---
title: Where inference time actually goes
minutes: 19
summary: The arithmetic that shows generation is bandwidth-bound, and what that rules in and out.
---

Optimising inference without knowing what limits it produces effort aimed at the
wrong thing. For autoregressive generation the limit is unusually clear, and the
arithmetic takes a minute to do.

## The two phases

```text
  PREFILL — process the prompt
    all tokens at once, in parallel
    large matmuls: [seq_len × hidden] × [hidden × hidden]
    → COMPUTE BOUND
    → one pass, however long the prompt

  DECODE — generate tokens
    one token at a time, each depending on the last
    tiny matmuls: [1 × hidden] × [hidden × hidden]
    → MEMORY BOUND
    → N sequential passes for N tokens
```

```text
  a 2,000-token prompt, 500-token response

  prefill:  ONE pass over 2,000 tokens        ~200 ms
  decode:   500 SEQUENTIAL passes             ~10 s

  → decode dominates, and it is the phase that is
    bandwidth-limited
```

## The decode arithmetic

```text
  every generated token requires reading EVERY weight.

    7B model, bf16     = 14 GB per token
    A100 at 2 TB/s     → 7 ms per token floor
                       → ~140 tokens/second, batch 1

    70B model, bf16    = 140 GB per token
    A100 (80 GB)       → does not fit; needs several GPUs
    on 4× A100         → ~35 GB each, ~17 ms → ~57 tok/s
```

```text
  the arithmetic units are nearly idle throughout.

    FLOPs per token ≈ 2 × parameters = 14 GFLOP
    A100 peak       ≈ 312 TFLOP/s
    → 0.045 ms of arithmetic, inside 7 ms of memory traffic

    → ~0.6% compute utilisation
```

**That number is the whole topic.** Every optimisation that matters for
single-stream generation attacks bytes moved, not operations performed:

```text
  fewer bytes per weight     → QUANTISATION
  reuse a weight read for
    more tokens              → BATCHING
  avoid recomputing          → KV CACHING
  more tokens per weight
    read                     → SPECULATIVE DECODING
  fewer weights read         → SPARSITY, MoE, smaller models
```

And what does *not* help: a faster GPU with the same bandwidth, more FLOPs, or
kernel-level arithmetic optimisation. Bandwidth is the number to compare when
choosing hardware for generation.

## The KV cache

Attention at each step needs the keys and values of every previous token.
Recomputing them each step would be O(N²) work; caching them makes it O(N).

```text
  WITHOUT CACHE            step 5 recomputes K,V for tokens 1–4
  WITH CACHE               step 5 computes K,V for token 5 only,
                           and reads 1–4 from the cache
```

The cost is memory, and it is larger than people expect:

```text
  KV cache size
    = 2 (K and V)
    × layers
    × kv_heads × head_dim
    × sequence_length
    × bytes_per_element

  a 7B model (32 layers, 32 heads, dim 128), bf16:
    per token  = 2 × 32 × 32 × 128 × 2 = 512 KB

    2,000 tokens          → 1 GB
    32 concurrent seqs
      at 2,000 tokens     → 32 GB
    128k context, 1 seq   → 64 GB
```

```text
  → for long contexts and high concurrency, the KV CACHE
    EXCEEDS THE MODEL WEIGHTS.
  → and it is read entirely on every decoding step, so it
    adds to the bandwidth bill too
```

This is why so much inference engineering is really KV-cache engineering:

```text
  GQA / MQA          fewer KV heads than query heads
                     → 4–8× smaller cache. now standard in new
                       models.
  PAGED ATTENTION    allocate the cache in fixed blocks rather
                     than contiguously → removes fragmentation
                     waste (next chapter)
  QUANTISED CACHE    fp8 or int8 KV → 2–4× smaller
  SLIDING WINDOW     keep only the last W tokens
  EVICTION           drop low-attention tokens
```

**Grouped-query attention is the highest-impact of these** and is an architectural
choice — which is why models designed after ~2023 nearly all use it, and why
serving an older multi-head model is disproportionately expensive.

## The metrics that matter

```text
  TTFT   time to first token          — dominated by PREFILL
  TPOT   time per output token        — dominated by DECODE
  ITL    inter-token latency          — the same, per token
  E2E    TTFT + TPOT × output_length
  THROUGHPUT  total tokens/second across all users
```

```text
  they trade against each other:

    larger batches   → better THROUGHPUT, worse TTFT and TPOT
    a long prefill   → worse TTFT for OTHER users in the batch
```

Which to optimise is a product decision:

```text
  CHATBOT           TTFT matters most — perceived responsiveness.
                    TPOT need only beat reading speed
                    (~5–10 tokens/s is enough for a human;
                     faster is barely noticed).

  BATCH SUMMARY     throughput only. latency is irrelevant.

  CODE COMPLETION   TTFT is everything; the response is short.

  AGENT LOOP        E2E across many calls; TPOT dominates because
                    outputs are long and nobody is reading them
                    as they stream.
```

The chatbot observation is worth acting on: past reading speed, **spending
hardware to increase TPOT buys nothing a user perceives**, while spending it on
TTFT or on serving more users does.

## The optimisation ladder

Ordered by effect per unit of effort:

```text
  1. BATCHING (continuous)          5–20×   throughput
  2. A PURPOSE-BUILT SERVER          2–4×   over a naive loop
  3. QUANTISATION (weight-only int4) 2–4×   on decode
  4. GQA/MQA (architecture)          2–4×   cache and bandwidth
  5. FLASH/PAGED ATTENTION           1.5–3× and much less memory
  6. SPECULATIVE DECODING            1.5–3× on latency
  7. A SMALLER OR DISTILLED MODEL    varies, often the largest
  8. PREFIX CACHING                  large, for shared prefixes
  9. KERNEL OPTIMISATION             1.1–1.3×
```

**Steps 1 and 2 are almost always the right starting point**, and step 9 is where
people who enjoy optimisation want to start. If you are not using continuous
batching, nothing below it in the list is worth doing yet.

Step 7 is worth a specific note: a well-distilled small model that meets the
quality bar beats every serving optimisation applied to a large one, and it is
frequently not tried because it feels like a modelling problem rather than an
efficiency one.

## Prefix caching

The optimisation that is nearly free where it applies:

```text
  many requests share a long prefix:
    a system prompt, a few-shot block, a document being
    asked about repeatedly, a conversation history

  cache the KV entries for that prefix and reuse them across
  requests
  → the shared portion of prefill becomes free
```

```text
  a 2,000-token system prompt, 50-token user question

    without prefix caching: prefill 2,050 tokens per request
    with:                   prefill 50
    → ~40× less prefill work, and a proportionally better TTFT
```

For agent and RAG workloads, where a long context is reused across turns, this is
frequently the single largest available win — and it requires only that the
server supports it and that prompts are structured with the stable part first.

## Measuring before optimising

```text
  □  what fraction of time is PREFILL vs DECODE?
       long prompts, short answers → prefill dominates
       short prompts, long answers → decode dominates
       → they need different optimisations

  □  what is the achieved BATCH SIZE?
       if it is ~1, fix batching before anything else

  □  what is the memory split between WEIGHTS and KV CACHE?
       if KV dominates, attack the cache, not the weights

  □  what is the ROOFLINE bound?
       bytes_moved / bandwidth = the floor. if you are near
       it, only algorithmic change helps.
```

The prefill/decode split is the diagnostic that most changes what you do, and it
is workload-specific — a summarisation service and a chat service running the same
model need different optimisations.

## What to take away

1. Prefill is compute-bound and decode is memory-bound; decode dominates end-to-end
   time and is where optimisation belongs.
2. Batch-1 decode reads every weight per token, running the arithmetic units at
   under 1% — every meaningful optimisation reduces bytes moved.
3. The KV cache can exceed the model weights at long context or high concurrency,
   and is re-read every step; GQA is the highest-impact mitigation.
4. TTFT and TPOT trade against throughput, and which matters is a product decision
   — past reading speed, faster TPOT buys nothing a user perceives.
5. Continuous batching and a purpose-built server come first; kernel optimisation
   is last.
6. Prefix caching is often the largest single win for agent and RAG workloads, and
   requires only that stable content comes first.

Next: the techniques themselves — paged attention, speculation and compression.
