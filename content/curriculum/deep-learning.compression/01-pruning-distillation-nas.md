---
title: Pruning, distillation and architecture search
minutes: 17
summary: Making a trained network smaller without making it worse.
---

A trained model is usually far larger than it needs to be for the accuracy it
achieves. Three families of technique exploit that: removing parameters, training
a smaller model to imitate a larger one, and searching for a better architecture
under an explicit budget.

## Pruning

```text
  UNSTRUCTURED     zero individual weights, usually by
                   magnitude
                   ✓ 80–95% sparsity with little accuracy loss
                   ✗ NO SPEEDUP on standard hardware — a
                     sparse matrix stored densely does the
                     same work

  STRUCTURED       remove whole channels, heads or layers
                   ✓ a REAL speedup — the tensor is genuinely
                     smaller
                   ✗ more accuracy loss at equal sparsity

  2:4 SEMI-
  STRUCTURED       exactly 2 of every 4 weights zero
                   ✓ ~2× on Ampere+ tensor cores, hardware
                     supported
                   ✓ the practical middle ground
```

```text
  the trap worth stating plainly:

    "we achieved 90% sparsity" means nothing for latency
    unless the sparsity PATTERN is one the hardware or the
    kernel exploits.
```

```text
  the procedure

    train → prune → FINE-TUNE to recover → repeat

  iterative pruning with recovery beats a single aggressive
  pass by a wide margin.
```

**The lottery ticket hypothesis** is the interesting theoretical result here: a
randomly initialised network contains a sparse subnetwork that, trained from *the
same initialisation*, matches the full network. It suggests much of training is
finding which subnetwork to use — and it has not translated into a practical way
to skip the dense training phase.

## Distillation

```text
  TEACHER (large) ──▶ soft outputs / features / rationales
                            │
                            ▼
  STUDENT (small)  trained to match the TEACHER, not just
                   the hard labels
```

```text
  why it beats training the small model directly

    a hard label says "cat".
    the teacher's distribution says "70% cat, 25% lynx,
    5% dog" — which teaches SIMILARITY STRUCTURE the label
    does not contain.

  → the teacher's uncertainty is itself information
```

```text
  the variants

  LOGIT MATCHING     match the output distribution
                     (temperature-softened)
  FEATURE MATCHING   match intermediate representations
  SEQUENCE-LEVEL     train on the teacher's generated outputs
  RATIONALE          train on the teacher's reasoning, not
                     just its answers
```

```text
  the honest assessment

    on a NARROW task, a well-distilled small model routinely
    matches its teacher.
    on BROAD general capability, it does not.
```

**Distillation is the most under-used compression technique**, as the
inference-optimization topic said, because it looks like a modelling project
rather than an efficiency one. A distilled model that meets the bar is 10×
cheaper permanently, which no serving optimisation matches.

## Neural architecture search

```text
  search a space of architectures for one that maximises
  accuracy under a CONSTRAINT.

  EVOLUTIONARY     mutate and select
  RL-BASED         a controller proposes architectures
  DIFFERENTIABLE   relax the discrete choice; optimise by
  (DARTS)          gradient — far cheaper
  ONE-SHOT         train one supernet; evaluate subnetworks
                   without retraining
```

```text
  the lesson that matters for practice:

    search under a LATENCY constraint measured ON THE TARGET
    DEVICE, not under a FLOPs proxy.

  FLOPs poorly predicts real latency — memory access
  patterns and operator support dominate, as the edge topic
  showed.
```

NAS produced MobileNet-class and EfficientNet-class architectures and is expensive
enough that most teams should use its *results* rather than run it. The exception
is deployment to unusual hardware where published architectures were not searched
for your constraints.

## Choosing

```text
  need a smaller model
    │
    ├─ is there a good pretrained SMALL model already?
    │     → use it. seriously — this is the common answer.
    │
    ├─ narrow task, teacher available?
    │     → DISTIL. usually the largest win.
    │
    ├─ need modest size reduction, minimal effort?
    │     → QUANTISATION first (from the GPU topic)
    │
    ├─ have hardware sparsity support?
    │     → 2:4 structured pruning
    │
    └─ unusual hardware constraints, and budget?
          → architecture search under a measured latency
            constraint
```

**Quantisation before pruning** is the usual right order: it is simpler, better
supported, and gives 2–4× with little accuracy cost, where pruning gives a real
speedup only with hardware support.

## What to take away

1. Unstructured pruning reports impressive sparsity and gives no speedup without a
   hardware-exploitable pattern; 2:4 semi-structured is the practical middle
   ground.
2. Iterative prune-then-recover beats a single aggressive pass.
3. Distillation works because the teacher's output distribution carries similarity
   structure that a hard label does not.
4. Distilled small models match their teachers on narrow tasks and not on broad
   capability.
5. Architecture search must be constrained by measured latency on the target
   device, because FLOPs poorly predicts it.
6. Try an existing small model first, then quantisation, then distillation — and
   pruning only with hardware support.

That completes the Deep Learning track. It connects to **LLMs & Frontier AI** for
what these components are assembled into, and to **ML Systems** for training and
serving them.
