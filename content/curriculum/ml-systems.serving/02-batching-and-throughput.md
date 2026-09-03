---
title: Batching and throughput
minutes: 19
summary: The single most effective serving optimisation, and how to get it without ruining latency.
---

The arithmetic-intensity chapter established that batch-1 inference is
bandwidth-bound: you read the entire model to produce one output. Batching amortises
that read across many requests, and it is by a wide margin the highest-leverage
optimisation in model serving.

## Why it works

```text
  batch 1     read 14 GB of weights → 1 prediction
  batch 32    read 14 GB of weights → 32 predictions

  → 32× the throughput for approximately the same memory traffic
```

```text
  throughput
     │                    ┌────────── compute bound: flat
     │                   ╱
     │                 ╱
     │              ╱    ← memory bound: nearly linear in
     │           ╱          batch size
     │        ╱
     └─────────────────────────────▶ batch size
              ▲
        the knee: where you stop being bandwidth-limited
```

```text
  measured on a 7B model, one A100 (illustrative)

    batch   latency   throughput
      1      25 ms     40 req/s
      8      32 ms    250 req/s      ← 6× throughput, +28% latency
     32      60 ms    530 req/s
    128     190 ms    670 req/s      ← diminishing; now compute bound
```

The shape is the point: **the first few doublings are nearly free in latency and
multiply throughput.** Serving without batching typically wastes 80–95% of an
accelerator.

## Static batching and its problem

```text
  wait for N requests or T milliseconds, whichever first

  requests: ●  ●●   ●      ●●●
            └─ batch of 8 or 20 ms ─┘

  the FIRST request in a batch waits for the batch to fill.
```

The tail latency cost is what makes naive static batching unattractive: at low
traffic, every request waits the full timeout. That is a fixed penalty applied
exactly when the system is least loaded.

**Adaptive batching** fixes most of it:

```text
  under high load  → batches fill fast; the timeout never fires
  under low load   → the queue is short; dispatch immediately

  so: dispatch when (queue ≥ max_batch) OR (oldest request has
      waited > max_delay), and set max_delay from your latency
      budget's slack
```

## Continuous batching, for autoregressive generation

Static batching is badly suited to LLM serving because sequences finish at
different times:

```text
  STATIC BATCHING of generation

  seq A  ████████████░░░░░░░░░░░░  done at token 12, then IDLE
  seq B  ████████████████████████  240 tokens
  seq C  ██████░░░░░░░░░░░░░░░░░░  done at token 6, then IDLE
  seq D  ███████████████░░░░░░░░░
         ▲
    the batch runs until the LONGEST sequence finishes.
    finished slots produce nothing but still cost compute.
```

```text
  CONTINUOUS (in-flight) BATCHING

  seq A  ████████████
  seq E              ████████████     ← E starts the instant
  seq B  ████████████████████████       A finishes
  seq C  ██████
  seq F        ████████████████       ← F joins mid-flight
  seq D  ███████████████

  the batch is re-formed EVERY decoding step. finished
  sequences leave; waiting ones join.
```

**This is typically a 2–4× throughput improvement over static batching**, and it
is the main reason to use a purpose-built LLM server (vLLM, TGI, SGLang) rather
than a generic one. The complexity is real — the KV cache must support sequences
entering and leaving arbitrarily — which is exactly what paged attention provides,
covered in the inference-optimization topic.

## Prefill and decode are different workloads

A distinction specific to generation and important for scheduling:

```text
  PREFILL   process the whole prompt in parallel
            → large matmuls, COMPUTE BOUND
            → one pass over 2,000 tokens

  DECODE    generate one token at a time
            → tiny matmuls, MEMORY BOUND
            → 500 sequential passes for 500 tokens
```

```text
  mixing them in one batch:

    a long prefill blocks the decode steps of every other
    sequence in the batch
    → a user mid-generation stalls because someone else
      submitted a 30k-token prompt
```

The mitigations are standard in modern servers:

```text
  CHUNKED PREFILL     split a long prompt into chunks and
                      interleave them with decode steps
  DISAGGREGATION      run prefill and decode on SEPARATE pools,
                      each tuned for its own bottleneck
```

Disaggregated serving is increasingly the frontier design, because the two phases
want genuinely different hardware ratios.

## Padding waste

```text
  a batch of sequences of length 12, 480, 35, 200

  PADDED to the longest:
    ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12 → 480
    ████████████████████████████████████████████  480
    ███████████████████░░░░░░░░░░░░░░░░░░░░░░░░░  35 → 480
    ████████████████████████████░░░░░░░░░░░░░░░░  200 → 480

  ~62% of the compute is spent on padding.
```

```text
  fixes
    □  LENGTH BUCKETING — group similar lengths into a batch
    □  SORT by length within a window before batching
    □  VARIABLE-LENGTH kernels (nested/ragged tensors,
       FlashAttention's varlen mode) — no padding at all
```

Length bucketing is cheap and typically recovers most of the waste. Note the
trade-off: sorting by length correlates batch composition with request content,
which can produce head-of-line blocking for unusual lengths — bucket within a
bounded time window rather than globally.

## Queueing behaviour

```text
  the queue is where latency actually accumulates

  □  BOUND IT. an unbounded queue turns overload into
     universal timeouts, per the admission-control chapter.
  □  DROP EXPIRED requests — never start work whose deadline
     has passed.
  □  PRIORITISE — interactive above batch, first attempts
     above retries.
  □  measure QUEUE TIME separately from inference time.
```

```text
  a latency breakdown that changes what you optimise:

    queue wait    45 ms   ← under-provisioned, or bad batching
    inference     18 ms
    ──────────────────
    total         63 ms

  optimising the model here buys at most 18 ms.
```

Separating queue time from compute time is the single most useful instrumentation
in a model server, and it is frequently missing.

## Tuning, in practice

```text
  1. measure throughput and latency across batch sizes with a
     realistic request mix
  2. find the knee — where throughput stops rising
  3. set max_batch just past it
  4. set max_delay from your budget's SLACK, not from a
     round number
  5. size the queue so the wait plus inference stays within
     the p99 budget
  6. load-test at realistic ARRIVAL PATTERNS, not at a
     constant rate
```

Step 6 matters more than it looks. Real traffic is bursty, and a system tuned
against a constant-rate load generator behaves differently under bursts — which
is when it matters. (And the coordinated-omission warning from the
distributed-systems track applies: a load generator that waits for responses
understates the tail.)

## What to take away

1. Batching amortises the model read across requests and is the highest-leverage
   serving optimisation; unbatched serving wastes most of an accelerator.
2. The first few doublings buy large throughput for small latency; find the knee
   empirically.
3. Static batching makes the first request wait for the batch — use adaptive
   dispatch on queue depth *or* age.
4. Continuous batching re-forms the batch every decoding step and is typically
   2–4× better than static for generation.
5. Prefill is compute-bound and decode is memory-bound; mixing them lets a long
   prompt stall everyone else, hence chunked prefill and disaggregation.
6. Measure queue time separately from inference time, and bound the queue —
   optimising the model when the queue dominates buys nothing.

Next: scaling, cold starts and the operational side of a model service.
