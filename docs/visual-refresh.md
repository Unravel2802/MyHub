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

## Part 2 — Visual system specification

**Design philosophy: "Premium Developer Tool"** — the Linear / Vercel register. Crisp, dense,
high-contrast, quiet. Nothing decorative; everything earns its place. The feeling to chase is
*precision*, not personality.

### 2.0 One architectural decision, made up front ★ read this

The spec below is written in raw Tailwind (`bg-zinc-900`, `border-zinc-800`). MyHub already has a
**semantic token layer** — `bg-surface`, `border-border`, `text-muted` — that resolves to CSS
variables and is what makes the light/dark switch a single block of overrides rather than a `dark:`
variant on every utility in the codebase.

**We keep the token layer and re-point its values at the palette below.** So a card is still
`bg-surface border-border`; `--surface` simply *becomes* `zinc-900` in dark and its light-mode
counterpart in light. This is not a deviation from the brief — it delivers exactly the specified
look, and it's the only way to get it in **both themes** without hardcoding `dark:bg-zinc-900` on
every element in the app.

**Rule: components use semantic names. Only `globals.css` names a zinc.** A raw `bg-zinc-900` in a
component is a bug — it will be invisible in light mode.

### 2.1 Colour

**Base — monochromatic, high contrast.** Dark mode uses deep greys, never pure black.

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `zinc-950` `#09090b` | `zinc-100` `#f4f4f5` |
| `--surface` | `zinc-900` `#18181b` | `#ffffff` |
| `--surface-subtle` | `zinc-800` `#27272a` | `zinc-50` `#fafafa` |
| `--border` | `zinc-800` `#27272a` | `zinc-200` `#e4e4e7` |

Note the light column: canvas steps **down** to `zinc-100` while surface stays white. That's what
fixes the 1.04:1 figure/ground failure in §1.1 — cards finally sit *on* something.

**Accent — a single vibrant colour.** Moving from the current teal to **Indigo/Violet**.

| Token | Dark | Light |
|---|---|---|
| `--accent` | `indigo-500` `#6366f1` | `indigo-600` `#4f46e5` |
| `--accent-strong` | `indigo-400` `#818cf8` | `indigo-700` `#4338ca` |
| `--accent-surface` | `#1e1b4b` (deep, never pale) | `indigo-50` `#eef2ff` |
| `--accent-border` | `indigo-900` | `indigo-200` |

Used for: primary actions, active nav, focus rings, **and the streak flame**.

**Text — hierarchy by contrast.**

| Token | Dark | Light | Role |
|---|---|---|---|
| `--foreground` | `zinc-50` | `zinc-950` | Primary |
| `--body` | `zinc-300` | `zinc-700` | Paragraph |
| `--muted` | `zinc-400` | `zinc-500` | Secondary |
| `--subtle` | `zinc-400` | `zinc-500` | **Raised to pass AA — see §1.2** |

`--subtle` currently fails WCAG AA in both themes (2.56:1 / 3.67:1). It does not get to stay
decorative; every value above must clear **4.5:1** on its own surface, verified, not assumed.

### 2.2 Typography

Font stack is already Geist — modern, keep it.

| Role | Spec |
|---|---|
| Hero (one per page) | `text-5xl`/`text-6xl`, `tracking-tight`, `tabular-nums` |
| Page title | `text-3xl`, `tracking-tight` |
| Section | `text-xl`, `tracking-tight` |
| Body | `text-sm`, `leading-relaxed` |
| **Overline / section header** | `text-xs uppercase tracking-widest text-muted` |

`tracking-tight` on every heading; `leading-relaxed` on every paragraph. The uppercase, wide-tracked
overline is the workhorse for breaking up dense data panels — use it hard.

### 2.3 Depth — "glass and border", not drop shadows

**Panels and cards: no heavy shadows.** Separation comes from a subtle border plus a slight
background step (`bg-surface` on `bg-canvas`). That's the entire trick, and it's why §2.1's light
ramp had to be fixed first — without background contrast, borders are doing 100% of the work and
the result looks like a wireframe.

**Floating elements only** (Unlock Toaster, dropdowns, drag overlay):

