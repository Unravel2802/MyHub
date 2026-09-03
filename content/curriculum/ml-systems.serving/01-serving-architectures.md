---
title: Serving architectures
minutes: 19
summary: Where a model runs relative to the request, and choosing the pattern before the technology.
---

Training optimises throughput over hours. Serving optimises latency over
milliseconds, under variable load, with availability requirements. The
constraints invert, and the first decision — where the prediction happens relative
to the request — determines everything else.

## The four patterns

```text
  BATCH (offline)
    score everything on a schedule; write results to a store;
    the app reads a lookup

    ✓ simplest; no latency constraint; easy to backfill
    ✓ the model can be arbitrarily expensive
    ✗ predictions are stale by up to one cycle
    ✗ you score everything, including what nobody asks for
    → churn scores, nightly recommendations, risk tiers

  STREAMING
    score on an event, write the result for later lookup

    ✓ fresher than batch, still off the request path
    ✗ needs streaming infrastructure
    → update a user's segment when they act

  ONLINE (synchronous)
    score during the request

    ✓ always fresh; uses request-time features
    ✗ latency budget; availability becomes your problem
    → fraud checks, ranking, search

  EDGE / ON-DEVICE
    the model runs on the client

    ✓ zero network latency; works offline; private by default
    ✗ hard to update; constrained by the device
    → keyboard prediction, camera effects, wake words
```

**Start by asking whether batch will do.** A great many "real-time ML"
requirements are satisfied by scores computed hourly, and batch removes the
latency budget, the availability requirement, the autoscaling and most of the
monitoring. The question that decides it: *does the prediction depend on
information that only exists at request time?* If not, precompute it.

## The hybrid that usually wins

```text
  precompute the expensive part; combine at request time

  OFFLINE          user and item embeddings, heavy features,
                   candidate sets
  ONLINE           a light model over precomputed pieces plus
                   request context
```

```text
  recommendation serving, the standard shape:

    offline:  embeddings for 100M items, refreshed nightly
    online:   ANN retrieve 500 candidates   (~5 ms)
              rank them with a small model  (~15 ms)
              apply business rules           (~2 ms)
              → 22 ms, using a model that could never run
                over 100M items in a request
```

This two-stage structure — cheap retrieval over everything, expensive ranking over
a few — is the dominant pattern in production ML, and it recurs in search,
recommendation and retrieval-augmented generation alike.

## Embedded versus remote

```text
  EMBEDDED — the model runs in the application process

    ✓ no network hop; lowest latency
    ✓ no extra service to operate
    ✗ the model's language constrains the app's
    ✗ every app instance holds a copy in memory
    ✗ scaling the model means scaling the app
    ✗ a model update is an app deploy

  REMOTE — a separate model service

    ✓ independent scaling and deployment
    ✓ specialised hardware (GPUs) only where needed
    ✓ one model serves many callers
    ✗ a network hop (1–5 ms)
    ✗ another service to operate
```

**Embed small CPU models; serve large or GPU models remotely.** A gradient-boosted
tree scoring in 200 µs should not pay a 2 ms network hop; a 7B language model
should not be duplicated into every application replica.

The decision usually turns on hardware: the moment a model needs a GPU, remote
serving is nearly forced, because you do not want a GPU attached to every
application instance.

## The request path

```text
  request
    │
    ├─▶ VALIDATE            schema, ranges, required fields
    │
    ├─▶ FETCH FEATURES      the online store, batched
    │                       ← usually the LATENCY BOTTLENECK
    ├─▶ TRANSFORM           the shipped preprocessing pipeline
    │
    ├─▶ PREDICT             the model
    │
    ├─▶ POST-PROCESS        thresholds, business rules, filters
    │
    ├─▶ LOG                 input, output, model version, latency
    │
    └─▶ RESPOND
```

Two observations that shape optimisation:

**Feature fetching usually dominates**, not inference. A model that runs in 3 ms
behind a 40 ms feature lookup is not the thing to optimise, and this is a very
common misallocation of effort. Profile the path before tuning the model.

