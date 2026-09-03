---
title: Communication and debugging
minutes: 18
summary: The collectives underneath everything, the topology that decides their cost, and finding the slow rank.
---

Every parallelism strategy reduces to a handful of collective operations over a
particular network topology. When distributed training is slower than expected,
the answer is almost always in one of those two things — or in a single rank that
is quietly slower than its peers.

## The collectives

```text
  BROADCAST      one rank's data → all ranks
  REDUCE         all ranks' data → combined on ONE rank
  ALL-REDUCE     all ranks' data → combined, on ALL ranks
  SCATTER        one rank's data → split across ranks
  GATHER         all ranks' data → collected on one rank
  ALL-GATHER     all ranks' data → collected on ALL ranks
  REDUCE-SCATTER combined, then split across ranks
  ALL-TO-ALL     each rank sends a distinct piece to each other
```

```text
  which strategy uses which

    DDP           all-reduce (gradients)
    ZeRO-1/2      reduce-scatter (gradients) + all-gather (params)
    ZeRO-3/FSDP   all-gather (params, per layer) + reduce-scatter
    tensor par.   all-reduce (activations, per layer)
    pipeline      point-to-point send/recv
    MoE           all-to-all (token routing)
```

Two identities worth knowing, because they explain the implementations:

```text
  all-reduce = reduce-scatter + all-gather
  all-gather = the inverse of scatter
```

Ring all-reduce is literally implemented as those two phases, which is why ZeRO-2
— which needs only the reduce-scatter half — costs no more communication than DDP.

## Topology decides cost

```text
  ┌──────────────── node ─────────────────┐
  │  GPU ══ GPU ══ GPU ══ GPU             │  NVLink: 600–900 GB/s
  │   ║      ║      ║      ║              │
  │  GPU ══ GPU ══ GPU ══ GPU             │
  │              │                        │
  │            NIC                        │  400 Gb/s = 50 GB/s
  └──────────────┼────────────────────────┘
                 │
            ┌────┴────┐
            │ switch  │
            └────┬────┘
                 │  ... other nodes
```

```text
  intra-node NVLink     600–900 GB/s
  InfiniBand NDR        ~50 GB/s
  100 GbE               ~12 GB/s
  ─────────────────────────────────
  a 12–70× difference at the node boundary
```

**GPUDirect RDMA** matters here: it lets a NIC read GPU memory directly, avoiding
a copy through host RAM. Without it, every inter-node byte makes two extra trips
across PCIe.

```text
  without GPUDirect:  GPU → host RAM → NIC → network → NIC →
                      host RAM → GPU
  with GPUDirect:     GPU → NIC → network → NIC → GPU
```

Checking that it is actually enabled is worth doing — it is a configuration issue
that silently halves inter-node bandwidth.

## Hierarchical collectives

The optimisation that exploits the topology:

```text
  NAIVE: a flat ring across all 64 GPUs
    → the ring crosses the slow node boundary many times

  HIERARCHICAL:
    1. reduce WITHIN each node, over NVLink        (fast)
    2. all-reduce ACROSS nodes, one rank each      (slow, but
                                                    1/8 the data)
    3. broadcast within each node                  (fast)

  → inter-node traffic divided by the GPUs per node
```

NCCL does this automatically when it detects the topology, which is why letting it
detect the topology correctly matters more than tuning parameters.

## Making it fast

```text
  □  OVERLAP with compute — bucketed all-reduce during the
     backward pass (DDP does this)
  □  FEWER, LARGER messages — small collectives are dominated
     by latency; that is what bucketing achieves
  □  COMPRESS gradients — fp16 or bf16 reduce halves the bytes
     (reduce_dtype in FSDP's MixedPrecision)
  □  keep the CHATTIEST parallelism dimension on the FASTEST
     link
  □  set NCCL_DEBUG=INFO once and READ the topology it detected
     — it is frequently not what you assumed
```

That last item is the highest-value diagnostic in this chapter. NCCL prints which
transport it chose per connection (NVLink, PCIe, IB, socket), and discovering that
it fell back to `socket` between two GPUs you believed were NVLink-connected
explains an enormous performance gap in one line.

## Gradient compression

```text
  bf16 reduce            2× less traffic, essentially free
  fp8 reduce             4×, some quality risk
  top-k sparsification   send only the largest gradients
                         → large savings, needs error feedback
                           (accumulate what you did not send)
  PowerSGD               low-rank approximation of the gradient
                         → big savings, some quality cost
```

