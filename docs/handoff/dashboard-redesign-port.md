# Handoff — porting the Figma Make dashboard redesign

Source of the design: `Redesign MyHub Dashboard/` (Figma Make export — Vite + React 19 SPA, one
621-line `src/App.tsx`) plus the Agent Brief pasted alongside it.

**The design is good and we're taking it.** This document is about the gap between the brief's
_stated_ system and MyHub's _actual_ one. The brief was written by an agent that had a screenshot
and no repository, so it re-derived a design system from scratch rather than reading
`app/globals.css`. Several of its instructions are correct-in-a-vacuum and destructive here.

Nothing below is a criticism of the visual design. It's a list of things that must be translated
rather than copied.

---

## 1. Blockers — applying the brief literally breaks shipped code

### 1.1 ★ Token names don't match. `--fg` vs `--foreground`

The brief defines `--fg`. MyHub has shipped `--foreground`, consumed through the Tailwind
`@theme inline` mapping as `text-foreground` across every module.

**Do not rename.** Keep `--foreground`. The brief's token block is a _subset_ of ours with three
renames, not a replacement. Mapping:

| Brief     | MyHub (keep this) |
| --------- | ----------------- |
| `--fg`    | `--foreground`    |
| `--body`  | `--body` ✓ same   |
| `--muted` | `--muted` ✓ same  |

### 1.2 ★ The brief's `:root` block silently deletes ~60 tokens

Its `:root` omits `--subtle`, `--surface-raised`, `--overlay`, `--primary*`, `--disabled`,
`--success-surface`, `--success-border`, `--danger-subtle`, `--danger-surface`, `--danger-border`,
`--danger-border-hover`, the **entire 15-hue kit** (45 variables), and the **spacing scale**
(`--spacing-xs`…`--spacing-lg`, `--spacing-empty`).

Pasting it over `app/globals.css` red-fails `src/lib/palette.test.ts` and `src/lib/density.test.ts`
immediately, and un-styles every badge in the app.

**Treat the brief's token block as a diff to apply, not a file to write.** Net new from it: nothing.
Every value it lists is already in `globals.css` at the same hex. It is a re-statement of what we
have, minus everything it didn't happen to see in the screenshot.

### 1.3 ★ Wrong file, wrong framework

The brief says `src/index.css` and instructs loading Geist via a Google Fonts `@import`. That's the
Vite prototype's world.

MyHub is Next.js App Router: styles live in **`app/globals.css`**, and fonts are already wired via
`next/font/google` in `app/layout.tsx` (`Geist`, `Geist_Mono` → `--font-geist-sans`,
`--font-geist-mono`).

**Do not add the `@import url('https://fonts.googleapis.com/...')` line.** It would (a) double-load
Geist, (b) reintroduce a render-blocking external request that `next/font` exists to remove, and
(c) reintroduce the layout shift `next/font`'s size-adjust fallback prevents. This is a straight
regression, and it's the single easiest instruction in the brief to follow by accident.

### 1.4 ★ `.dark` on a root `<div>` reintroduces the theme flash

The brief and prototype put `.dark` on the root `<div>` via `useState(true)`.

MyHub sets it on `<html>` from an inline script that runs **before first paint**
(`app/layout.tsx:21-31`), specifically so a dark load never flashes light. Moving the class to a
React-rendered div means the first paint is always light, then corrects — the exact bug that script
was written to kill.

**Keep the current mechanism.** Ignore the brief on this point entirely.

### 1.5 ★ 61 inline style objects vs. the mandated stack

The export has **61 `style={{...}}` blocks and 1 `className`**. It imports Tailwind and then doesn't
use it.

`CLAUDE.md` mandates Tailwind + shadcn/ui. Beyond convention, porting inline styles wholesale would
bypass the semantic utility layer, which is what makes `palette.test.ts` and `density.test.ts`
meaningful — those tests read `globals.css` as data, and inline `padding: 14` never passes through
it. Note the prototype already drifts: task card padding is `'14px 16px'`, and 14 is not on the
8/16/24/32 ramp the same brief declares three sections earlier.

**Port to Tailwind utilities against existing tokens.** `background: 'var(--surface)'` →
`bg-surface`. `padding: 24` → `p-md`. Anything that has no token is a finding, not a licence to
inline it.

---

## 2. The one performance defect worth fixing during the port

The brief specifies, and the prototype implements:

> Uses requestAnimationFrame loop via useEffect; calls `setT(elapsed)` each frame to trigger
> re-render

That is a **React state update at 60fps**, re-rendering the whole SVG subtree — 3 planets, up to
72 trail circles, up to 7 moons with reticles and tick marks — every frame, forever, on the app's
landing page.

`CLAUDE.md` already rules on exactly this, in the `motion` dependency note:

> The orbit's own position/depth/occlusion math stays outside it — a `requestAnimationFrame` loop
> mutating `ref`-held DOM nodes directly, with **zero React re-renders per frame**

So the shipped Home and the prototype disagree, and the shipped one is right. **Port the visual
design, not the animation architecture.** Positions get written to `ref`-held SVG nodes inside the
rAF callback (`el.setAttribute('cx', …)`); React state changes only on discrete events — hover
enter/leave, cluster expand/collapse.