**Logging is on the path and must not block it.** Write to an in-process buffer
and flush asynchronously; a synchronous write to a log service adds its latency
and its availability to every prediction.

## The latency budget

```text
  a 100 ms end-to-end budget, decomposed:

    network in/out            10 ms
    auth, routing              5 ms
    feature fetch             30 ms   ← the biggest item
    preprocessing              5 ms
    model inference           20 ms
    post-processing            5 ms
    headroom for p99          25 ms
    ─────────────────────────────────
                             100 ms
```

Writing the budget down before choosing a model is what prevents building
something that cannot be deployed — the handoff failure from the lifecycle topic,
in its most concrete form.

**Budget for p99, not the mean.** As the distributed-systems track established,
a service p99 is a user's typical experience once a page makes several calls.

## Availability and fallbacks

A model service is a dependency, and the resilience material applies unchanged:

```text
  what happens when the model service is unavailable?

  ✗  FAIL THE REQUEST         — a nice-to-have model takes down
                                the product
  ✓  a CACHED prediction      — stale but plausible
  ✓  a SIMPLE FALLBACK        — popularity ranking, a rules-based
                                score, a global default
  ✓  DEGRADE the feature      — hide the personalised section
```

```text
  and: the model must NOT be in the readiness probe of the
  application that merely uses it — that converts a degradable
  dependency into an outage, per the load-balancing topic.
```

The fallback also needs to be *tested*, and it rots exactly like every other
rarely-executed path.

## Versioning and rollout

```text
  □  the running model version is visible in every response
     and every log line
  □  deployment references a REGISTRY VERSION, not a file path
  □  roll out as a canary on the traffic layer
  □  shadow first for anything significant
  □  rollback is a version change, not a retrain
```

**Shadow deployment is especially valuable here**, because it catches
training/serving skew before any user sees it: run the new model on real traffic,
discard the output, and compare its predictions with the current model's and with
what the offline evaluation predicted.

```text
  offline said +3% AUC
  shadow says the score distribution has shifted and 4% of
  requests hit a feature-missing path
  → that is skew, found at zero user risk
```

## Multi-model serving

```text
  ONE SERVICE PER MODEL             ONE SERVICE, MANY MODELS

  ✓ isolation; independent scaling  ✓ better hardware utilisation
  ✓ simple deployment               ✓ one thing to operate
  ✗ overhead per model; poor GPU    ✗ noisy neighbours
    utilisation for small models    ✗ a shared blast radius
  → the default for a few models    → for many small models
```

Model servers (Triton, TorchServe, KServe, Ray Serve) support multi-model hosting
with dynamic loading — worth it when you have dozens of small models, and
unnecessary complexity for three large ones.

## Choosing the runtime

```text
  the FRAMEWORK (PyTorch, TF)   simplest; slowest; largest
  TorchScript / torch.compile   moderate speedup, same ecosystem
  ONNX Runtime                  portable, good CPU performance
  TensorRT                      fastest on NVIDIA; a compile step
                                and version coupling
  vLLM / TGI / SGLang           purpose-built for LLM serving
  ggml / llama.cpp              CPU and edge inference
```

**Serving the raw training framework is the common default and usually leaves
2–5× on the table.** The counter-argument is real though: an optimised runtime is
another artifact, another build step, and a place where the serving model can
diverge numerically from the trained one. Validate that the exported model
produces the same outputs on a fixture before trusting it — export bugs are quiet
and produce plausible wrong answers.

## What to take away

1. Ask whether batch scoring will do before building online serving — it removes
   the latency budget, availability requirement and most of the monitoring.
2. The dominant production pattern is hybrid: precompute the expensive part
   offline, combine cheaply at request time (retrieve-then-rank).
3. Embed small CPU models; serve large or GPU models remotely — hardware usually
   forces the choice.
4. Feature fetching, not inference, is usually the latency bottleneck; profile the
   path before optimising the model.
5. Write the latency budget down before choosing a model, and budget for p99.
6. Shadow deployment catches training/serving skew at zero user risk, and the model
   must never be in the application's readiness probe.

Next: batching and the throughput/latency trade that defines model serving.
