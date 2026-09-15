---
title: Motion and animation
minutes: 15
summary: The compositor, orchestration, and respecting a user who has explicitly asked for less motion.
---

The Browser Internals and the DOM chapter already established which CSS
properties skip layout and paint entirely. This chapter is animation built on
top of that fact deliberately — plus the orchestration and accessibility
considerations that separate a smooth, purposeful animation from a
distracting one.

## Animating on the compositor

```text
  the render-pipeline mechanism, restated for animation
  specifically: `transform` and `opacity` changes can run
  ENTIRELY on the compositor thread — no layout, no paint,
  often on the GPU — which is what makes a transform-based
  animation stay smooth even while the main thread is busy with
  something else.

  animating `width`, `top`, `left`, or `margin` instead forces
  LAYOUT on every single frame of the animation — 60fps means
  16.6ms per frame, and a layout-triggering animation on a
  complex page can genuinely miss that budget, producing
  visible jank.
```

```text
  → prefer transform (translateX/Y, scale, rotate) and opacity
    for anything animated — this isn't a stylistic preference,
    it's the direct consequence of which pipeline stages each
    property can skip.
```

## Transitions vs keyframes vs spring physics

```text
  CSS TRANSITION    a single property, from A to B, over a
                    fixed duration — simplest, for a direct
                    state change (hover, a toggle)

  CSS KEYFRAMES      a defined SEQUENCE of states over a
                    timeline — for a repeating or multi-step
                    animation a simple transition can't express

  SPRING PHYSICS      models a mass-spring-damper system rather
  (this project's       than a fixed duration — the animation's
  own motion approval)   TIMING emerges from physical parameters
                         (stiffness, damping) rather than being
                         hand-authored, which is why it feels
                         more natural for interruptible,
                         physical-feeling motion (a dragged
                         card, a hover state)
```

```text
  → this project's own approved use of `motion` is deliberately
    narrow: spring-physics for genuinely spring-like
    interactions (hover, exit/enter crossfades), while a
    continuous per-frame animation loop (an orbital view's
    position math) stays outside the library entirely, mutating
    DOM refs directly with zero React re-renders per frame —
    matching the RIGHT tool to the specific kind of motion,
    rather than reaching for one library for everything animated.
```

## Orchestration

```text
  a multi-element animation (a list of cards fading in one
  after another, a page transition coordinating an outgoing and
  incoming view) needs explicit SEQUENCING and TIMING
  relationships between elements — a naive "animate every
  element independently, all starting at once" produces a
  jarring simultaneous flash rather than an orchestrated
  sequence.
```

```text
  → STAGGERING (each element's animation starting a small,
    consistent delay after the previous one) is the specific
    technique behind the "list items cascade in" effect seen
    constantly in polished UIs — a small delay (30-80ms) per
    item, applied consistently, reads as deliberate motion
    rather than a list simply rendering.
```

## Respecting reduced motion

```text
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important; }
  }
```

```text
  → `prefers-reduced-motion` is an OS-level accessibility
    setting a user turns on explicitly, usually because motion
    triggers a real physical response — vestibular disorders,
    where parallax/zoom/spin effects can cause genuine nausea
    or dizziness, not merely a stylistic annoyance.

  → this is not optional polish — it's a real accessibility
    requirement, and it needs an ACTUAL functional fallback (the
    orbital hub's own reduced-motion mode places nodes correctly
    without the orbit animation, rather than merely making the
    animation instant), not just "make everything happen
    instantly," which can itself be jarring in its own way.
```

## Performance budget for animation

```text
  an animation running WHILE other work competes for the main
  thread (a data fetch resolving, a heavy re-render) can drop
  frames even if the animation itself is compositor-only — a
  transform animation is CHEAP, not FREE, and a page doing
  enough OTHER work can still miss frame budget regardless of
  which properties are animating.
```

```text
  → test animation performance under REALISTIC conditions (the
    Web Performance chapter's real-device testing point,
    applied specifically to motion) — an animation that's
    buttery smooth on an idle page in devtools can visibly
    stutter once real application work is happening
    concurrently.
```

## What to take away

1. Animate transform and opacity, not width/top/left/margin — this follows
   directly from which pipeline stages each property class can skip, not
   from stylistic preference.
2. Spring physics models timing from physical parameters rather than a
   fixed duration, which is why it suits interruptible, physical-feeling
   motion better than a hand-authored transition or keyframe sequence.
3. Multi-element animations need explicit orchestration — staggering each
   element's start by a small consistent delay is what separates a
   deliberate cascade from a jarring simultaneous flash.
4. `prefers-reduced-motion` is a real accessibility requirement tied to a
   genuine physical response some users have to motion, and it needs an
   actual functional fallback, not just an instant version of the same
   effect.
5. A compositor-only animation is cheap, not free — enough competing main-
   thread work can still cause it to drop frames, which is why animation
   performance needs testing under realistic, not idle, conditions.
