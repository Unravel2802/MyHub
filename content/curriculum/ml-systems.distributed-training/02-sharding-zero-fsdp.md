---
title: Sharding with ZeRO and FSDP
minutes: 19
summary: Removing the redundancy in data parallelism so a model larger than one GPU can still train.
---

Data parallelism keeps a full copy of everything on every GPU, which is
enormously wasteful: 64 GPUs hold 64 identical copies of the optimizer state.
ZeRO (Zero Redundancy Optimizer) removes that redundancy in stages, and FSDP is
PyTorch's implementation of the idea. Together they are what makes training
models larger than a single device routine.

## The redundancy

```text
  per GPU, for P parameters, mixed precision with Adam:

    parameters (bf16)          2P
    gradients (bf16)           2P
    optimizer momentum (fp32)  4P
    optimizer variance (fp32)  4P
    fp32 master weights        4P
    ─────────────────────────────
    ~16P bytes, REPLICATED on every GPU

  a 7B model: ~112 GB per GPU, before activations.
  an 80 GB card cannot hold it — on any number of GPUs.
```

The observation ZeRO makes: **each GPU only needs its shard of the optimizer state
to apply its shard of the update.** The rest can live elsewhere and be fetched
when needed.

## The three stages

```text
  ZeRO-1   shard the OPTIMIZER STATE            memory: 16P → 4P + 12P/N
  ZeRO-2   shard optimizer state + GRADIENTS    memory: → 2P + 14P/N
  ZeRO-3   shard everything, incl. PARAMETERS   memory: → 16P/N
```

```text
  per-GPU memory for a 7B model, 64 GPUs

    plain DDP   112 GB    ✗ does not fit
    ZeRO-1       43 GB    ✓
    ZeRO-2       29 GB    ✓
    ZeRO-3        1.8 GB  ✓ ✓
```

