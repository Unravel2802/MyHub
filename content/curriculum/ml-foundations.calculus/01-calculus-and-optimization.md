---
title: Calculus and optimization
minutes: 19
summary: Gradients, what they promise, and why non-convex optimisation works anyway.
---

Training is optimisation: find parameters minimising a loss. The tools are the
gradient and the chain rule, and the interesting question is why gradient descent
works at all on a surface with no guarantees.

## The gradient

```text
  ∇f = [∂f/∂x₁, ∂f/∂x₂, ...]

  → points in the direction of STEEPEST ASCENT
  → its magnitude is how steep
  → descend by stepping AGAINST it
```

```text
  θ ← θ − η∇L(θ)

  the entire algorithm. everything else is a refinement of
  the step size and direction.
```

```text
  the local guarantee, and its limit

    the gradient describes the surface only INFINITESIMALLY.
    a step of size η may leave the region where that
    description holds — which is exactly what happens when
    the learning rate is too high.
```

## The chain rule

```text
  d/dx f(g(x)) = f'(g(x)) · g'(x)

  → and backpropagation is this, applied systematically over
    a computation graph, with intermediate results reused.
```

```text
  the multiplicative structure is why gradients vanish and
  explode:

    ∂L/∂x₁ = ∏ (local derivatives)

    each < 1 → the product shrinks exponentially with depth
    each > 1 → it grows

  → residual connections add a term with derivative 1, which
    breaks the product.
```

## Convexity, and living without it

```text
  CONVEX          one minimum, and it is global
                  → gradient descent finds it
                  → linear/logistic regression, SVMs

  NON-CONVEX      many local minima and saddle points
                  → no guarantee at all
                  → every neural network
```

```text
  so why does it work?

  □  in HIGH DIMENSIONS, most critical points are SADDLES,
     not local minima — a point is a local minimum only if
     the surface curves up in EVERY one of a million
     directions, which is vanishingly unlikely
  □  most local minima that exist are nearly as good as the
     global one
  □  stochastic gradient noise helps escape saddles
  □  overparameterisation makes good solutions abundant
```

**The saddle-point insight is the key one.** The intuition that
high-dimensional optimisation is hard because of local minima is largely wrong;
the difficulty is saddle points and plateaus, and noise handles them.

## Second-order information

```text
  the HESSIAN — the matrix of second derivatives — describes
  CURVATURE.

  □  positive definite → a local minimum
  □  mixed signs       → a saddle
  □  condition number  → how elongated the valley is
```

```text
  NEWTON'S METHOD uses it: θ ← θ − H⁻¹∇L
    → far faster convergence
    ✗ the Hessian is [params × params] — for a 7B model
      that is 49 × 10¹⁸ entries. impossible.

  so we use APPROXIMATIONS:
    momentum        an implicit smoothing of the gradient
    Adam            per-parameter scaling from the second
                    moment — a diagonal curvature estimate
    L-BFGS          a low-rank Hessian approximation; used
                    for smaller problems
```

Adam is best understood as a cheap, diagonal approximation to second-order
information: it scales each parameter's step by an estimate of that parameter's
gradient magnitude, which adapts to differing curvature per dimension.

## Constrained optimisation, briefly

```text
  LAGRANGE MULTIPLIERS turn a constrained problem into an
  unconstrained one by adding a penalty term.

  → which is exactly what regularisation is:
      "minimise loss subject to ‖w‖ ≤ c"
      becomes
      "minimise loss + λ‖w‖"

  → and λ is the multiplier
```

Seeing weight decay as a constraint made soft is worth the reframing: it explains
why λ trades off against the loss rather than being an independent setting.

## Numerical gradients, for debugging

```text
  ∂f/∂x ≈ [f(x+ε) − f(x−ε)] / 2ε

  → too slow for training
  → INVALUABLE for verifying a hand-written gradient

  if your analytic gradient and the numerical one disagree
  beyond tolerance, the analytic one is wrong.
```

This is the standard check for custom autograd functions and custom losses, and it
takes minutes to write.

## Practical implications

```text
  □  the LEARNING RATE is the step size, and the single most
     important hyperparameter
  □  gradient CLIPPING bounds the step when the gradient is
     enormous
  □  gradient NORM is the best early warning of divergence
  □  a plateau in the loss may be a saddle, not a minimum —
     patience or a warm restart can escape it
  □  the loss SURFACE depends on the parameterisation:
     normalisation reshapes it, which is why it helps
```

## What to take away

1. The gradient is a local, infinitesimal description; a step too large leaves the
   region where it applies.
2. Backprop's multiplicative chain is why gradients vanish and explode, and residual
   connections break the product with a derivative-1 term.
3. Neural network optimisation is non-convex with no guarantees, and works because
   high-dimensional critical points are mostly saddles rather than local minima.
4. Second-order methods converge faster and are infeasible at scale; Adam is a cheap
   diagonal approximation to curvature.
5. Regularisation is a constraint made soft via a Lagrange multiplier, which is what
   λ actually is.
6. Numerical gradient checking is the standard way to verify a hand-written
   gradient, and it takes minutes.

Next: probability and statistics.
