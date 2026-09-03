---
title: On-device and edge inference
minutes: 19
summary: Running a model on hardware you do not control, and the constraints that changes.
---

Moving inference onto the user's device removes the network, the serving cost and
much of the privacy exposure. It replaces them with constraints you have never had
to think about in a data centre: a battery, a thermal budget, a device you cannot
update, and a fleet spanning a decade of hardware generations.

## Why put a model on the device

```text
  LATENCY        no network round trip. 5 ms instead of 100 ms,
                 and no tail from a congested link.
  OFFLINE        works on a plane, in a tunnel, in a hospital
                 basement.
  PRIVACY        the data never leaves. often the DECIDING
                 argument for health, keyboards and cameras.
  COST           no serving infrastructure. the user's device
                 pays the compute.
  SCALE          serving cost does not grow with users.
```

```text
  and why not

  CAPABILITY     the model must be small enough to fit and run
  UPDATES        shipping a new model means shipping an app —
                 days to weeks, and users who never update
  FRAGMENTATION  a fleet spanning ten years of hardware
  DEBUGGING      you cannot inspect what happened
  BATTERY        a model that drains the battery gets the app
                 uninstalled
  IP             the model is on a device you do not control,
                 and can be extracted
```

**The update constraint is the one most underestimated.** A server-side model can
be rolled back in seconds; an on-device model is in an app-store binary, with a
review process, a staged rollout and a long tail of users on old versions. Design
for a fleet running several model versions simultaneously, permanently.

## The hardware

```text
  CPU     universally available; slowest; use for tiny models
          → ARM NEON, and quantised int8 paths

  GPU     good throughput; higher power draw
          → Metal (iOS), Vulkan/OpenCL (Android)

  NPU     dedicated neural accelerator — best performance per
  /DSP    watt by a wide margin
          → Apple Neural Engine, Qualcomm Hexagon, Google Edge TPU
          → but: a RESTRICTED set of supported operations
          → an unsupported op silently falls back to the CPU
            and destroys the performance you designed for
```

The last line is the characteristic on-device failure: a model that runs at 8 ms
on the NPU in testing runs at 400 ms on a device where one operation is
unsupported and the whole graph falls back. **Verify which operations actually
execute on the accelerator**, on real devices, per platform.

## The constraints, quantified

```text
  MEMORY        a mobile app's budget is often 100–500 MB TOTAL.
                the model, its activations and the app must fit.
                exceeding it is not slow — the OS KILLS the app.

  COMPUTE       10–100× less than a data-centre GPU

  POWER         sustained inference drains a battery in hours;
                users notice and uninstall

  THERMAL       phones THROTTLE after ~30 s of sustained load
                → benchmark numbers from a cold device are a
                  fiction; measure sustained throughput

  STORAGE       app size affects install and update rates
                → a 200 MB model measurably reduces installs

  FRAGMENTATION 10× performance spread across the active fleet
```

Thermal throttling is the constraint that most often invalidates a plan. A model
benchmarked once on a cool device looks viable; run continuously for a minute it
is two to three times slower, and that is the number that matters for anything
processing a video stream or a live camera feed.

## Making a model fit

```text
  1. CHOOSE A MOBILE ARCHITECTURE
       MobileNet, EfficientNet-Lite, and their successors are
       designed for the constraint — depthwise separable
       convolutions, inverted residuals
       → far better than shrinking a server architecture

  2. QUANTISE
       int8 is the standard: 4× smaller, 2–4× faster, and
       what NPUs are built for
       → QAT rather than post-training where accuracy matters

  3. DISTIL
       a small student from a large teacher — usually the
       largest single quality win at a fixed size

  4. PRUNE
       structured pruning only; unstructured gives no speedup
       without hardware support

  5. ARCHITECTURE SEARCH
       search under an explicit LATENCY constraint on the
       target device, not under a FLOPs proxy
```

```text
  FLOPs is a poor predictor of on-device latency.

  memory access patterns, operator support and kernel
  availability matter more. two models with identical FLOPs
  can differ 3× in measured latency.

  → measure on the DEVICE, not in a spreadsheet
```

## The runtimes

