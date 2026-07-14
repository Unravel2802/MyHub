# MyHub — Frontend Refresh Plan

Goal: make MyHub feel like a premium, consumer-grade product rather than an internal tool that
shipped as a wireframe.

This plan is written from a real inspection — all six pages driven in a browser, in both themes,
with contrast ratios and overflow measured rather than eyeballed. **Several findings are defects,
not taste.** They're marked ★. Fix those before any decoration; a gradient on a broken layout is
still a broken layout.

Supersedes `docs/handoff/visual-refresh.md` (delete it).

---

## Part 1 — Audit: what's actually wrong

### ★ 1.1 Light mode has no figure/ground (measured)

| Pair | Contrast | Verdict |
|---|---|---|
| `surface` `#ffffff` vs `canvas` `#fafaf9` | **1.04 : 1** | Effectively invisible |
| `border` `#e4e4e7` vs `surface` | 1.27 : 1 | A hairline doing all the work |

The page background, the cards, and the tiles inside the cards are three shades of the same
near-white. Nothing separates a card from the page except a 1px border. In light mode the app
reads as unfinished — **dark mode is carrying the entire product.**

### ★ 1.2 WCAG AA failures (measured)

| Token | On surface | AA (4.5) |
|---|---|---|
| `--subtle` light `#a1a1aa` | **2.56 : 1** | ✗ fails |
| `--subtle` dark `#71717a` | **3.67 : 1** | ✗ fails |
| `--muted` light `#71717a` | 4.83 : 1 | ✓ barely |

`--subtle` fails AA in **both** themes. It's used for secondary text throughout.

### ★ 1.3 Not mobile-fluid (measured)

At a 375px viewport, `document.body.scrollWidth` is **472px** — the app overflows horizontally on a
phone. The objective is mobile-first; today it isn't even mobile-*capable*.

### ★ 1.4 Keyboard navigation is invisible

Exactly **one** `:focus`/`:focus-visible` rule exists in the entire stylesheet. Tab through the app
and you largely cannot see where you are. This is a hard blocker for WCAG AA.

### ★ 1.5 The app is form-first when it should be data-first

The structural reason it feels lifeless:

- **Job CRM** opens with **three empty forms side by side** filling the viewport (Companies, New
  Application, Real Interviews). The funnel and the pipeline — the actual content — are *below the
  fold*. A CRM must open on your pipeline.
- **Prep Tracker** leads with "Log a prep session"; the scorecard is secondary.
- **Outreach Log** is a form plus an empty list, with ~40% dead canvas and **no cadence shown at
  all** — despite 2–3 conversations/week being the entire point of the page.

You open MyHub to see *where you stand*, not to do data entry. No amount of styling fixes this;
only moving things does.

### ★ 1.6 Component-level defects

- **Prep scorecard row visibly breaks.** "ML system design" wraps to two lines and drops its `0`
  below the other four tiles.
- **Progress bars are invisible at 0%** — on a fresh account every checkpoint renders as an empty
  grey track. The one thing that should motivate looks broken.
- **`ProgressBar`'s transition never fires**: it has `transition-[width]` but mounts at its final
  width, so nothing animates, ever.
- **Sentences styled as statistics.** "No judged attempts" / "No timing data" render at value size
  and weight, where a number belongs.
- **Disabled primary buttons read as dead UI** ("Add company", "Add application") — flat grey slabs.

### 1.7 Then, the blandness

Only once the above is fixed: every card is the same weight, nothing is oversized, the accent
appears ~3× per page, spacing is ad-hoc rather than gridded, and the only animation in the whole
app is the unlock toast.

---

## Part 2 — Target design system

**Spacing** — 4px base, 8px rhythm. Tailwind's default scale already is this; the job is to *use it
consistently* (today padding is ad-hoc: `p-4`, `p-5`, `px-3 py-1.5` with no system).

**Type scale** — the app currently lives entirely between 12px and 24px. Add a display step:

| Role | Size |
|---|---|
| Hero (one per page) | 48–60px, tight tracking, `tabular-nums` |
| Page title | 30px |
| Section | 20px |
| Body | 14px |
| Label | 12px, uppercase, wide tracking |