ZeRO-3 (FSDP's `FULL_SHARD`) is close to linear memory reduction in the number of
GPUs, which is what allows very large models to train at all.

## How ZeRO-3 works

The mechanism is worth understanding, because its cost follows from it:

```text
  parameters are SHARDED — each GPU permanently owns 1/N.

  FORWARD, layer by layer:
    1. ALL-GATHER this layer's parameters from all ranks
    2. compute the layer
    3. FREE the gathered parameters immediately

  BACKWARD, layer by layer:
    1. ALL-GATHER the parameters again
    2. compute gradients
    3. REDUCE-SCATTER the gradients, so each rank keeps
       only its shard
    4. free

  each rank updates only its own shard, using its own
  optimizer state.
```

```text
  memory footprint over time, ZeRO-3 forward

  ┌──────────────────────────────────────────────┐
  │ sharded params (1/N)  ████                   │  always resident
  │ layer 1 gathered      ░░░░░░░  (freed)       │
  │ layer 2 gathered           ░░░░░░░  (freed)  │
  │ layer 3 gathered                ░░░░░░░      │
  └──────────────────────────────────────────────┘
    only ONE layer's full parameters at a time
```

## The cost

```text
  DDP           1 all-reduce of gradients per step

  ZeRO-3        1 all-gather per layer in the forward
              + 1 all-gather per layer in the backward
              + 1 reduce-scatter of gradients

  → roughly 1.5× the communication volume of DDP
  → and MANY more collectives, so latency matters more
```

The compensating factor is prefetching: while computing layer *k*, the framework
all-gathers layer *k+1*. With enough compute per layer, the communication hides
entirely.

```text
  compute  ████ layer1 ████ layer2 ████ layer3
  comms    ░ gather2 ░  ░ gather3 ░  ░ gather4 ░
           └── overlapped, if compute per layer is large enough

  small layers → communication cannot hide → ZeRO-3 is slow
```

**That is the decision rule.** ZeRO-3 works well for large layers (big
transformers) and badly for models with many small layers, where per-collective
latency dominates.

## Choosing a stage

```text
  does the model fit with plain DDP?
    └─ YES ──▶ use DDP. it is the fastest.

  fits with sharded optimizer state?
    └─ YES ──▶ ZeRO-1 or ZeRO-2. minimal extra communication.

  still does not fit?
    └─────────▶ ZeRO-3 / FSDP FULL_SHARD

  still does not fit on the smallest useful cluster?
    └─────────▶ add tensor/pipeline parallelism (next chapter)
                or CPU offload
```

**Use the least sharding that fits.** Each stage costs communication, and the
memory you are not using is not doing you any good.

A middle option worth knowing: **hybrid sharding** (`HYBRID_SHARD`) shards within
a node and replicates across nodes. Intra-node communication is over NVLink and
fast, so you get much of the memory benefit while the expensive inter-node traffic
stays a single all-reduce as in DDP. On multi-node clusters with slow interconnect
this is frequently the best configuration.

## FSDP in practice

```python
from torch.distributed.fsdp import FullyShardedDataParallel as FSDP
from torch.distributed.fsdp import ShardingStrategy, MixedPrecision

model = FSDP(
    model,
    sharding_strategy=ShardingStrategy.FULL_SHARD,   # or HYBRID_SHARD
    auto_wrap_policy=transformer_auto_wrap_policy,   # ← important
    mixed_precision=MixedPrecision(
        param_dtype=torch.bfloat16,
        reduce_dtype=torch.bfloat16,
        buffer_dtype=torch.bfloat16,
    ),
    limit_all_gathers=True,
    use_orig_params=True,
)
```

**The wrap policy is the setting that matters most.** FSDP shards at the boundary
of each wrapped unit, and the unit size determines the memory/communication trade:

```text
  wrap the WHOLE model as one unit
    → one enormous all-gather; peak memory ≈ the full model
    → defeats the purpose

  wrap each TRANSFORMER BLOCK
    → one block's parameters resident at a time
    → the right granularity for transformers

  wrap every LINEAR LAYER
    → tiny collectives; latency dominates
```

Wrapping per transformer block is the standard, and `transformer_auto_wrap_policy`
exists to express it.

## CPU offload

```text
  move optimizer state, and optionally parameters, to host RAM

  + train models far larger than aggregate GPU memory
  - PCIe is ~30–60 GB/s versus HBM's 2–8 TB/s
  → typically 2–10× slower
```

Offload is a **capability** feature, not a performance one. It is right when the
alternative is not being able to train the model at all, and wrong as a way to save
money on GPUs — the extra hours usually cost more than the memory would have.

## Checkpointing sharded models

An operational detail that causes real pain:

```text
  SHARDED CHECKPOINT
    each rank writes its own shard, in parallel
    + fast to write and to resume at the SAME world size
    - cannot be loaded at a different world size without
      resharding, and cannot be used for inference directly

  CONSOLIDATED CHECKPOINT
    gathered onto rank 0 and written as one state dict
    + portable; loadable anywhere
    - rank 0 must hold the whole model in memory
    - slow for very large models
```

The workable practice: **shard for periodic resume checkpoints, consolidate at the
end and at milestones.** Resharding tools exist but are an operational step you
would rather not perform under time pressure.

## Debugging

```text
  □  OOM DURING all-gather
       the wrap granularity is too coarse. wrap smaller units.

  □  MUCH SLOWER THAN DDP
       communication is not overlapping. check prefetching,
       check that layers are large enough, consider
       HYBRID_SHARD on a slow interconnect.

  □  LOSS DIFFERS FROM SINGLE-GPU
       check the effective batch size and LR first — it is
       usually that, not the sharding.

  □  A HANG
       ranks disagree about which collective to run — the
       conditional-collective bug from the previous chapter.

  □  ACCESSING model.parameters() BEHAVES ODDLY
       parameters are sharded and flattened. use
       use_orig_params=True, or FSDP's summon context, when
       code needs the real parameter shapes.
```

That last one catches people integrating FSDP with existing code: anything that
inspects parameters directly — a custom optimizer, a gradient-norm computation, a
logging hook — must be aware that it may be seeing a shard.

## What to take away

1. Data parallelism replicates ~16P bytes of state on every GPU; ZeRO removes that
   redundancy in three stages.
2. ZeRO-3 all-gathers each layer's parameters just in time and frees them
   immediately, giving near-linear memory reduction at ~1.5× the communication.
3. It works well for large layers where communication hides behind compute, and
   badly for many small layers where per-collective latency dominates.
4. Use the least sharding that fits; hybrid sharding (shard within a node,
   replicate across) is often best on slow inter-node links.
5. The FSDP wrap policy is the most consequential setting — wrap per transformer
   block, not the whole model or every linear layer.
6. CPU offload is a capability feature, not a cost optimisation, and sharded
   checkpoints need consolidating before they are portable.

Next: splitting the model itself — tensor and pipeline parallelism.
