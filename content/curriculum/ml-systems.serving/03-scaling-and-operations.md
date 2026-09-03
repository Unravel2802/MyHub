---
title: Scaling and operating a model service
minutes: 18
summary: Autoscaling expensive hardware with minute-long cold starts, and what to watch.
---

A model service is an ordinary service with two unusual properties: the hardware
is expensive enough that idle capacity is a visible cost, and starting a new
instance can take minutes. Both push against the autoscaling instincts that work
for stateless web services.

## The cold-start problem

```text
  scale-up decision                        t+0
  ├─ GPU instance provisioned              t+90 s   ← scarce; may
  │                                                   not be available
  ├─ container image pulled (5–20 GB)      t+180 s
  ├─ model weights downloaded (1–100 GB)   t+300 s
  ├─ weights loaded to GPU memory          t+330 s
  ├─ CUDA context, kernels compiled/warmed t+360 s
  └─ serving at full speed                 t+360 s

  → SIX MINUTES from decision to capacity
```

If traffic can double in two minutes, autoscaling cannot save you. That is not a
tuning problem; it is arithmetic, and the responses are all about not needing to
scale quickly:

```text
  □  HEADROOM sized for the fastest plausible ramp
  □  a WARM POOL of idle instances, pre-loaded
  □  PREDICTIVE scaling for known patterns
  □  PRE-PULLED images on the node pool
  □  weights on FAST LOCAL STORAGE or a shared cache, not
     downloaded from object storage on every start
  □  SLOW START so a cold instance is not immediately given
     full traffic (which makes it look overloaded and can
     trigger more scaling — the amplifying loop)
```

The weight-download step is the one most easily fixed: caching model artifacts on
the node, or in a sidecar volume, removes minutes from every start.

## Scaling signals

```text
  CPU utilisation      ✗ meaningless for a GPU service
  GPU utilisation      ~ better, but a batching server can be
                         busy and still have queue capacity
  QUEUE DEPTH          ✓ direct measure of unserved demand
  QUEUE WAIT TIME      ✓ best — it is what the user experiences
  REQUESTS IN FLIGHT   ✓ good; the concurrency signal
  latency              ✗ lagging; by the time it moves, users
                         are affected
```

**Scale on queue wait time or in-flight concurrency.** Both lead latency, and both
respond correctly to a batching server whose GPU utilisation is a poor proxy for
saturation.

```text
  scale up FAST, scale down SLOWLY
    → the asymmetry from the cluster-scheduling topic, and it
      matters more here because scale-up is so slow
```

## Right-sizing the hardware

```text
  □  does it need a GPU at all?
       small models are often faster on CPU once the transfer
       and launch overhead is counted
  □  which GPU?
       an L4 or A10 may serve a small model at a fraction of
       an H100's cost; the largest card is rarely the cheapest
       per request
  □  can several models share one GPU?
       MIG partitions an A100/H100 into isolated slices
       MPS allows concurrent kernels without isolation
  □  is memory or compute the constraint?
       a memory-bound model wants bandwidth, not FLOPs
```

The most common waste is a large expensive GPU serving a small model at low
utilisation, because that GPU is what the training team already had.

## Multi-tenancy on one GPU

```text
  MIG (Multi-Instance GPU)
    hardware partitioning into isolated slices with their own
    memory and SMs
    ✓ real isolation; predictable performance
    ✗ fixed partition sizes; must be configured ahead

  MPS (Multi-Process Service)
    concurrent kernels from several processes
    ✓ flexible, better utilisation
    ✗ NO isolation — one process can starve another

  MULTI-MODEL SERVER
    one process hosting many models
    ✓ best utilisation; shared memory pool
    ✗ shared failure domain
```

For latency-sensitive tenants, MIG's isolation is worth its rigidity. For a fleet
of small models with tolerant latency, a multi-model server is the most efficient
option.

## What to monitor

```text
  SERVICE HEALTH (ordinary)
    □  request rate, error rate, latency percentiles
    □  queue depth and QUEUE WAIT (separate from inference)
    □  saturation: in-flight vs capacity

  ACCELERATOR
    □  GPU utilisation, memory, temperature, power
    □  achieved batch size distribution
       ← if it is always 1, batching is not working
    □  OOM events

  MODEL-SPECIFIC (the part ordinary monitoring misses)
    □  input feature distributions vs training
    □  PREDICTION distribution — a shift means something changed
    □  null / default / fallback rate per feature
    □  the model version serving each request
    □  fallback activations
```

**The achieved batch-size distribution is an underused metric.** A server
configured for batches of 32 that is actually dispatching batches of 1.4 on
average has a configuration problem worth several times its hardware cost, and
nothing else reveals it.

And the prediction distribution is the earliest available warning that something
upstream has broken — it moves before accuracy metrics, which need labels that
arrive later.

## Deployment

```text
  □  reference a REGISTRY VERSION, not a file
  □  shadow → canary → full, on the traffic layer
  □  compare canary vs baseline on: latency, error rate,
     PREDICTION DISTRIBUTION, and a business metric
  □  rollback is a version change
  □  the model version appears in every log line and response
```

The prediction-distribution comparison is the ML-specific addition to an ordinary
canary. A new model can be healthy on every infrastructure metric while producing
systematically different scores, and downstream thresholds will be wrong.

## Cost control

```text
  the levers, in rough order of effect

  1. BATCHING            often 5–20× throughput per GPU
  2. QUANTISATION        2–4× on memory-bound serving
  3. RIGHT-SIZED HARDWARE
  4. AUTOSCALING with a sensible floor
  5. A SMALLER MODEL     distillation, or a cheaper architecture
  6. CACHING             identical or near-identical requests
  7. spot/preemptible for tolerant workloads
```

```text
  the arithmetic worth doing:

    cost per 1,000 predictions
      = instance $/hour ÷ (predictions/hour)

  and track it over time. it should FALL as you optimise, and
  a rise means something regressed.
```

Caching deserves a note because it is often overlooked in ML serving: for
workloads with repeated inputs — the same document classified twice, the same
prompt prefix, the same user scored repeatedly within a session — a cache is the
cheapest possible optimisation, and prefix caching in LLM serving is a specific
and large win.

## The pre-launch checklist

```text
  □  latency budget written down and MEASURED at p99
  □  load-tested at realistic burst patterns
  □  batching configured and VERIFIED (check the achieved
     batch size)
  □  autoscaling on queue wait, with a floor and a ceiling
  □  cold-start time measured; headroom sized against it
  □  fallback path implemented AND TESTED
  □  model NOT in the caller's readiness probe
  □  inputs, outputs and model version logged
  □  input and prediction distribution monitoring live
  □  rollback tested, not assumed
  □  cost per 1,000 predictions known
```

## What to take away

1. GPU cold starts are minutes, so autoscaling cannot substitute for headroom;
   cache weights and images, and keep a warm pool.
2. Scale on queue wait time or in-flight concurrency, not on GPU utilisation or
   latency.
3. The largest GPU is rarely the cheapest per request; right-size, and consider MIG
   or a multi-model server for small models.
4. Monitor the achieved batch-size distribution — a server dispatching batches of
   1.4 has a configuration problem worth several times its hardware.
5. Prediction distribution is the earliest available warning, because it moves
   before label-dependent accuracy metrics can.
6. Track cost per 1,000 predictions as a metric that should fall over time.

That completes model serving. Next in the track: **inference optimization** —
making the model itself cheaper, which is where the largest gains are.