```
backdrop-blur-md  +  border border-border  +  shadow-xl shadow-black/50
```

### 2.4 Micro-interactions

- **Every** interactive element: `transition-all duration-200 ease-in-out`.
- Hover: a background shift (`hover:bg-surface-subtle`) or a gentle lift on cards
  (`hover:scale-[1.02]`) — StatCards and achievement trophies especially.
- **Focus (accessibility-critical, see §1.4):**
  `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
  focus-visible:ring-offset-canvas`
  The app currently has **one** focus rule in the entire stylesheet. This is a global fix.
- All motion `motion-reduce:`-guarded. `scale` and `transition-all` both get suppressed.

---

## Part 3 — Division of work

The split follows the standing rule (`CLAUDE.md`): **Claude owns the system and the contracts;
Codex owns the application of them.** Codex is blocked until Claude's commits land.

### Claude Code

**C1 — Token foundation** (`app/globals.css`) ★ *the whole spec lives or dies here*
Re-point every token at §2.1: zinc base, the fixed light ramp (canvas steps down to `zinc-100` so
cards finally sit *on* something), **teal → indigo/violet accent**, and `--subtle` raised until it
clears 4.5:1 in both themes — measured, not eyeballed. Add the display type step, the
`fade-up` / `pulse-glow` keyframes, and the **global `focus-visible` ring** (§2.4 — one rule, fixes
§1.4 across the entire app).

Because components already speak in semantic names, this single file changes the app's entire
appearance without touching a component. That's the payoff of §2.0.

**C2 — Primitive contracts** (`src/components/ui/`)
- `ProgressBar` — mount at 0 so the transition actually fires; a visible "not started" treatment so
  0% stops looking broken.
- `StatCard` — add `size?: "default" | "hero"`; hover lift (`hover:scale-[1.02]`, motion-reduce
  guarded); fix the label-wrap misalignment (§1.6).
- New `Panel` — the standard border-and-surface container, so pages stop hand-rolling
  `rounded-lg border border-border bg-surface p-5`.
- New `EmptyState` — icon + motivating line + primary action, replacing the grey shrugs.
- New `FormField` — label + control + error, with `aria-describedby` wired once.
- `UnlockToaster` gets the **glass treatment** (§2.3): `backdrop-blur-md` + border +
  `shadow-xl shadow-black/50`. It's the one genuinely floating element in the app.

**C3 — Responsive shell** (`AppShell`)
Fix the 375px overflow (§1.3): sidebar becomes a drawer below `lg`, grid goes single-column.
Shell-level, so it's mine.

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
`transition-all duration-200 ease-in-out` on **every** interactive element (§2.4); hover shifts and
card lifts; the `text-xs uppercase tracking-widest` overline used hard to break up dense panels
(§2.2); staggered `fade-up` on grids; `pulse-glow` on the flame **only when `activeToday`** — a dead
streak must never look celebratory; `success` surfaces on anything genuinely good (passed mock, hit
target, unlocked achievement, `offer` stage).

**Two traps already hit once each — don't repeat them.** Do not tint a card that shows a *zero* or a
`—`: the "Current streak: 0 days" card was accent-tinted, drawing the eye to nothing, and the Job CRM
"Offer rate" card still does it today while displaying `—`. Highlight state, not absence.

Also: `capitalize` on the raw stage enum renders `oa` as **"Oa"** in the funnel. Map the labels.

Rewrite every empty state to sell the next action, tied to the roadmap:

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
- ★ **No raw zinc/indigo in components.** `bg-zinc-900` in a component is a bug: it will be
  *invisible in light mode*. Only `globals.css` names a colour; components say `bg-surface`,
  `text-muted`, `ring-accent`. If a semantic token you need doesn't exist, **flag it — don't hardcode
  around it.** (See §2.0. This is the rule the entire two-theme system rests on.)
- **Both themes, every time.** Dark surfaces are deep-tinted, never pale (see `--danger-surface` →
  `#2a0a0a`, and `--accent-surface` → `#1e1b4b`).
- **Contrast is measured, not eyeballed.** Every text token clears 4.5:1 on its own surface. `--subtle`
  fails today in both themes; it does not get to stay decorative.
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
