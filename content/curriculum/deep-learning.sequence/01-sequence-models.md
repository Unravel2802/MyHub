---
title: Sequence models
minutes: 18
summary: RNNs, LSTMs, and the limitations that motivated attention.
---

Before attention, sequences were processed recurrently: one element at a time,
carrying a hidden state forward. Recurrent models are largely historical for
language, and understanding their limitations is what makes the transformer's
design choices legible.

## The recurrent idea

```text
  h_t = f(h_{t-1}, x_t)
  y_t = g(h_t)

  x₁ ──▶ [f] ──▶ h₁ ──▶ [f] ──▶ h₂ ──▶ [f] ──▶ h₃
          ▲              ▲              ▲
          x₁             x₂             x₃

  ONE hidden state carries everything the model knows about
  the past.
```

```text
  the appeal
    ✓ handles variable-length input naturally
    ✓ parameters are shared across positions
    ✓ constant memory per step — O(1) state regardless of
      sequence length
```

## Why plain RNNs fail

```text
  VANISHING / EXPLODING GRADIENTS through time

    the gradient at step 1 is a product of ~T Jacobians.

    each < 1  →  vanishes exponentially
    each > 1  →  explodes exponentially

  → in practice a plain RNN cannot learn dependencies more
    than ~10 steps apart
```

## LSTM and GRU

The fix: an additive path for information to flow along, plus learned gates
controlling what enters and leaves it.

```text
  LSTM

    FORGET gate   what to drop from the cell state
    INPUT gate    what new information to add
    OUTPUT gate   what to expose as the hidden state

    c_t = f_t ⊙ c_{t-1} + i_t ⊙ c̃_t
          └─── ADDITIVE, not multiplicative ───┘
```

```text
  the additive cell-state update is the whole trick:

    ∂c_t/∂c_{t-1} = f_t

  when the forget gate is near 1, the gradient passes through
  essentially unchanged — the same insight as a residual
  connection, arrived at independently and earlier.
```

**GRU** merges the cell and hidden state and uses two gates instead of three:
fewer parameters, comparable quality, and simpler. It is the sensible default when
you want a recurrent model at all.

```text
  even so: LSTMs manage hundreds of steps, not thousands,
  and the fundamental problem remains.
```

## The constraint that killed them

```text
  SEQUENTIAL DEPENDENCE

    h_t depends on h_{t-1}
    → step t cannot be computed until t-1 is done
    → the sequence CANNOT be parallelised across time
```

```text
  RNN, sequence length 1000
    → 1000 sequential steps, each waiting for the last

  transformer, sequence length 1000
    → ONE parallel operation over all positions
```

That is the decisive difference. On the hardware described in the GPU topic —
thousands of cores that need thousands of simultaneous threads — a model that
forces serial execution cannot use the machine. **Attention won on parallelism at
least as much as on quality.**

The second limitation is the **information bottleneck**: everything about a
sequence must pass through one fixed-size hidden state. Attention removes it by
letting the model look directly at any earlier position.

## Encoder-decoder and the origin of attention

```text
  seq2seq (2014)

    ENCODER  reads the input, produces a context vector
    DECODER  generates the output from it

    "the cat sat" ──▶ [encoder] ──▶ c ──▶ [decoder] ──▶
                                    ▲      "le chat..."
                          a SINGLE vector for the whole
                          input — the bottleneck
```

```text
  ATTENTION (2015) was introduced to fix exactly this:

    let the decoder look at ALL encoder states, weighted by
    relevance to the current output position.

  → no bottleneck
  → and, incidentally, interpretable alignments
```

Attention began as a patch on recurrence. *Attention Is All You Need* removed the
recurrence and kept the patch — which is a useful reminder that architectural
progress often comes from noticing that the auxiliary mechanism was doing the
work.

## Where recurrence still applies

```text
  ✓  very long sequences where O(N²) attention is prohibitive
  ✓  streaming with strict constant-memory requirements
  ✓  small models on constrained hardware
  ✓  time-series forecasting, where they remain competitive
  ✓  as a component in hybrid architectures
```

**State space models** (Mamba and successors) are the modern return of this idea:
linear-time recurrence with a state formulation that *can* be parallelised during
training via a scan, recovering the training efficiency that killed RNNs while
keeping constant-memory inference. They are covered in their own topic, and they
are the reason recurrence is worth understanding rather than merely remembering.

## What to take away

1. Recurrence carries a single hidden state forward, giving variable-length
   handling and constant memory per step.
2. Plain RNNs cannot learn long dependencies because the gradient is a product of
   many Jacobians; LSTM's additive cell-state update is the fix, and is the same
   insight as a residual connection.
3. Sequential dependence is what killed recurrence for language: it cannot be
   parallelised across time, so it cannot use modern accelerators.
4. The fixed-size context vector was an information bottleneck, and attention was
   introduced specifically to remove it.
5. Attention began as a patch on recurrence; removing the recurrence and keeping
   the patch produced the transformer.
6. State space models recover parallel training with constant-memory inference,
   which is why recurrence is worth understanding rather than merely remembering.

Next: attention itself, in detail.