`setT` also makes `t` a render-time value the trail `useRef` is read against, which is a tearing
hazard: `trailsRef` mutates in the rAF callback while `liveClusters` recomputes from `t` during
render. Ref-mutation removes that class of bug rather than papering over it.

---

## 3. Design decisions the brief makes that need your sign-off

These are genuine product changes, not defects. Flagging rather than deciding.

### 3.1 The Home orbit's IA did NOT change — correcting an earlier claim in this doc

An earlier revision of this section said the shipped Home orbits ten module nodes on two rings and
that the prototype's three clusters were an IA change. **That was wrong**, and it inverted the
recommendation, so it's corrected here rather than quietly edited.

`src/components/home/homeWorkspaces.ts` builds `HOME_WORKSPACES` as the two `MINI_APPS` (Career,
Money) plus a synthetic `core` entry — **three cluster nodes**, each carrying a `modules: NavItem[]`
list. That is already the prototype's structure. The clustering is not new.

The real delta is smaller and almost entirely visual:

| Shipped                                             | Prototype                                    |
| --------------------------------------------------- | -------------------------------------------- |
| Flattened ellipse, `ORBIT_RX 215` / `ORBIT_RY 76`   | True circle, `r = 112`                       |
| `depthOf` drives opacity + scale + z-index together | No depth model                               |
| Sphere nodes (layered radial gradients)             | Reticle nodes — ring, 4 tick marks, core dot |
| Static star field                                   | Dot grid + radial vignette                   |
| Modules listed in `WorkspacePanel` on click-to-lock | Modules orbit the planet as "moons"          |
| —                                                   | Motion trails behind each planet             |

So the port is: reticle treatment, trails, dot-grid background, rotating dashed hub ring, and
moons. Only **moons** need new domain logic; the rest is styling.

**Recommendation:** take all five, and keep `WorkspacePanel`. Moons should be a visual echo of the
panel's module list, not a replacement for it — see §3.4.

### 3.2 Three modules share cyan

`NAV_CAREER` assigns `#0e7490`/`#22d3ee` to **Job CRM, Outreach Log, and Offer Evaluator**, while
the brief states "each module owns exactly one hue." Achievements, Weekly Review, and Dashboard get
no hue at all.

With the kit now at 15 hues (commit `c534d4b` added sky, purple, pink, slate, stone), there is
capacity to give each its own — but see that commit's note: purple sits 9° from violet and pink 10°
from rose, so more hues is not automatically more legible.

**Recommendation:** treat Job CRM / Outreach / Offer Evaluator as one _career-pipeline family_
sharing cyan deliberately — that's what the prototype's clustering already implies — and give
Achievements/Review/Dashboard slate. Document it as intentional so the next agent doesn't "fix" it.

### 3.3 Sidebar 208px vs. shipped 240px, and no responsive story

The prototype's nav is a fixed 208px with `overflow: hidden auto` and no breakpoint behaviour.
`AppShell.tsx:208` currently collapses the rail behind a Menu disclosure below `lg` — that was fix
C3, made because the rail otherwise ate the entire first screen on mobile, and it's pinned by
`tests/ui/responsive.spec.ts`.

**Keep the collapse.** 208 vs 240 is a free choice; the responsive behaviour is not.

### 3.4 ★ The PROTOTYPE is mouse-only — and shipped Home already solved this

The prototype uses `<g onClick>` with hit-testing by `Math.hypot(mouse - node) < 22`: no keyboard
focus, no `role`/`aria`, no touch handling, hover-only moon labels, and 16–22px hit radii against
the brief's own 48px minimum.

Shipped Home already fixed exactly this, deliberately. From `app/page.tsx`'s own comment: the card
grid beside the orbit was _removed_ once each node became a real `<button>` — Tab reaches a node,
Enter/Space opens its `WorkspacePanel`, and Tab again reaches that panel's module links. The orbit
IS the accessible navigation; the grid was a duplicate list.

**This is the highest-risk part of the port.** Rebuilding the nodes as SVG `<g>` elements to get the
reticle look would silently delete the only keyboard path to every module on the landing page, and
no automated check in the repo would catch it.

Constraints for the port, non-negotiable:

- Nodes stay real `<button>` elements positioned over the SVG, never `<g onClick>`. The reticle is
  achievable as SVG _inside_ a button, or as CSS rings on the button itself.
- Moons are decorative echoes of `WorkspacePanel`'s module list. The panel keeps the keyboard path.
  If a moon is clickable, it is a `<button>` too — and then it needs a 48px hit area regardless of
  its 4.5px painted radius.
- `prefers-reduced-motion` must survive. The current loop runs exactly one placement pass and then
  stops; the prototype has no reduced-motion handling at all.

Extend `tests/ui/` to assert the keyboard path before touching the component, so the regression is
caught rather than reasoned about.

---

## 4. Port plan and split

Per `CLAUDE.md`'s contract-first rule and the 35/65 ratio.

**Claude (contracts + correctness):**

