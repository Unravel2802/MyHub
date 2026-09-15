---
title: Styling systems and design tokens
minutes: 16
summary: Utility CSS, theming, and the token layer that keeps a large product's visuals from drifting apart.
---

A styling APPROACH (utility classes, CSS-in-JS, plain stylesheets) is a much
smaller decision than it's usually treated as. The decision that actually
determines whether a product's visuals stay coherent as it grows is whether
there's a single, named layer of design tokens everything else refers back
to.

## The styling approaches, briefly

```text
  UTILITY CSS (Tailwind)   pre-defined atomic classes composed
                          in markup — no naming decisions per
                          component, styles colocated with the
                          markup they affect

  CSS-IN-JS (styled-      styles defined IN a component file,
  components, Emotion)     scoped automatically to that
                          component, can reference JS values
                          (props) directly in style rules

  PLAIN CSS/MODULES        traditional stylesheets, scoped per-
                          file via CSS Modules' auto-generated
                          class names, no JS runtime cost
```

```text
  → each has real trade-offs (bundle size, runtime cost, how
    much naming is required) but NONE of them determines
    whether the product's visuals stay consistent — that's a
    separate, more important decision covered below.
```

## Design tokens: the layer that actually matters

```text
  --color-accent: #3b82f6;
  --spacing-md: 16px;
  --radius-card: 8px;

  → a TOKEN is a NAMED value standing in for a raw one —
    every component references `--color-accent`, never the
    literal `#3b82f6` directly.
```

```text
  → the payoff: changing the brand's accent color means editing
    ONE token definition, and every component using it updates
    automatically — without tokens, the same color hardcoded in
    200 different components means a rebrand is a 200-place
    find-and-replace, with the near-certainty of missing some
    and leaving the product visually inconsistent.
```

```text
  → this is the SAME idea as a constant instead of a magic
    number in code — a token is a magic number's fix, applied
    to design values specifically.
```

## Theming: light and dark as token swaps, not component logic

```text
  :root {
    --bg: white; --fg: black;
  }
  [data-theme="dark"] {
    --bg: #111; --fg: white;
  }

  .card { background: var(--bg); color: var(--fg); }
```

```text
  → a component's CSS never says "if dark mode, use this color"
    — it references the TOKEN, and the token's VALUE changes
    per theme. this is what makes adding a third theme (a
    high-contrast mode, a seasonal theme) require zero component
    changes — only a new token value set, because no component
    ever hardcoded theme-specific logic in the first place.
```

## Consistency vs one-off flexibility

```text
  a design system's tokens exist along a SCALE (spacing-xs,
  spacing-sm, spacing-md, spacing-lg — not arbitrary pixel
  values chosen per-component):

    padding: 13px;        ✗ an arbitrary one-off value, breaks
                              the visual rhythm every other
                              component follows
    padding: var(--spacing-md);   ✓ same scale everything else uses
```

```text
  → this is a real trade-off, not a pure win: the scale
    genuinely constrains what's easy to build — a design that
    needs 13px specifically fights the system. the system is
    worth this constraint because the ALTERNATIVE (arbitrary
    values everywhere) produces a product where nothing lines
    up with anything else, and that cost compounds across every
    component built after the first one that broke the pattern.
```

## Semantic vs raw tokens

```text
  RAW           --blue-500: #3b82f6;
  SEMANTIC       --color-accent: var(--blue-500);
                --color-danger: var(--red-500);
```

```text
  → components should reference SEMANTIC tokens
    (--color-accent), never raw ones (--blue-500) directly —
    this is the indirection that makes "the accent color is
    changing from blue to purple" a ONE-LINE change (repoint
    --color-accent to a different raw token) rather than a
    search for every component that happened to reference
    --blue-500 for a reason unrelated to being "the accent."
```

## What to take away

1. The styling approach (utility CSS, CSS-in-JS, plain stylesheets) is a
   smaller decision than usually treated — it doesn't determine visual
   consistency at scale.
2. A design token is a named value standing in for a raw one, the same fix
   as a named constant instead of a magic number, applied to design values.
3. Theming should be a token-value swap, not component-level conditional
   logic — a component that never hardcodes theme logic needs zero changes
   to support a third theme later.
4. A spacing/sizing scale genuinely constrains what's easy to build, and
   that constraint is worth it — the alternative (arbitrary values
   everywhere) compounds into a product where nothing lines up.
5. Components should reference semantic tokens, never raw ones directly — the
   indirection is what makes a rebrand a one-line change instead of a search
   across every component that happened to reference the same raw value.
