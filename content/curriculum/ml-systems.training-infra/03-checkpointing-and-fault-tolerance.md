---
title: Checkpointing and fault tolerance
minutes: 18
summary: Surviving the failures a long run guarantees, and resuming so that the result is unchanged.
---

A training run on 512 GPUs for three weeks will experience hardware failures. Not
might — will. At scale, mean time between failures drops below the length of the
job, and a job that cannot resume is a job that never finishes.

## The arithmetic

```text
  a single GPU node: MTBF ~ months
  512 nodes:         MTBF = months ÷ 512 ≈ HOURS

  a 3-week job on 512 nodes will hit dozens of failures.
  without checkpointing, expected completion time is INFINITE —
  each restart begins again and fails again before finishing.
```

Add spot instances, and interruption is routine rather than exceptional.

## What must be saved

```text
  □  model weights
  □  optimizer state          momentum, variance — much larger
                              than the weights
  □  LR scheduler state       step count, warmup position
  □  the step / epoch counter
  □  RNG state                model, numpy, python, per-worker
  □  the dataloader position  which samples have been seen
  □  gradient scaler state    for mixed precision
  □  the config               so a resume cannot silently differ
```

The two people omit:

**RNG state.** Without it, resuming produces different augmentations and dropout
masks from the run that would have continued — the resumed run is a different
experiment. For reproducibility (not correctness) this matters.

**Dataloader position.** Without it, a resume restarts the epoch, so the model
sees the first portion of the data repeatedly and the tail rarely. Over many
restarts this measurably skews the training distribution — and it is invisible.

```text
  a job restarting every 2 hours in a 6-hour epoch:

    samples 0–33%   seen every restart
    samples 33–100% seen only when a run survives long enough

  → an unintended curriculum nobody designed
```

## Frequency

```text
  expected wasted work per failure ≈ checkpoint_interval / 2

  too frequent   → I/O dominates. writing 100 GB every 5 minutes
                   can consume a double-digit percentage of the run.
  too rare       → a failure costs hours

  rule of thumb: checkpoint every 15–60 minutes, tuned so that
  checkpoint I/O is under ~5% of total time.
```

For very large models the write itself is the problem — hundreds of gigabytes of
sharded state. Two techniques:

```text
  ASYNCHRONOUS CHECKPOINTING
    copy state to host memory (fast), then write to storage in
    the background while training continues
    → the stall becomes the copy, not the upload

  SHARDED CHECKPOINTING
    each rank writes its own shard in parallel
    → write time is divided by the number of ranks rather than
      serialised through rank 0
```

## Writing a checkpoint safely

```text
  BAD
    torch.save(state, "ckpt.pt")
    → a crash mid-write leaves a CORRUPT file, and it has
      overwritten the last good one

  GOOD
    torch.save(state, "ckpt.tmp")
    fsync
    os.rename("ckpt.tmp", "ckpt-step-12000.pt")   # atomic
    update a "latest" pointer
    delete old checkpoints only AFTER the new one is durable
```

Atomic rename is the essential part, for exactly the reason the batch-processing
chapter gave: rename is atomic on a POSIX filesystem and **is not on S3**, where
it is a copy. On object storage, write to a unique key and then update a small
pointer object — the same commit trick as everywhere else.

```text
  keep several checkpoints, not one:
    □  the latest N (for a resume)
    □  the best-by-metric
    □  periodic milestones (every 10k steps) — retained longer

  a single checkpoint means a corrupt one loses the whole run.
```

## Resuming correctly

```text
  a correct resume produces the SAME RESULT as an uninterrupted
  run (within numerical noise).

  □  the LR schedule continues from the right step, not from 0
       ← the most common resume bug: warmup restarts and the
         learning rate spikes, visibly damaging the loss curve
  □  the dataloader continues from the right position
  □  RNG state restored
  □  the optimizer's step count restored (Adam's bias
     correction depends on it)
  □  mixed-precision scaler state restored
```