```text
  CORE ML          iOS/macOS; best Apple Neural Engine access
  LITERT
  (TF Lite)        Android and cross-platform; broad delegate
                   support
  ONNX RUNTIME     cross-platform, many execution providers
  EXECUTORCH       PyTorch's on-device runtime
  llama.cpp/ggml   on-device LLMs, aggressive quantisation
  NCNN / MNN       lightweight mobile-focused inference
```

```text
  the workflow is a CONVERSION, and conversions break:

    train (PyTorch) → export (ONNX) → convert (Core ML/LiteRT)
                                    → quantise → deploy

  □  an unsupported op fails the conversion, or silently
     falls back
  □  numerical differences appear after conversion
  □  quantisation changes behaviour
  □  each platform needs its own artifact

  → VALIDATE the converted model against the original on a
    fixture, on device. conversion bugs produce plausible
    wrong answers.
```

That validation step is the single most important piece of process here. A
converted model that is "working" but numerically different from the trained one
fails in ways nobody attributes to the conversion.

## Deployment and updates

```text
  BUNDLED IN THE APP                 DOWNLOADED AT RUNTIME

  ✓ always available; no first-run   ✓ update WITHOUT an app
    download                           release
  ✓ works offline immediately        ✓ smaller install
  ✗ app size                         ✓ per-segment or per-device
  ✗ updates need an app release        models
                                     ✗ needs a download, and a
                                       fallback for failure
```

```text
  the pattern that works:

    bundle a SMALL fallback model in the app,
    download the current/larger one on first launch,
    and keep the bundled one as the fallback if the
    download fails or the device is constrained.
```

**And you must support several model versions at once**, because users do not
update. Any feature depending on model output needs to work with whichever version
the device happens to have, which means version-aware handling on the server side
of anything the model feeds.

## Hybrid: on-device plus server

Usually the strongest design:

```text
  CASCADE
    a small model on device handles the common cases;
    escalate to the server when uncertain
    → most requests never leave the device

  DEVICE PREPROCESSING
    embed or featurise locally; send only the compact
    representation
    → privacy and bandwidth benefits, and the heavy model
      stays on the server

  SERVER FALLBACK
    on device by default; server when the device is old,
    the battery is low, or accuracy matters more
```

The cascade is the same idea as the inference-optimization chapter's cost cascade,
with the cheap tier being the user's phone. If 90% of requests are handled locally,
serving cost falls by 90% and the median latency falls to a few milliseconds.

## Testing and monitoring

```text
  TESTING
    □  on REAL DEVICES across the fleet's range — the oldest
       supported device is the one that matters
    □  SUSTAINED load, not a single cold inference
    □  battery drain over a realistic session
    □  memory under pressure, with other apps running
    □  numerical parity against the server model

  MONITORING (harder — you cannot see the device)
    □  aggregated latency and battery telemetry by device class
    □  model version distribution across the fleet
    □  fallback and error rates
    □  crash rates correlated with model version
    □  sampled predictions, with consent, for quality
```

**The model version distribution across the fleet is the metric to build first.**
It tells you what is actually running, which determines whether a fix has reached
users and what the real quality distribution is — and without it you are reasoning
about a fleet you cannot see.

## What to take away

1. On-device inference buys latency, offline capability, privacy and serving cost,
   and costs you updates, debuggability and a decade-wide hardware fleet.
2. Design for several model versions running simultaneously and permanently,
   because users do not update.
3. An unsupported operation silently falls back to the CPU — verify what actually
   runs on the accelerator, on real devices.
4. Thermal throttling makes cold benchmarks a fiction; measure sustained
   throughput, and remember exceeding memory kills the app rather than slowing it.
5. FLOPs poorly predicts on-device latency; measure on the target device, and
   validate the converted model numerically against the original.
6. A device-plus-server cascade is usually the strongest design, and the fleet's
   model version distribution is the first metric to build.

That completes on-device inference, and with it the ML Systems & MLOps track. The
material connects outward: **LLMs & Frontier AI** covers what these systems serve,
**Distributed Systems** covers the infrastructure underneath, and **ML
Foundations** covers the modelling this engineering exists to support.