Compression matters on slow interconnects and is unnecessary on NVLink. bf16
reduce is the one to enable unconditionally; the aggressive methods are for
Ethernet clusters where communication genuinely dominates, and they should be
validated against an uncompressed baseline before being trusted.

## Debugging: is it communication?

```text
  1. SINGLE-GPU BASELINE
       measure samples/second on one GPU

  2. SCALING TEST
       2, 4, 8, 16 GPUs. plot per-GPU throughput.

     per-GPU
     throughput
        │ ──────╲___
        │            ╲____
        │                 ╲____
        └────────────────────────▶ GPUs

     flat        → scaling well
     falling     → communication-bound past that point

  3. SYNTHETIC DATA
       removes the dataloader from the picture

  4. NCCL TESTS
       run all_reduce_perf standalone. compare achieved
       bandwidth with the link's rating. if the benchmark is
       slow, the problem is the network, not your code.

  5. PROFILE
       Nsight Systems shows NCCL kernels on their own row.
       large NCCL blocks with idle compute = communication bound.
```

Step 4 is the one that separates "my code is bad" from "the cluster is
misconfigured", and running it early saves days of misdirected optimisation.

## Finding the slow rank

Collectives run at the pace of the slowest participant, so **one degraded GPU
slows all 512** with no error anywhere.

```text
  causes
    □  thermal throttling (check clocks and temperature)
    □  a different GPU model mixed into the fleet
    □  a bad NIC or a degraded link
    □  another process on that node
    □  ECC errors causing retries
    □  a slower local disk for that rank's data shard
```

```text
  detection: log PER-RANK step time, every step, and alert on
  deviation from the median

  rank   step time
    0      412 ms
    1      408 ms
    ...
   37      690 ms      ← 68% slower. the whole job runs at this.
```

**Aggregate metrics cannot see this.** The job's average step time rises by the
straggler's contribution and looks like ordinary variance. Per-rank timing is the
only way, and it is a few lines of logging.

## Debugging a hang

```text
  □  ALWAYS set a NCCL timeout. the default may be very long,
     and a hang without one is indistinguishable from slowness.

  □  the usual cause: ranks disagree about which collective to
     run. any conditional that differs per rank:

       if rank == 0:
           dist.all_reduce(x)      ← DEADLOCK. every rank must
                                     call it.

  □  a rank died and the others wait forever on its
     participation

  □  ordering: collectives must be issued in the SAME ORDER on
     every rank
```

```text
  diagnosing:
    NCCL_DEBUG=INFO / NCCL_DEBUG_SUBSYS=ALL
    py-spy dump on each rank — which line is each stuck on?
    → the rank stuck somewhere DIFFERENT is the culprit
```

`py-spy dump --pid <pid>` on every rank is the fastest way to find the odd one
out: 511 ranks in `all_reduce` and one in `torch.save` tells you immediately that
a rank-conditional checkpoint is the deadlock.

## Environment variables worth knowing

```text
  NCCL_DEBUG=INFO              print the detected topology
  NCCL_SOCKET_IFNAME=eth0      pick the right NIC — a wrong
                               default can select a management
                               interface at 1 Gb/s
  NCCL_IB_DISABLE=0            ensure InfiniBand is used
  NCCL_P2P_DISABLE=0           ensure peer-to-peer is used
  TORCH_NCCL_ASYNC_ERROR_HANDLING=1
                               fail rather than hang on error
  TORCH_DISTRIBUTED_DEBUG=DETAIL
                               validate collective consistency
```

`NCCL_SOCKET_IFNAME` selecting the wrong interface is a classic: the job works,
runs at a fraction of the expected speed, and the cause is that all traffic is
going over a 1 Gb/s management network rather than the 400 Gb/s fabric.

## What to take away

1. Everything reduces to a few collectives; all-reduce is reduce-scatter plus
   all-gather, which is why ZeRO-2 costs no more than DDP.
2. The node boundary is a 12–70× bandwidth cliff — verify GPUDirect RDMA and let
   NCCL detect the topology hierarchically.
3. `NCCL_DEBUG=INFO` and reading which transport was chosen is the highest-value
   one-line diagnostic here.
4. Run NCCL's standalone bandwidth test early to separate a misconfigured cluster
   from slow code.
5. Log per-rank step time — one throttling GPU slows all 512 and is invisible in
   aggregate metrics.
6. Always set a NCCL timeout, and diagnose hangs with `py-spy` on every rank; the
   rank stuck somewhere different is the cause.

That completes distributed training. Next in the track: **model serving** — putting
the trained model behind an API, where the constraints invert.
