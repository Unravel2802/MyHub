---
title: Paged attention and memory management
minutes: 18
summary: Why naive KV allocation wastes most of the memory, and the virtual-memory trick that fixed it.
---

The KV cache is the binding constraint on how many sequences a server can hold at
once, and therefore on throughput. The insight that transformed LLM serving was
that most of that memory was being wasted by allocation, not by data — and the fix
came from operating systems.

## The waste in naive allocation

```text
  a request arrives; the server must reserve KV space.
  it does not know how long the output will be, so it
  reserves the MAXIMUM.

  max_seq_len = 4096, actual output = 200 tokens

  ┌──────────────────────────────────────────────────┐
  │ ████                                             │
  │ used: 200 tokens        wasted: 3,896 tokens     │
  └──────────────────────────────────────────────────┘
                        95% wasted
```

Three distinct wastes compound:

```text
  INTERNAL FRAGMENTATION   reserved-but-unused within a
                           sequence's block (the picture above)
  EXTERNAL FRAGMENTATION   free gaps between contiguous
                           allocations that are individually too
                           small for a new sequence
  RESERVATION WASTE        space reserved for growth that never
                           happens
```

Measurements from the vLLM paper put effective KV utilisation in naive systems at
**20–40%** — most of the expensive memory holding nothing.

## Paged attention

The fix is virtual memory, applied to the KV cache.

```text
  instead of one contiguous region per sequence, allocate
  FIXED-SIZE BLOCKS (e.g. 16 tokens each) and keep a
  BLOCK TABLE per sequence.

  sequence A (37 tokens):
    block table: [12, 5, 23]
                   │   │   │
    physical:      ▼   ▼   ▼
    ┌────┬────┬────┬────┬────┬────┬────┬────┐
    │ b0 │ b5 │ b8 │ b12│ b17│ b23│ b31│ b44│  ← blocks anywhere
    └────┴────┴────┴────┴────┴────┴────┴────┘

  → blocks need not be adjacent
  → allocate one more block only when the current one fills
  → waste is bounded by ONE PARTIAL BLOCK per sequence
```

```text
  waste per sequence
    naive:  up to max_seq_len − actual
    paged:  at most block_size − 1 tokens  (e.g. 15)

  → utilisation rises from 20–40% to over 90%
  → which means 2–4× more concurrent sequences on the same GPU
  → which means proportionally more throughput
```

This is exactly the OS insight from the foundations track — paging removes
external fragmentation and bounds internal fragmentation to one page — applied to
a completely different resource.

## Copy-on-write sharing

The second benefit, which is what makes several patterns cheap:

```text
  parallel sampling: one prompt, 4 candidate completions

  NAIVE: 4 copies of the prompt's KV cache

  PAGED: all four sequences' block tables POINT AT THE SAME
         prompt blocks, with a reference count.
         only when a sequence writes does it copy that block.

  prompt blocks (shared, refcount 4)
    ┌────┬────┬────┐
    │ p0 │ p1 │ p2 │
    └────┴────┴────┘
      ▲    ▲    ▲
   ┌──┴────┴────┴──┬─────┐
   seq1 seq2 seq3 seq4   each then diverges into its own blocks
```

The same mechanism gives **prefix caching** almost for free: a shared system
prompt is a set of blocks with a high reference count, reused across every request
that starts with it.

```text
  applications
    □  beam search
    □  parallel sampling (n > 1)
    □  a shared system prompt across all users
    □  multi-turn conversation — the earlier turns' blocks are
       already there
    □  RAG with a repeated document
```

## Continuous batching, made possible

Paged allocation is what makes continuous batching practical:

```text
  a sequence finishes → its blocks are freed INDIVIDUALLY
  a new sequence arrives → it takes any free blocks

  no compaction, no contiguity requirement, no waiting for
  a contiguous region to open up
```

With contiguous allocation, admitting a new sequence mid-flight requires finding a
contiguous free region large enough — which is exactly the fragmentation problem
that made naive continuous batching impractical.

## Preemption and swapping

