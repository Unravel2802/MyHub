---
title: Generative models
minutes: 19
summary: Four ways to model a distribution, and why diffusion won for images.
---

A generative model learns a distribution well enough to sample new instances from
it. Four families have been tried seriously, they make different trade-offs
between sample quality, training stability and likelihood, and the reasons
diffusion displaced GANs are instructive.

## The four families

```text
  AUTOREGRESSIVE      model p(x) = Π p(xᵢ | x<ᵢ)
    ✓ exact likelihood; stable training
    ✓ dominant for TEXT
    ✗ sequential generation — slow for high-dimensional data

  VAE                 encode to a latent distribution, decode
    ✓ stable; a useful learned latent space
    ✗ blurry samples (the reconstruction loss averages)

  GAN                 a generator against a discriminator
    ✓ sharp samples; fast single-pass generation
    ✗ unstable training; mode collapse; no likelihood

  DIFFUSION           learn to reverse a gradual noising
                      process
    ✓ high quality AND stable training
    ✗ slow sampling (many steps) — improving
```

```text
  the historical arc

    GANs dominated images 2015–2021
    → diffusion overtook them, because STABLE TRAINING beat
      sharp samples once quality caught up
```

That is the lesson worth extracting: **a method that trains reliably beats one
that trains better when it works.** GAN training required extensive
hyperparameter care and frequently collapsed; diffusion training is a
straightforward regression problem, which made it scalable in a way GANs never
were.

## VAEs

```text
  x ──▶ ENCODER ──▶ (μ, σ) ──▶ sample z ──▶ DECODER ──▶ x̂

  loss = reconstruction + β · KL(q(z|x) ‖ p(z))
         └── fidelity ──┘   └── keep the latent close to a
                                prior, so it is samplable ──┘
```

```text
  the REPARAMETERISATION TRICK

    sampling is not differentiable.
    write  z = μ + σ·ε  with ε ~ N(0,1)
    → the randomness is in ε, which needs no gradient
    → μ and σ are differentiable

  the same problem the frameworks chapter raised, with the
  cleanest available solution.
```

VAEs produce blurry images because the reconstruction loss averages over the
plausible outputs. They remain widely used **as components**: the latent space in
latent-diffusion models is a VAE's, which is what makes diffusion tractable at
high resolution.

## GANs

```text
  GENERATOR      noise ──▶ fake sample
  DISCRIMINATOR  sample ──▶ real or fake?

  they train ADVERSARIALLY: the generator improves to fool
  the discriminator, which improves to catch it.
```

```text
  the failure modes, all characteristic

  MODE COLLAPSE      the generator finds one output that
                     fools the discriminator and produces
                     only that
  NON-CONVERGENCE    the two oscillate without settling
  IMBALANCE          a discriminator that wins too easily
                     gives the generator no gradient
  NO LIKELIHOOD      you cannot evaluate p(x), so evaluation
                     relies on proxies like FID
```

The mitigations — Wasserstein loss, gradient penalty, spectral normalisation,
progressive growing — are a decade of accumulated fixes for an inherently unstable
optimisation. GANs remain useful where single-pass generation matters (real-time
style transfer, super-resolution) because they need one forward pass where
diffusion needs many.

## Diffusion

```text
  FORWARD (fixed, no learning)
    gradually add Gaussian noise over T steps until the
    image is pure noise

    x₀ ──▶ x₁ ──▶ ... ──▶ x_T ≈ N(0, I)

  REVERSE (learned)
    train a network to predict the NOISE that was added at
    each step, then iteratively remove it

    x_T ──▶ ... ──▶ x₁ ──▶ x₀
```

```text
  the training objective is remarkably simple:

    take an image, add noise at a random level t,
    ask the network to predict the noise.
    loss = MSE(predicted_noise, actual_noise)

  → an ordinary regression problem
  → stable, scalable, no adversarial dynamics
```

That simplicity is the whole reason it won. There is no second network, no
equilibrium to find, and the loss goes down monotonically.

```text
  the practical machinery

  LATENT DIFFUSION    run diffusion in a VAE's compressed
                      latent space rather than pixel space
                      → far cheaper; this is Stable Diffusion
  CLASSIFIER-FREE
  GUIDANCE            train with and without conditioning;
                      at sampling, extrapolate away from the
                      unconditional prediction
                      → the knob that trades diversity for
                        prompt adherence
  SAMPLERS            DDPM (many steps) → DDIM, DPM-Solver
                      (tens of steps)
  CONSISTENCY /
  DISTILLED MODELS    1–4 step generation
```

**Guidance scale is the parameter users actually tune.** Low values give diverse,
loosely-related outputs; high values give literal prompt adherence with reduced
diversity and characteristic artifacts. It has no correct setting, only a
trade-off.

## Flow matching

The current direction, and worth knowing as a name:

```text
  instead of a stochastic denoising process, learn a
  VELOCITY FIELD that transports noise to data along
  straight paths.

  → simpler objective, fewer sampling steps, and it unifies
    the diffusion and normalising-flow perspectives
  → increasingly the formulation used in new models
```

## Evaluating generative models

```text
  FID           distance between feature distributions of
                real and generated samples
                → the standard for images; sensitive to
                  implementation details, and comparable only
                  within one setup

  IS            inception score — largely superseded

  CLIP SCORE    prompt adherence for text-to-image

  HUMAN         still the ground truth for perceptual quality

  LIKELIHOOD    available for autoregressive models and
                VAEs; not for GANs
```

```text
  the honest position: automatic metrics for generative
  quality correlate imperfectly with human judgement, and
  FID numbers from different papers are frequently not
  comparable.
```

## What to take away

1. Four families trade sample quality, training stability and likelihood
   differently; autoregressive dominates text and diffusion dominates images.
2. Diffusion overtook GANs because stable training beats better-when-it-works
   training — its objective is ordinary noise-prediction regression.
3. VAEs are blurry alone and are essential as components: latent diffusion runs in
   a VAE's compressed space.
4. The reparameterisation trick is the standard solution to differentiating through
   sampling.
5. Classifier-free guidance is the knob trading diversity against prompt adherence,
   and it has no correct setting.
6. Automatic generative metrics correlate imperfectly with human judgement and are
   rarely comparable across papers.

Next: reinforcement learning.
