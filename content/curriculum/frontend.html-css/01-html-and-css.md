---
title: HTML and CSS
minutes: 18
summary: The box model, the cascade, and layout that keeps working once real, unpredictable content shows up.
---

Every frontend framework eventually compiles down to HTML and CSS, and every
layout bug that survives to production is usually a gap in the mental model
of one of these two, not a framework problem. This chapter is that mental
model — box model, cascade, and the two layout systems that replaced decades
of hacks.

## Semantic HTML, and why it isn't just style preference

```text
  <div onclick="submit()">Submit</div>              ✗
  <button type="submit">Submit</button>              ✓
```

```text
  the div version LOOKS identical after styling, but a
  <button> comes with real behavior a <div> doesn't: keyboard
  focusable by default, activatable with Space/Enter, announced
  as "button" by a screen reader, and included in an HTML
  <form>'s native submit handling — all without one line of
  JavaScript.
```

```text
  → semantic elements (<nav>, <button>, <article>, <label>) are
    not stylistic choices — they're free ACCESSIBILITY and
    BEHAVIOR that a generic <div> requires you to hand-build
    with ARIA attributes and event handlers, and re-implementing
    them yourself is easy to get subtly wrong (frontend.a11y
    covers exactly how).
```

## The box model

```text
  ┌─── margin ───────────────────┐
  │  ┌─── border ──────────────┐  │
  │  │  ┌─── padding ───────┐  │  │
  │  │  │     content        │  │  │
  │  │  └────────────────────┘  │  │
  │  └──────────────────────────┘  │
  └────────────────────────────────┘

  width: 200px   → by DEFAULT, this is the CONTENT box only —
                    padding and border are ADDED on top, so
                    the element's actual rendered width is
                    200 + padding*2 + border*2
```

```text
  box-sizing: border-box;   → width: 200px NOW INCLUDES
                                padding and border — the
                                element's rendered width is
                                exactly 200px, period.

  → nearly every modern reset applies border-box globally,
    because the default (content-box) makes "make this element
    200px wide" require doing arithmetic every time padding
    changes — border-box makes the number on the element mean
    what it says.
```

## The cascade: why a rule doesn't apply

```text
  SPECIFICITY, roughly, from lowest to highest:
    element selector (p)           1 point
    class/attribute (.button)       10 points
    id (#header)                     100 points
    inline style (style="...")        wins over all of the above
    !important                         wins over EVERYTHING

  a MORE SPECIFIC selector wins regardless of source order; an
  EQUALLY specific one, the LATER rule in the stylesheet wins.
```

```text
  the recurring confusion: "I changed the CSS and nothing
  happened" is almost always a MORE SPECIFIC rule elsewhere
  still winning — not the browser ignoring the new rule. open
  devtools, find the winning rule, and the specificity math
  explains it every time.

  → reaching for !important is treating the symptom — it wins
    the current fight but makes the NEXT override need
    !important too, escalating rather than fixing the
    underlying specificity conflict.
```

## Flexbox: one-dimensional layout

```text
  .row { display: flex; justify-content: space-between; }

  ┌──────────────────────────────────┐
  │ [item]      [item]      [item]   │   ← justify-content:
  └──────────────────────────────────┘      MAIN axis
                                          align-items:
                                            CROSS axis
```

```text
  → flexbox is for a SINGLE ROW OR COLUMN of items that should
    share space, wrap, or align along one axis — a navbar, a
    button group, centering one thing. the two axes
    (main/cross) flip depending on flex-direction, which is the
    usual source of "align-items isn't doing what I expected"
    confusion — it's aligning the CROSS axis, which is
    vertical in a row but horizontal in a column.
```

## Grid: two-dimensional layout

```text
  .layout {
    display: grid;
    grid-template-columns: 200px 1fr;
    grid-template-rows: auto 1fr auto;
  }

  ┌────────┬───────────────────────┐
  │ sidebar │        header          │
  │ (200px) ├───────────────────────┤
  │         │         main            │
  │         ├───────────────────────┤
  │         │        footer            │
  └────────┴───────────────────────┘
```

```text
  → grid is for a layout defined by ROWS AND COLUMNS together
    — a page shell, a card layout, anything where an item's
    position matters in TWO dimensions at once. flexbox can
    fake a grid with enough nested rows, but grid's
    `grid-template-areas` names each region directly, which
    reads far more clearly than nested flex containers for a
    genuinely 2D layout.
```

## Layout that survives real content

```text
  the layout bug that only shows up in production: a fixed-
  height card designed around placeholder text, breaking the
  moment a real product name is three lines instead of one.

    height: 80px;              ✗ breaks on longer content
    min-height: 80px;           ✓ grows to fit; never shrinks
                                   below the design's floor
```

```text
  → design and test layout against REALISTIC content —
    a name with 40 characters, a list with zero items, a list
    with 200 — not the shortest placeholder that happened to
    be in the mockup. min-width/min-height plus overflow
    handling (truncate, wrap, or scroll — decided deliberately,
    not defaulted into) is what makes a layout survive content
    nobody anticipated at design time.
```

```text
  the specific, very common failure this project's own history
  has hit: a flex or grid ITEM defaults to `min-width: auto`,
  which means it will NOT shrink below its content's natural
  width even inside a container with min-w-0 — the fix is
  `min-w-0` on the ITEM itself, not just the container, and
  it's easy to add it to the wrong element.
```

## What to take away

1. Semantic HTML elements come with free accessibility and behavior (focus,
   keyboard activation, screen-reader announcement) that a generic div
   requires hand-building.
2. `box-sizing: border-box` makes a width declaration mean the element's
   actual rendered width — the default content-box makes padding change the
   real size.
3. "The CSS change did nothing" is almost always a more specific selector
   elsewhere still winning, not the browser ignoring the rule — check
   specificity before reaching for `!important`, which only escalates the
   next conflict.
4. Flexbox is for one axis of items sharing space; grid is for a layout
   defined by rows and columns together — grid's named template areas read
   more clearly than nested flex containers for genuinely 2D layouts.
5. Design and test against realistic content (long names, empty lists, huge
   lists) rather than mockup placeholders — a flex/grid item's own
   `min-width: auto` default is a specific, recurring cause of layout that
   only breaks once real content arrives.