When memory runs out with sequences still generating:

```text
  RECOMPUTE     evict a sequence; regenerate its KV from the
                prompt when it resumes
                ✓ no memory movement
                ✗ pays the prefill again

  SWAP          copy its blocks to host RAM; copy back on resume
                ✓ no recomputation
                ✗ PCIe transfer, ~10–30 GB/s

  which is better depends on prompt length: recomputation is
  cheap for short prompts and expensive for long ones.
```

The policy question — which sequence to evict — is scheduling, and the usual
answers apply: evict the newest (least work lost), or the lowest priority, and
never evict below a fairness floor.

## Attention kernels

The other half of memory efficiency, from the arithmetic-intensity chapter:

```text
  FLASHATTENTION      never materialise the N×N matrix; tile
                      through shared memory with an online softmax
                      → O(N) HBM traffic instead of O(N²)
                      → and it does MORE arithmetic while being
                        several times faster

  PAGED + FLASH       FlashAttention kernels that read from a
                      block table rather than a contiguous
                      buffer — what production servers use

  varlen kernels      handle ragged batches with no padding
```

## Architectural levers

Some of the cache problem is decided before serving, in the model:

```text
  MULTI-HEAD (MHA)         32 query heads, 32 KV heads
                           → the largest cache

  GROUPED-QUERY (GQA)      32 query heads, 8 KV heads
                           → 4× smaller cache, negligible
                             quality cost
                           → now the default for new models

  MULTI-QUERY (MQA)        32 query heads, 1 KV head
                           → 32× smaller, some quality cost

  MLA (latent attention)   compress KV into a low-rank latent
                           → large reduction; used by recent
                             frontier models

  SLIDING WINDOW           attend only to the last W tokens
                           → constant cache regardless of length
                           → loses long-range attention
```

**If you are choosing a model to serve, KV cache geometry is a first-class
criterion**, not an implementation detail. Two models of equal quality can differ
by 4× in how many concurrent users a GPU supports.

## Quantising the cache

```text
  KV in fp8 or int8 → 2–4× more sequences per GPU

  quality impact is usually small, because attention is
  relatively tolerant — but it is task-dependent and worth
  measuring, particularly for long contexts where errors
  accumulate over many cached tokens.
```

This is one of the cheapest capacity wins available and is under-used, because it
is a serving flag rather than a model change.

## Tuning

```text
  □  BLOCK SIZE
       smaller → less waste, more block-table overhead
       larger  → more waste, better locality
       16–32 tokens is the usual range

  □  GPU MEMORY UTILISATION target
       the fraction of the GPU given to the KV pool
       higher → more concurrency, less headroom for spikes
       0.85–0.95 is typical

  □  MAX SEQUENCES / MAX TOKENS in flight
       the admission control limit — bound it, per the
       resilience topic

  □  PREEMPTION MODE
       recompute for short prompts, swap for long ones
```

```text
  what to watch

    KV cache utilisation           should be high
    preemption / eviction rate     >0 means memory pressure
    achieved concurrency           vs configured maximum
    prefix cache hit rate          if enabled
    waiting-queue length
```

A non-zero preemption rate is the signal that you are memory-constrained rather
than compute-constrained, which points at the cache optimisations rather than at
more FLOPs.

## What to take away

1. Naive contiguous KV allocation wastes 60–80% of the cache to fragmentation and
   over-reservation.
2. Paged attention allocates fixed blocks with a per-sequence block table,
   bounding waste to one partial block and raising utilisation above 90%.
3. Copy-on-write block sharing makes parallel sampling, beam search, prefix caching
   and multi-turn conversation cheap.
4. Paged allocation is what makes continuous batching practical, because freeing
   and admitting need no contiguity.
5. KV cache geometry (MHA vs GQA vs MQA vs MLA) is a first-class criterion when
   choosing a model to serve — it can change concurrency by 4×.
6. A non-zero preemption rate means you are memory-constrained; quantising the KV
   cache is a cheap and under-used capacity win.

Next: making the model itself smaller and faster.
