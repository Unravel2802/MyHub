# Codex prompt — Figma Make dashboard redesign port

Paste the block below to Codex. It's self-contained; everything else in this file is notes for you.

---

```
You're porting a Figma Make redesign into MyHub. The design is approved. Your job is to translate
it, not to copy it — the reference is a standalone Vite prototype and several of its choices are
wrong for this codebase.

READ FIRST, in this order:
1. docs/handoff/dashboard-redesign-port.md — the full reconciliation. Sections 1, 2 and 5 are
   binding constraints, not background.
2. Redesign MyHub Dashboard/src/App.tsx — the visual reference. READ IT, DO NOT IMPORT FROM IT.
   It's a different framework with its own deps, hardcoded fixture data, no auth and no
   repositories. It's excluded from tsc and eslint on purpose.
3. src/components/home/OrbitalHub.tsx and orbitGeometry.ts — the shipped Home, whose architecture
   you extend rather than replace.

DO NOT DO ANY OF THESE. Each one breaks something that currently works:
- Do NOT rename --foreground to --fg, or paste the brief's :root block over app/globals.css. That
  block is a subset of ours that silently drops ~60 tokens including the whole hue kit and the
  spacing scale; it red-fails src/lib/palette.test.ts and src/lib/density.test.ts on contact.
- Do NOT add `@import url('https://fonts.googleapis.com/...')`. Geist is already wired through
  next/font/google in app/layout.tsx. The @import double-loads it and reintroduces both the
  render-blocking request and the layout shift next/font exists to prevent.
- Do NOT move the `dark` class onto a React-rendered div. app/layout.tsx sets it on <html> from an
  inline script before first paint so a dark load never flashes light.
- Do NOT port inline style objects. The prototype has 61 of them and 1 className. Use Tailwind
  utilities against existing tokens: background:'var(--surface)' becomes bg-surface, padding:24
  becomes p-md. If something needs a value with no token, that's a finding — tell me, don't inline
  a literal. (The prototype already drifts: its task card padding is 14px, which is not on the
  8/16/24/32 ramp its own brief mandates.)
- Do NOT call setState inside the requestAnimationFrame loop. The prototype's brief specifies
  `setT(elapsed)` every frame; that re-renders the whole SVG subtree at 60fps forever on the
  landing page. CLAUDE.md rules against it for this component specifically. Positions are written
  to ref-held DOM nodes; React state changes only on discrete events. eslint already flags the
  prototype's version of this as "Cannot access refs during render" at App.tsx:156.

THE CONTRACT IS PUBLISHED. src/components/home/orbitGeometry.ts exports, all unit-tested:
  moonAngleFor(index, total) · moonOffset(angle) · MOON_RX / MOON_RY / MOON_SPEED
  pushTrailPoint(trail, point) · trailPointStyle(index, length) · TRAIL_MAX / TRAIL_MIN_STEP
  reticleTicks(cx, cy, radius, length) · labelAnchorFor(dx)
Build against these. Do not change their values or signatures — if one looks wrong, flag it and
I'll fix it. Note MOON_RY is deliberately NOT the prototype's circular radius: moons orbit the same
2.8:1 flattened ellipse as the ring carrying them, because that flattening is the scene's
perspective. A test pins the two ratios together.

WORK ITEMS, one commit each, in this order:

1. Shared patterns as components, from the prototype's anatomy: page header (breadcrumb + 30px
   title + bottom border), section header (11px uppercase, 0.08em tracking, muted), stat tile
   (label + Geist Mono tabular figure + 3px progress bar), task card. Tailwind only.

2. AppShell sidebar: brand block, sectioned nav (Career / Money groups), streak tile, theme
   toggle, sign out. KEEP the existing lg-breakpoint collapse behaviour — the rail hides behind a
   Menu disclosure below lg, and tests/ui/responsive.spec.ts pins it. The prototype has no
   responsive story at all; don't inherit that. Its 208px width is fine to adopt.

3. OrbitalHub visuals: reticle nodes (ring + 4 cardinal ticks + core dot), motion trails, dot-grid
   and vignette background, rotating dashed hub ring. Extend the existing paint loop at
   OrbitalHub.tsx:85-145; don't rewrite it.

   THE HARD CONSTRAINT: nodes stay real <button> elements. The prototype uses <g onClick> with
   Math.hypot hit-testing and has no keyboard path at all. app/page.tsx deleted the duplicate card
   grid precisely because the orbit became the accessible route to every module, so regressing this
   strands keyboard users with no second way in. Draw the reticle as SVG inside the button, or as
   CSS rings on the button itself. tests/ui/hub.spec.ts will fail you if you get this wrong — it
   walks the real Tab sequence and asserts every node is reached.

   Also keep `if (reduced) return;` after the single placement pass, and make sure moons get placed
   in that one pass too, not only in the animated path.

4. Moons: a locked workspace's modules orbiting their planet, using moonAngleFor/moonOffset. These
   are DECORATION — WorkspacePanel keeps the keyboard path to every module. If you make a moon
   clickable it must be a real <button> with a 48px hit area whatever its painted radius. Read
   expanded/locked state from a ref inside the frame, never from useState.

5. Apply the patterns from (1) per page.

GATES — all four must pass before each commit:
  npm run lint · npm run typecheck · npm run test:ui · npx playwright test tests/ui/hub.spec.ts

The prototype hardcodes colours that exist in no token set — #0c0c0e, #2a2a2e, #28282c, #f0f0f2,
#e0e0e4 at App.tsx:186-191 — contradicting its own brief's "no inline hex" rule. They're within a
shade of --canvas and --border. Use the tokens. If the SVG genuinely needs a distinct dot-grid
value, say so and I'll add it as a token.

Flag rather than fix: anything that would change a published interface, a migration, a token value,
or the orbit geometry. Tell me and I'll change it.
```

---

## Notes for you (not part of the prompt)

**Why work item 3 is the risky one.** It's the only item that can regress accessibility silently.
`tests/ui/hub.spec.ts` now covers it — verified by adding `tabIndex={-1}` to the node and confirming
the guard fails with "Tab reached 0 of 3 orbit nodes" while the older activation test stayed green.
That older test drives nodes with `.focus()`, which succeeds on elements Tab can never reach, so it
was never going to catch this.

**Sequencing.** Items 1 and 2 are independent and can run in parallel. Items 3 and 4 are the same
file and should be sequential. Item 5 depends on 1.

**What stays yours.** If Codex reports that the geometry contract is wrong, or that a page needs a
token that doesn't exist, that comes back to you — those are the two categories where the ratio
amendment says the tech lead writes the one contract and hands it back rather than letting the
implementer improvise.
