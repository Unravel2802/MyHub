---
title: Web performance
minutes: 18
summary: Core Web Vitals as what a browser can actually measure about real user experience — and the specific things each one catches.
---

Web performance used to be measured by proxy metrics (page weight, request
count) that correlated only loosely with what a user actually experiences.
Core Web Vitals are the industry's answer: three metrics chosen specifically
because each maps to a real, felt moment in loading a page.

## The three Core Web Vitals

```text
  LCP   Largest Contentful Paint — when does the BIGGEST
        visible element (usually a hero image or heading)
        finish rendering — this is the browser's stand-in for
        "does the page feel loaded"

  INP   Interaction to Next Paint — how long between a user's
        interaction (click, tap, keypress) and the NEXT frame
        reflecting its result — "does the page feel responsive"

  CLS   Cumulative Layout Shift — how much visible content
        SHIFTS POSITION unexpectedly after initial render —
        "does the page feel stable, or does it jump around
        under you"
```

```text
  → each metric targets a DIFFERENT felt experience — a page
    can have excellent LCP (loads fast) and terrible CLS (jumps
    around once loaded) or excellent CLS and terrible INP
    (stable, but unresponsive to clicks) — optimizing only one
    doesn't guarantee the others, and a real user's complaint
    ("this feels slow") can map to any of the three depending
    on what specifically they're experiencing.
```

## What causes CLS, specifically

```text
  <img src="hero.jpg">                    ✗ no dimensions —
                                              the browser
                                              doesn't know the
                                              image's aspect
                                              ratio until it
                                              LOADS, so the
                                              layout shifts
                                              once it arrives
                                              and claims space

  <img src="hero.jpg" width="800" height="400">   ✓ the browser
                                                       RESERVES
                                                       the correct
                                                       space
                                                       immediately,
                                                       before the
                                                       image data
                                                       arrives
```

```text
  → the recurring CLS causes: images/ads/embeds without
    reserved dimensions, a web font swapping in and reflowing
    text (FOUT — flash of unstyled text — with a different
    metric than the fallback font), and content injected ABOVE
    existing content (a banner appearing at the top pushes
    everything down) — all fixable by reserving space upfront
    rather than letting layout react to content as it arrives.
```

## What causes poor INP

```text
  a click handler that does expensive synchronous work BLOCKS
  the main thread (the Browser Internals and the DOM chapter's mechanism
  directly) — the browser cannot paint the NEXT frame until
  that JavaScript finishes, so the interaction visibly lags
  even though the click was registered instantly.
```

```text
  → break up long synchronous work (chunk it, defer non-
    critical parts to `requestIdleCallback` or a microtask
    boundary) so the main thread gets control back between
    chunks, letting the browser paint an intermediate frame
    instead of one long unresponsive block.
```

## Bundle size and code splitting

```text
  every kilobyte of JavaScript must be DOWNLOADED, PARSED, and
  EXECUTED before it can do anything — a large bundle delays
  BOTH the first meaningful paint (if it blocks rendering) and
  time-to-interactive (parsing/executing takes real time,
  proportional to bundle size, even on a fast connection).
```

```text
  → this is exactly why the Routing and Navigation chapter's
    code-splitting-by-route matters for performance
    specifically, not just organization — a user visiting the
    homepage shouldn't download the admin panel's JavaScript at
    all, and every route NOT visited this session is bytes
    never parsed, purely from splitting correctly.
```

## Images and fonts

```text
  → serve images in a MODERN FORMAT (WebP/AVIF) at the
    ACTUAL DISPLAY SIZE — a 4000px-wide image displayed at
    400px wastes nearly all of its downloaded bytes on
    resolution nobody sees, the File Storage and Media chapter's "serve
    the resized variant, never the original" rule applied
    specifically to a browser's viewport.

  → `font-display: swap` shows FALLBACK text immediately while
    a custom web font loads, rather than showing INVISIBLE text
    until the font arrives (the default, called FOIT — flash of
    invisible text) — trading a brief font-swap flash for text
    being readable immediately, which is usually the right
    trade.
```

## Measuring on real devices, not just a fast laptop

```text
  a page tested only on a developer's fast laptop, fast wifi,
  and empty browser cache measures a scenario almost no real
  user experiences — REAL USER MONITORING (RUM, collecting
  actual field metrics from real visitors' actual devices and
  connections) and DEVICE/NETWORK THROTTLING in devtools both
  exist because lab conditions systematically understate real-
  world performance.
```

```text
  → a mid-range phone on a throttled 4G connection is a far
    more representative test than an M-series laptop on office
    wifi — performance work aimed at the laptop scenario can
    look great in testing and still be genuinely slow for the
    median real user.
```

## What to take away

1. LCP, INP, and CLS each measure a different felt experience — a page can
   excel at one and fail badly at another, so optimizing only one metric
   doesn't guarantee the others.
2. CLS is caused by content claiming space it wasn't reserved for upfront —
   reserving image dimensions and font-swap space prevents most of it.
3. Poor INP traces back to the main thread being blocked by synchronous
   work, exactly the browser-internals mechanism — breaking up long work
   lets the browser paint intermediate frames.
4. Bundle size delays both paint and interactivity proportionally, which is
   why route-based code splitting is a performance decision, not just
   organizational tidiness.
5. Lab conditions (a fast laptop, fast wifi, empty cache) systematically
   understate real-world performance — real user monitoring and throttled
   testing represent the median user far better than a developer's own
   machine.
