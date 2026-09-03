---
title: Teams and handoffs
minutes: 17
summary: The organisational seams where ML projects stall, and the structures that avoid them.
---

Most ML projects that fail do not fail technically. They fail at a handoff — a
model that cannot be deployed, a pipeline nobody owns, a production problem that
neither team considers theirs. The organisational structure is a system design
decision, and it has the same failure modes as any other interface.

## The roles

```text
  DATA SCIENTIST / RESEARCHER
    framing, exploration, modelling, offline evaluation
    optimises for: does this approach work?

  ML ENGINEER
    productionising, pipelines, serving, performance
    optimises for: does this run reliably at scale?

  DATA ENGINEER
    the pipelines that feed everything
    optimises for: is the data correct, fresh and available?

  PLATFORM / MLOps ENGINEER
    the shared infrastructure everyone builds on
    optimises for: can teams self-serve?

  PRODUCT / DOMAIN EXPERT
    what problem, what decision, what an acceptable error is
    optimises for: does this help a user?
```

At a small scale, one person plays several. At a larger scale they are separate
people with separate managers, and each boundary is a place work stops.

## The handoff that fails most

```text
  DATA SCIENTIST                     ML ENGINEER
  ─────────────                      ───────────
  builds in a notebook               must deploy it

  hands over:  model.pkl             needs: features computable
               + a notebook                 at serve time, in
                                            <50 ms, from data
                                            that exists in
                                            production

  → "this feature is a 90-day aggregate computed from a table
     that is only updated nightly and does not exist in the
     serving environment"

  → weeks of rework, or the project quietly dies
```

This is the single most common way ML projects stall, and it is entirely
preventable. The problem is that the constraints that make a model deployable
were never inputs to the modelling work.

The fixes, in order of effectiveness:

**Constrain features up front.** Before modelling, write down what is *available
at serving time*, with what latency and what freshness. A feature that cannot be
computed in production is not a feature; it is a research finding.

**Shared feature definitions.** One definition used for both training and serving
— which is what a feature store provides, and the subject of the next topic. It
eliminates the entire class of "the training feature and the serving feature are
subtly different".

**Involve the engineer at framing, not at handoff.** The cheapest review is the
one that happens before the work.

**Make the data scientist deploy the first version.** Nothing surfaces the
constraints faster than having to satisfy them yourself.

## Three organisational models

```text
  1. CENTRALISED ML TEAM
     all ML people in one team, serving the company

     + shared expertise, consistent tooling, career growth
     - a bottleneck; distant from the domain; a request queue
     → good early, or for a small number of high-value models

  2. EMBEDDED
     ML people sit in product teams

     + close to the problem and the users; fast iteration
     - duplicated infrastructure; inconsistent practice;
       isolated practitioners
     → good when ML is core to many products

  3. HUB AND SPOKE (the usual answer at scale)
     a central PLATFORM team + embedded practitioners

     + shared infrastructure, local context
     - the platform team must actually serve its users, and
       resist becoming a gatekeeper
     → what most organisations converge on
```

The failure mode of model 3 is worth naming: a platform team that measures itself
on platform adoption rather than on product outcomes builds a platform teams
route around. The signal to watch is whether product teams are quietly building
their own pipelines — if they are, the platform is not serving them.

## Ownership after launch

```text
  who is paged when...

  the model's accuracy degrades?
  the feature pipeline fails at 3am?
  latency exceeds the SLO?
  a prediction causes a customer complaint?
  the training job fails?
  a data source changes schema upstream?
```

**A model with no on-call owner will decay until it is switched off.** Ownership
must be explicit, and it must include the ML-specific failures — an on-call
rotation that covers "the service is down" but not "the model is wrong" has
covered the easy half.

The practical structure that works: **the team that owns the product decision
owns the model**, with the platform team on-call for the platform. That keeps the
incentive aligned — the people who benefit from the model working are the people
woken when it does not.

## The documents worth requiring

```text
  MODEL CARD
    what it does, what data it was trained on, how it performs
    overall AND on slices, known limitations, intended use,
    what it must NOT be used for

  DATASHEET (for the dataset)
    how it was collected, by whom, what it represents, what it
    does not, known biases, licensing

  RUNBOOK
    how to retrain, how to roll back, what each alert means,
    what to do when the feature pipeline fails
```

Model cards were proposed for transparency and turn out to be operationally
valuable for a plainer reason: **they are where "what must this not be used
for" gets written down.** An undeclared consumer using a churn model for credit
decisions is a governance failure that a model card makes preventable.

## Working with a model you did not train

The common situation, and it is largely the reading-code skill from the
foundations track applied to a different artifact:

```text
  □  what was it trained to predict, exactly? (not what it is
     used for — those differ)
  □  what data, from when? how stale is the training set?
  □  what does it do on inputs unlike the training distribution?
  □  which features matter most? (and are they all still computed?)
  □  what is the baseline it beat, and by how much?
  □  what is the fallback when it is unavailable?
  □  when was it last retrained, and last evaluated?
```

The gap between "what it was trained to predict" and "what it is used for" is
where the most damaging misuse lives, and it is almost never documented unless
someone required it.

## Anti-patterns

```text
  ✗  THE THROWN-OVER-THE-WALL MODEL
       research produces a notebook; engineering "productionises" it.
       → rebuild from scratch, twice the work, subtle differences

  ✗  THE UNOWNED PIPELINE
       built for a project, still running, nobody's responsibility
       → fails silently; discovered months later

  ✗  THE PLATFORM NOBODY ASKED FOR
       a year of infrastructure before the first model ships
       → build the platform from the second and third models'
         needs, not the first's guesses

  ✗  METRICS THEATRE
       offline accuracy reported to leadership; nobody measures
       the business outcome
       → the project is defended on a number that does not matter

  ✗  THE PERMANENT PROTOTYPE
       "temporary" notebook-driven scoring, running for two years
```

The third is the most expensive at organisational scale. **Platform requirements
should be extracted from working systems, not anticipated.** Ship one model
end-to-end with whatever it takes, then build the platform from what actually hurt.

## What to take away

1. Most ML project failures are handoff failures, not technical ones.
2. The data-scientist-to-engineer handoff fails when serving constraints were not
   inputs to the modelling — fix it by constraining features up front and sharing
   one feature definition.
3. Hub-and-spoke is where most organisations land; its failure mode is a platform
   team that becomes a gatekeeper rather than a service.
4. A model with no on-call owner decays until it is switched off, and on-call must
   cover "the model is wrong", not only "the service is down".
5. Model cards are operationally valuable because they record what a model must
   *not* be used for, which is where the damaging misuse lives.
6. Build the ML platform from the needs of your second and third models, not from
   guesses before the first.

That completes the ML lifecycle. Next in the track: **ML data pipelines and
feature stores** — the part that consumes most of the engineering effort and
causes most of the production failures.
