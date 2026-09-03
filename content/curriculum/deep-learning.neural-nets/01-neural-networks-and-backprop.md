---
title: Neural networks and backpropagation
minutes: 20
summary: What a network computes, and the algorithm that makes learning it tractable.
---

A neural network is a stack of linear transformations separated by nonlinearities,
trained by gradient descent. The interesting part is not the forward computation —
that is matrix multiplication — but backpropagation, which makes computing the
gradient of millions of parameters cost roughly the same as one forward pass.

## What a layer computes

```text
  h = σ(Wx + b)

    W   weights          [out × in]
    b   bias             [out]
    σ   nonlinearity     applied elementwise
```

```text
  WITHOUT the nonlinearity, stacking is pointless:

    W₂(W₁x) = (W₂W₁)x = Wx

  a hundred linear layers collapse to one. the nonlinearity
  is what makes depth mean anything.
```

**Universal approximation** says a network with one sufficiently wide hidden layer
can approximate any continuous function. It is often quoted and rarely useful,
because it says nothing about *how wide* or *whether gradient descent will find
it*. Depth matters in practice because deep networks represent certain functions
exponentially more compactly than shallow ones.

## Activations

```text
  SIGMOID    1/(1+e⁻ˣ)     saturates at both ends → vanishing
                           gradients. historical.
  TANH       zero-centred, still saturates
  ReLU       max(0,x)      → the workhorse: cheap, no
                           saturation for positive inputs
                           ✗ "dying ReLU" — a unit stuck at 0
                             has zero gradient forever
  GELU       smooth, probabilistic gating → transformers
  SwiGLU     gated: (Swish(W₁x) ⊙ W₂x) → modern LLMs
```

```text
  the trend: from saturating (sigmoid) to non-saturating
  (ReLU) to GATED (SwiGLU).

  gating lets one branch modulate another, which consistently
  outperforms a plain elementwise nonlinearity.
```

## Backpropagation

The chain rule applied systematically over a computation graph.

```text
  forward:   x ──▶ [f₁] ──▶ h₁ ──▶ [f₂] ──▶ h₂ ──▶ [loss] ──▶ L

  backward:  compute ∂L/∂h₂, then ∂L/∂h₁, then ∂L/∂W

    ∂L/∂W₁ = ∂L/∂h₂ · ∂h₂/∂h₁ · ∂h₁/∂W₁
             └──── reuse ────┘
```

```text
  the KEY PROPERTY

    naively, computing the gradient of N parameters costs
    N forward passes.

    backprop computes ALL of them in ONE backward pass,
    at roughly the cost of the forward pass.

    → training is ~3× the cost of inference, not N×
```

That reuse is the entire reason deep learning is feasible. Without it, a
7-billion-parameter model would require 7 billion forward passes per gradient
step.

```text
  the memory cost

    the backward pass needs the forward ACTIVATIONS.
    → they must all be retained until used
    → which is why activation memory scales with batch size
      and depth, and why gradient checkpointing (recompute
      instead of store) is such an effective trade
```

## The gradient problems

```text
  VANISHING          gradients shrink multiplicatively through
                     layers; early layers barely learn
                     → residual connections, better
                       initialisation, non-saturating
                       activations, normalisation

  EXPLODING          gradients grow; weights blow up to NaN
                     → gradient clipping, lower LR, better
                       initialisation
```

```text
  RESIDUAL CONNECTIONS are the single most important fix

    h = x + f(x)

    ∂h/∂x = 1 + ∂f/∂x

    → the gradient has a path with a derivative of EXACTLY 1
    → it flows to early layers unattenuated
    → which is what made networks deeper than ~20 layers
      trainable at all
```

The residual insight generalises beyond depth: a network learns a *correction* to
its input rather than a transformation of it, and the identity path means "do
nothing" is the easy default rather than something that must be learned.

## Initialisation

```text
  too SMALL   activations shrink layer by layer → vanishing
  too LARGE   activations grow → exploding

  the goal: keep activation VARIANCE roughly constant
  through depth
```

```text
  XAVIER / GLOROT   var = 2/(fan_in + fan_out)   for tanh
  HE / KAIMING      var = 2/fan_in               for ReLU
                    (accounts for ReLU zeroing half the units)
```

Initialisation was a research problem and is now a solved default — but it is
worth knowing about, because a custom layer with careless initialisation is a
common cause of a model that will not train, and it looks like a learning-rate
problem.

## Loss functions

```text
  REGRESSION
    MSE          penalises outliers heavily
    MAE          robust to outliers
    Huber        quadratic near zero, linear far away

  CLASSIFICATION
    CROSS-ENTROPY  the standard; pairs with softmax
    FOCAL          down-weights easy examples → for heavy
                   class imbalance

  the loss encodes what you consider a MISTAKE. choosing it
  is choosing the objective, and it should follow from the
  cost of each error type.
```

**The numerical-stability point matters:** compute cross-entropy from *logits*,
not from softmax outputs. `log(softmax(x))` overflows and underflows;
`log_softmax(x)` is computed stably. Passing softmax output to a
cross-entropy-with-logits loss is the double-softmax bug from the training-infra
topic, and it trains slowly rather than failing.

## Gradient descent

```text
  θ ← θ − η · ∇L(θ)

  BATCH        the full dataset per step — accurate, slow
  STOCHASTIC   one example — noisy, fast
  MINI-BATCH   32–1024 examples — the practical choice
```

```text
  the noise is not purely a cost.

    stochastic gradients help ESCAPE sharp minima and
    saddle points, and are associated with flatter minima
    that generalise better.

  → which is part of why very large batches sometimes
    generalise worse
```

## What to take away

1. Without a nonlinearity, stacked layers collapse to one; the trend in activations
   is saturating → non-saturating → gated.
2. Backprop computes all parameter gradients in one backward pass by reusing
   intermediate results — that reuse is what makes deep learning feasible at all.
3. The backward pass needs stored activations, which is why activation memory
   scales with depth and batch, and why checkpointing trades compute for it.
4. Residual connections give the gradient a path with derivative exactly 1, which is
   what made very deep networks trainable.
5. Initialisation aims to keep activation variance constant through depth; careless
   initialisation in a custom layer looks like a learning-rate problem.
6. Compute cross-entropy from logits for numerical stability, and choose the loss
   from the cost of each error type.

Next: the frameworks that implement all of this.