**Colour** — keep the semantic token architecture (it's good). Rebuild the light ramp for real
figure/ground, raise `--subtle` to pass AA, and finally *use* the `accent` and `success` surfaces
that exist and are barely touched.

**Elevation** — two tiers. Page-level panels get a shadow and a lighter surface; tiles inside stay
flat. Dark mode gets a top-highlight border (`border-t-white/5`) so cards stop reading as flat
rectangles.

**Motion** — CSS only, no new dependency. Micro-interactions on hover/press, `fade-up` on grids,
`pulse-glow` on a live streak. Every animation `motion-reduce`-guarded.

---

## Part 3 — Division of work

The split follows the standing rule (`CLAUDE.md`): **Claude owns the system and the contracts;
Codex owns the application of them.** Codex is blocked until Claude's commits land.

### Claude Code

**C1 — Token foundation** (`app/globals.css`) ★
Rebuild the light palette for figure/ground; raise `--subtle` to AA in both themes; add elevation,
display-type, and the `fade-up` / `pulse-glow` keyframes. Add a **global `:focus-visible` ring**
(fixes 1.4 in one rule). Highest-value change in this document.

**C2 — Primitive contracts** (`src/components/ui/`)
- `ProgressBar` — mount at 0 so the transition fires; a visible "not started" treatment so 0%
  doesn't look broken.
- `StatCard` — add `size?: "default" | "hero"`; fix the label-wrap misalignment (fixed label height
  / bottom-aligned values).
- New `Panel` — the standard elevated section container, so every page stops hand-rolling
  `rounded-lg border border-border bg-surface p-5`.
- New `EmptyState` — icon + motivating line + primary action, replacing the grey shrugs.
- New `FormField` — label + control + error, with the `aria-describedby` wiring done once.

**C3 — Responsive shell** (`AppShell`)
Fix the 375px overflow (1.3). The sidebar becomes a drawer below `lg`; the grid goes single-column.
This is shell-level, so it's mine.

### Codex

**X1 — Information architecture flip** ★ *(do first; matters more than styling)*
Every page goes data-first:
- **Job CRM:** pipeline + funnel at the top; the three forms move behind an "Add" button (drawer or
  modal — your call, but they must not own the viewport).
- **Prep Tracker:** scorecard + checkpoint first; logging becomes a compact panel.
- **Outreach Log:** lead with cadence (2–3/week) and recent conversations.

**Stop for review after X1.** It's a bigger change than it looks.

**X2 — Presentational / container split**
Extract the logic-free views (`TaskCard`, `FunnelPanel`, `AchievementCard`, scorecard tiles…) from
the store-connected containers. Containers call the Zustand stores; presentational components take
props only and never import a store. This is the "reusable, modular" objective, and it makes X3
mechanical.

**X3 — Hero pass** — one oversized focal point per page via `StatCard size="hero"`:

| Page | Hero |
|---|---|
| Dashboard | Streak + this week's cadence |
| Prep Tracker | December checkpoint |
| Job CRM | Funnel response rate |
| Task Engine | Open / completed this week |
| Achievements | Current streak |
| Weekly Review | This week's cadence |

**Do the Dashboard alone first, then stop for review** — don't invent the vocabulary six times and
discover it was wrong six times.

**X4 — Micro-interactions, colour, empty states**
Hover/press states on every interactive element; staggered `fade-up` on grids; `pulse-glow` on the
flame **only when `activeToday`** (a dead streak must never look celebratory); `success` surfaces on
anything genuinely good (passed mock, hit target, unlocked achievement, `offer` stage). Rewrite
every empty state to sell the next action, tied to the roadmap:

> **Before:** "No prep sessions logged yet."
> **After:** "Your first rep starts the December count. 75 to go." + the log button, right there.

The Achievements page already does this correctly (locked cards cite their roadmap source rather
than saying "Locked"). Match that tone.

**X5 — Accessibility sweep**
Keyboard-navigate every flow (the Kanban drag especially needs a keyboard path); `aria-live` on the
unlock toaster and error banners; verify AA against the new tokens; check 375px on every page.

---

## Part 4 — Constraints

- **Tailwind + the existing semantic tokens only.** No new dependencies — the approved list has no
  animation library and plain CSS covers all of this. Do not reach for framer-motion.
- **Both themes, every time.** Dark surfaces are deep-tinted, never pale (see `--danger-surface` →
  `#2a0a0a`).
- **`motion-reduce:` on every animation.**
- **Don't break the 43 E2E specs.** They query by role, label, and accessible name. Adding wrappers
  and classes is free; renaming headings, changing `aria-label`s, or removing roles is not. If a spec
  breaks, the DOM changed in a way it shouldn't have — fix the component, not the test.
- Full gate (`lint`, `typecheck`, `test`, `test:ui`) before every commit.

## Sequencing

```
Claude  C1 (tokens + focus ring)  →  C2 (primitives)  →  C3 (responsive shell)
                                          ↓
Codex                              X1 (IA flip) ──review──▶ X2 (component split)
                                          ↓
                            X3 Dashboard ──review──▶ X3 rest  →  X4  →  X5
```