1. Publish the `SystemMap` contract — cluster/page data shape, the ref-mutation animation
   architecture from §2, and the keyboard/touch interaction model from §3.4.
2. Any new tokens the port actually needs (expected: none — see §1.2).
3. Extend `tests/ui/` with a Home assertion that survives §3.1: every module reachable, and the
   info panel populated on focus.

**Codex (application):**

4. Port `AppShell` sidebar to the prototype's anatomy — brand block, sectioned nav, streak tile,
   theme toggle, sign out — in Tailwind utilities, keeping the `lg` collapse.
5. Port the page-header, section-header, stat-tile and task-card patterns as shared components.
6. Rebuild `SystemMap` against Claude's published contract.
7. Apply the patterns per page.

**Do not** copy `Redesign MyHub Dashboard/src/App.tsx` into `src/`. It's a reference artifact —
different framework, different styling approach, no auth, no repositories, hardcoded fixture data
(`FOCUS`, `METRICS` are literals). Read it, don't import it.

---

## 5. Published contract — `orbitGeometry.ts`

Claude's half is done. `src/components/home/orbitGeometry.ts` now exports the moon, trail, reticle
and label geometry, all pure and unit-tested (`orbitGeometry.test.ts`, 19 tests). Codex builds
against these and does not change them; if one looks wrong, flag it rather than patching around it.

```ts
// Moons — a workspace's modules orbiting their planet
MOON_RX, MOON_RY, MOON_SPEED
moonAngleFor(index, total): number
moonOffset(angle): { x, y }          // add to the planet's own x/y

// Trails
TRAIL_MAX, TRAIL_MIN_STEP
pushTrailPoint(trail, point): boolean // mutates in place; true if sampled
trailPointStyle(index, length): { radius, opacity }

// Reticle nodes
reticleTicks(cx, cy, radius, length): TickSegment[]
labelAnchorFor(dx): "start" | "middle" | "end"
```

Three decisions baked into these, each pinned by a test:

- **`MOON_RY / MOON_RX` equals `ORBIT_RY / ORBIT_RX`.** The prototype orbits moons on a true
  circle; we don't. The main ring's 2.8:1 flattening _is_ the scene's perspective, and a circular
  sub-orbit inside it reads as a wheel lying in a different plane — a bug, not depth.
- **Trails sample by distance, not per frame.** Per-frame sampling ties trail length to refresh
  rate (twice as long at 120Hz), and since the scene eases to a halt on hover, it would collapse
  into a pile of 24 dots on one spot at exactly the moment the user is looking at it.
- **The buffer is capped.** Unbounded growth on a page that animates indefinitely is a slow leak.

### Wiring it into the existing paint loop

`OrbitalHub.tsx:85-145` already has the correct architecture — extend it, don't rewrite it. Inside
the existing `for (const workspace of HOME_WORKSPACES)` body, after the planet's `x`/`y` are known:

```
pushTrailPoint(trailsRef.current[key], { x, y })
  → repaint that planet's trail circles from trailPointStyle()

if (expandedRef.current === workspace.key)
  for each module i of workspace.modules:
    a = moonAngleFor(i, n) + moonElapsedRef.current * MOON_SPEED
    { x: mx, y: my } = moonOffset(a)
    → write x + mx, y + my onto that moon's ref-held node
```

Non-negotiable, and the reason this section exists:

- **Expanded state is a `ref` read inside the frame, never a `useState` read.** The prototype's
  `setT(elapsed)` at 60fps is the one defect §2 is about. `activeRef`/`lockedRef` in the current
  file are the pattern to copy — state changes only on discrete events.
- **Trail circles and moon nodes are ref-held and mutated**, like `nodeRefs`/`spokeRefs` already
  are. Rendering them from a `t` state value reintroduces the same defect through the back door.
- **`prefers-reduced-motion` still gets exactly one placement pass, then returns.** The prototype
  has no reduced-motion handling at all; the current loop's `if (reduced) return;` must survive,
  and moons must be placed in that single pass rather than only inside the animated path.

Worth noting: `eslint` independently caught the prototype's tearing hazard —
`Cannot access refs during render` at `App.tsx:156`, where `liveClusters` reads `trailsRef.current`
during render while the rAF callback mutates it. That's the same bug §2 predicts, confirmed by the
linter rather than by argument.

### Still open, and Claude's to do before Codex starts on Home

The E2E guard from §3.4 — an assertion that Tab reaches every orbit node and Enter/Space opens its
`WorkspacePanel` — is **not yet written**. Land it before the component work, or the keyboard path
can be deleted silently during the reticle rebuild.

---

One more: the prototype hardcodes colors that exist in no token set — `canvasCol` `#0c0c0e`,
`borderCol` `#2a2a2e`, `dotCol` `#28282c`, `#f0f0f2`, `#e0e0e4` (`App.tsx:186-191`) — in direct
contradiction of the brief's own "no inline hex values" rule. They're within a shade or two of
`--canvas`/`--border`. Use the tokens; if the SVG genuinely needs a distinct dot-grid value, add it
as a token and say why.