**Test the resume path.** Run 100 steps, checkpoint, resume, run 100 more; compare
against 200 uninterrupted steps. The losses should track closely. This test takes
minutes and catches every bug above — and almost nobody writes it, which is why
resume bugs are usually discovered as a mysterious loss spike three weeks into a
run.

## Elastic training

Beyond resuming, letting the job continue when the world changes size:

```text
  FIXED SIZE        a node fails → the job dies → restart from
                    a checkpoint with a replacement node
                    → simple; costs the restart plus scheduling

  ELASTIC           a node fails → the remaining ranks re-form
                    and continue
                    → no restart; needs the framework to support
                      it (torchrun's elastic mode, Ray Train)
```

The subtlety: **changing the number of ranks changes the effective batch size**,
so either the per-rank batch or the learning rate must adapt, or the run's
dynamics change mid-flight. Elastic training that ignores this silently alters the
experiment.

Elastic is worth the complexity mainly on spot fleets, where interruption is
frequent enough that restart overhead dominates.

## Spot and preemptible training

```text
  60–80% cheaper, with ~2 minutes' notice of reclamation

  □  handle the termination signal: checkpoint IMMEDIATELY
  □  checkpoint frequently enough that 2 minutes is sufficient
     to write (or keep an async copy always warm)
  □  DIVERSIFY instance types and zones — reclamation is per
     type, so a single-type fleet can lose everything at once
  □  keep the RANK 0 / coordinator on on-demand
  □  make restart automatic, not a human noticing
```

The last two are the difference between spot training being cheap and being a
part-time job for an engineer. A coordinator on spot means the whole job dies with
it; a restart that requires a human means the job is idle overnight.

## Failure modes beyond node loss

```text
  □  NaN LOSS
       detect and halt rather than continuing — training past a
       NaN corrupts every subsequent checkpoint
       → check every N steps and abort, keeping the last good
         checkpoint

  □  A SILENT STRAGGLER
       one rank slowed by thermal throttling or a bad NIC.
       collectives run at the speed of the slowest rank, so
       throughput drops with no error.
       → monitor PER-RANK step time, not the average

  □  A HUNG COLLECTIVE
       one rank died between collectives; the others wait
       forever on an all-reduce
       → NCCL timeouts must be set, or the job hangs silently
         for hours

  □  GRADUAL MEMORY GROWTH
       a retained graph; OOM after hours
       → the `total_loss += loss` bug from the previous chapter
```

The silent straggler is the one that wastes the most money without anyone
noticing: a 512-GPU job running 30% slower because one card is throttling looks
completely healthy in aggregate metrics.

## Monitoring a training run

```text
  □  loss, and its GRADIENT NORM (a spike precedes divergence)
  □  learning rate — confirms the schedule is doing what you think
  □  step time, PER RANK
  □  MFU
  □  GPU memory, temperature, power
  □  checkpoint write time and success
  □  data loader queue depth
  □  restart count
```

Alert on: loss NaN or not decreasing, step time regressing, a rank deviating from
its peers, and checkpoint failure. **Checkpoint failure alerting is the one to
insist on** — a job that has silently stopped checkpointing is a job that will
lose everything at the next failure, and nothing else will tell you.

## What to take away

1. At 512 nodes, MTBF drops to hours; checkpointing is what makes a long job
   finish at all.
2. Save optimizer, scheduler, RNG and dataloader position — omitting dataloader
   position creates an unintended curriculum over repeated restarts.
3. Checkpoint every 15–60 minutes, targeting under 5% of run time; use async and
   sharded writes for large models.
4. Write to a temporary name and rename atomically, and keep several checkpoints —
   rename is not atomic on object storage.
5. Test the resume path by comparing 100+100 steps against 200; the LR schedule
   restarting from zero is the classic resume bug.
6. Monitor per-rank step time to catch silent stragglers, and alert on checkpoint
   failure — nothing else reveals a job that has stopped saving.

Next: orchestrating these jobs — scheduling, queues and cost.
