---
title: Mobile and cross-platform
minutes: 16
summary: Responsive design, React Native, and the constraints a phone actually imposes that a desktop browser never surfaces.
---

"Make it responsive" undersells what mobile development actually requires —
a phone isn't a small desktop; it has a fundamentally different input model
(touch, not a precise pointer), a metered and variable network, and
constraints (battery, a smaller viewport, an OS-level back gesture) that
never come up building for a desktop browser.

## Responsive design: beyond media queries

```text
  @media (max-width: 768px) { .sidebar { display: none; } }

  → media queries are the MECHANISM; the actual discipline is
    MOBILE-FIRST design — designing the CONSTRAINED layout
    first, then adding complexity for more space, rather than
    designing for desktop and cramming it into a small screen
    afterward. mobile-first tends to produce a simpler, more
    focused layout even at desktop size, because it forces
    prioritizing what actually matters before there's room to
    avoid that decision.
```

```text
  → touch targets need to be PHYSICALLY large enough for a
    finger, not a mouse cursor — the widely-cited minimum is
    roughly 44×44px (Apple's HIG) or 48×48px (Material
    Design); a button sized correctly for a precise mouse
    pointer is frequently too small to reliably tap.
```

## Touch input is not "click with extra steps"

```text
  a MOUSE has HOVER (a state with no touch equivalent at all)
  and a single precise pointer; TOUCH has none of hover, but
  DOES have gestures a mouse never produces: swipe, pinch-to-
  zoom, multi-touch, and — critically — a 300ms tap-delay some
  browsers historically added to distinguish a tap from the
  start of a double-tap-to-zoom gesture.
```

```text
  → a UI that relies on `:hover` to REVEAL functionality (a
    dropdown menu, a tooltip) has NO EQUIVALENT interaction on
    touch — the content behind a hover-only interaction is
    simply unreachable for a touch user unless there's an
    explicit tap-triggered alternative.
```

## PWAs: web apps that behave like native ones

```text
  a WEB APP MANIFEST (a JSON file declaring the app's name,
  icons, and launch behavior) plus a SERVICE WORKER (the
  Offline and Local-First chapter's mechanism) together let a
  web app be "installed" to a home screen, launch without a
  visible browser chrome, and work offline — without an app
  store submission.
```

```text
  → the trade against a native app: NO access to some
    platform-specific APIs (certain hardware sensors,
    deep OS integration varies significantly by platform and
    changes over time) — a PWA is the right choice when the
    app's needs fit within what the web platform actually
    exposes; genuinely native-only capability requirements push
    toward React Native or a fully native app instead.
```

## React Native: one component model, two render targets

```text
  // works in a browser
  <div className="card"><span>Hello</span></div>

  // React Native — DIFFERENT primitives, SAME component model
  <View style={styles.card}><Text>Hello</Text></View>
```

```text
  → React Native reuses React's component model (props, state,
    hooks, the React and Component Models chapter's mental
    model entirely) but renders to NATIVE platform views, not
    the DOM — there is
    no HTML/CSS underneath; `<View>` and `<Text>` compile to
    actual native iOS/Android UI elements. this is "learn once,
    write... platform-appropriate code," not "write once, run
    anywhere unchanged" — genuine platform differences (iOS vs
    Android navigation conventions, safe-area insets, permission
    prompts) still need platform-specific handling.
```

## The constraints a phone actually imposes

```text
  BATTERY       a background timer, an animation running
              continuously, or a location watch left active
              drains battery in a way desktop development
              rarely has to consider at all

  NETWORK       metered data, variable connectivity (a train
              entering a tunnel), and genuinely higher latency
              than a home wifi connection are the NORM for
              mobile, not an edge case to handle defensively —
              this is the Offline and Local-First chapter's
              actual motivating scenario, not a hypothetical
              one

  VIEWPORT       genuinely limited screen space forces
                 prioritization decisions a desktop layout can
                 defer — there is no room for "just add it to
                 the sidebar" on a phone screen
```

```text
  → design and test for these constraints directly (throttled
    network, battery-conscious background behavior, a real
    small viewport) rather than assuming "responsive" alone
    covers what mobile actually requires — the Web Performance
    chapter's real-device testing advice applies here with even
    more force, since a mobile device's typical hardware is
    further from a developer's own machine than a desktop
    browser's is.
```

## What to take away

1. Mobile-first design (constrained layout first, then add complexity) tends
   to produce a simpler, more focused layout even at desktop size, because
   it forces prioritization before there's room to avoid it.
2. Touch has no hover equivalent — a UI that relies on hover to reveal
   functionality is unreachable for a touch user without an explicit
   tap-triggered alternative.
3. A PWA (manifest + service worker) gets installability and offline
   behavior without an app store, but trades away some platform-specific
   API access — the right choice when the app's needs fit the web
   platform's actual surface.
4. React Native reuses React's component model but renders to native
   platform views, not the DOM — it's "platform-appropriate code," not
   unchanged code running everywhere, since real platform differences still
   need handling.
5. Battery, metered/variable network, and limited viewport are the norm on
   mobile, not edge cases — designing and testing against these constraints
   directly matters more than assuming "responsive" alone covers them.
