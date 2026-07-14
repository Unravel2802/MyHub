# Handoff — Visual refresh (Claude Code ↔ Codex)

No migration, no schema, no store changes. This is a design pass, written after driving all six
pages in a real browser in both themes.

Read the diagnosis before picking up a task. Several of these are **not** "make it prettier" —
they're layout bugs and an information-architecture problem that no amount of styling will fix.

---

## What's actually wrong

### 1. Light mode is broken, not bland ★ highest severity

`--canvas: #fafaf9`, `--surface: #ffffff`, `--surface-subtle: #fafaf9`. The page background, the
cards, and the tiles inside the cards are **three shades of the same near-white**, separated only
by a 1px hairline border. In light mode the app reads as unfinished — there is no figure/ground
at all. Dark mode is carrying the entire product.

This is a token problem, so it's Claude's. It cannot be fixed page by page.

### 2. The app is form-first when it should be data-first ★ highest severity

This is the real reason it feels lifeless, and it's structural:

- **Job CRM** opens with **three empty forms side by side** filling the whole viewport — Companies,
  New Application, Real Interviews. The funnel snapshot and the actual pipeline are *below the
  fold*. A CRM must open on your pipeline.
- **Prep Tracker** leads with "Log a prep session"; the scorecard is secondary.
- **Outreach Log** is a form plus an empty list, and ~40% of the page is dead canvas.

You open MyHub to see *where you stand*, not to fill in a form. Entry should be a button, a
drawer, or a compact row — not the page's headline. Until this changes, every page's first
impression is a chore.

### 3. Real layout bugs

- **Prep scorecard tiles misalign.** "ML system design" wraps to two lines; its `0` drops a line
  below the other four. The row visibly breaks. (Fix: fixed label height, or `items-end` on the
  values.)
- **Progress bars are invisible at 0%** — every checkpoint bar on a fresh account renders as an
  empty grey track with "0% complete" beneath. The one thing that should motivate looks broken.
- **`ProgressBar`'s transition never fires.** It has `transition-[width]` but mounts at its final
  width, so nothing ever animates.
- **Text rendered at value size.** "No judged attempts" and "No timing data" sit where a big number
  goes, at number weight. A sentence styled as a statistic.
- **Disabled primary buttons read as broken.** "Add company" / "Add application" render as flat grey
  slabs. They're disabled-until-valid, but they look like dead UI.

### 4. Dead air

"This week's schedule" is a tall empty card containing one grey sentence. The Outreach page is
mostly empty canvas. Empty states report absence ("No prep sessions logged yet.") instead of
selling the next action — on the one feature whose entire job is motivation.

The Achievements page now does this *right* (locked cards cite their roadmap source instead of
saying "Locked"). Match that tone everywhere.

### 5. Then, the blandness

Once the above is fixed: every card is the same weight, nothing is oversized, the teal accent
appears ~3× per page, and the only animation in the entire app is the unlock toast.

---

## Hard constraints (both of us)

- **Tailwind + existing semantic tokens only.** No new dependencies — the approved list has no
  animation library and plain CSS covers all of this. Do not reach for framer-motion.
- **Both themes, every time.** Dark surfaces are deep-tinted, never pale (a light pill glows against
  the near-black canvas — see how `--danger-surface` goes to `#2a0a0a`).
- **`motion-reduce:` on every animation.**
- **Don't break the 43 E2E specs.** They query by role, label, and accessible name. Adding wrappers
  and classes is free; renaming headings, changing `aria-label`s, or removing roles is not. If a
  spec breaks, the DOM changed in a way it shouldn't have — fix the component, not the test.

---

## Claude owns — the design system (must land first; Codex is blocked on it)

**Commit 1 — tokens** (`app/globals.css`)

- **Rebuild the light palette for real contrast.** Canvas steps down (`#f4f4f5`-ish), surface stays
  white, tiles step down again. Figure/ground before decoration. This is the single highest-value
  change in this document.
- **Elevation:** `--shadow-panel`, `--shadow-card-hover`, and a dark-mode top-highlight
  (`border-t-white/5`) so cards stop reading as flat rectangles.
- **Display type:** a `--text-hero` step (48–60px, tight tracking, `tabular-nums`). The app currently
  lives entirely between 12px and 24px — size contrast is the cheapest drama available and we use
  none of it.
- **Keyframes:** `fade-up` (staggered grid entrances) and `pulse-glow` (the streak flame when
  `activeToday`).

**Commit 2 — primitives** (`src/components/ui/`)

- `ProgressBar`: mount at 0, set real width in an effect so the existing transition actually fires.
  Give the track a minimum visible fill (or a distinct "not started" treatment) so 0% doesn't look
  broken.
- `StatCard`: add `size?: "default" | "hero"` — this is what gives each page a focal point. Also fix
  the label-wrap misalignment (fixed label height / bottom-aligned values).
- `Badge`: no change; accent and success surfaces were already fixed.

---

## Codex owns — layout, IA, and application

**Do not start until Claude's two commits are on `main`.**

### Phase A — fix the information architecture (do this first; it matters more than styling)

Flip every page from form-first to **data-first**:

- **Job CRM:** pipeline + funnel at the top. Move Companies / New Application / Log Interview behind
  an "Add" button (a drawer or a modal — your call, but they must not own the viewport).
- **Prep Tracker:** scorecard and checkpoint at the top; "Log a session" becomes a compact panel or
  a button.
- **Outreach Log:** lead with the cadence (2–3/week — the whole point of the page, and currently not
  shown at all) and recent conversations. The form goes secondary.

Ship Phase A as its own commit and stop for review. It's a bigger change than it looks and I'd
rather catch a wrong turn once.

### Phase B — the hero pass (Dashboard first, then review, then the rest)

Each page gets exactly one oversized focal point via `StatCard size="hero"`:

| Page | Hero |
|---|---|
| Dashboard | Streak flame + this week's cadence, as a banner |
| Prep Tracker | December checkpoint progress |
| Job CRM | Funnel response rate |
| Task Engine | Open tasks / completed this week |
| Achievements | Current streak |
| Weekly Review | This week's cadence |

**Do the Dashboard alone first and stop for review.** Don't invent the vocabulary six times and
discover it was wrong six times.

### Phase C — colour, motion, empty states

- **Colour:** use the `success` and `accent` surfaces, which exist and are barely touched. Anything
  *good* — a passed mock, a hit cadence target, an unlocked achievement, an `offer` stage — carries
  `success`. Streak flame gets `pulse-glow` only when `activeToday` (a dead streak must never look
  celebratory).
- **Motion:** staggered `fade-up` on card grids (`animation-delay: calc(var(--i) * 40ms)`); cards
  lift on hover and drag (shadow + `-translate-y-px`); progress bars sweep in on mount.
- **Empty states:** rewrite every one to sell the next action, tied to the roadmap.

  > **Before:** "No prep sessions logged yet."
  > **After:** "Your first rep starts the December count. 75 to go." + the log button, right there.

---

## Sequencing

1. **Claude:** light palette + elevation + type + keyframes → then primitives. Two commits.
2. **Codex:** Phase A (IA flip). **Stop for review.**
3. **Codex:** Phase B Dashboard. **Stop for review.** Then the other five.
4. **Codex:** Phase C.

Full gate (`lint`, `typecheck`, `test`, `test:ui`) before every commit. The 43 E2E specs stay green
throughout.
