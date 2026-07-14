# Handoff — Visual refresh (Claude Code ↔ Codex)

Not a feature. No migration, no schema, no store changes. This is a pass over what MyHub
*looks* like, because it currently looks like a wireframe that shipped.

## The diagnosis

I drove all six pages in a browser (first time anyone had — everything before this was verified
by tests, never seen). The blandness isn't vague, it's specific:

- **Everything is the same card at the same weight.** Zinc surface, 1px border, identical padding
  and radius, repeated down every page. No hierarchy — the eye has nowhere to land.
- **Nothing is big.** The whole app lives between 12px and 24px. There is no focal point on any
  screen.
- **The accent barely appears.** ~3 teal elements per page against a sea of neutral zinc.
- **Nothing moves.** The unlock toast is the only animation in the app. Even `ProgressBar`, which
  has a transition, mounts at its final width so the transition never fires.
- **Empty states are dead air.** "No prep sessions logged yet." in grey is a shrug, on the one
  feature whose job is motivation.

## Hard constraints (both of us)

- **Tailwind + the existing semantic tokens only.** No new dependencies — the approved list has no
  animation library, and plain CSS covers everything below. Don't reach for framer-motion.
- **Both themes.** Every value needs a `.dark` counterpart. Dark surfaces are deep-tinted, never
  pale (a light pill glows against the near-black canvas — see how `--danger-surface` goes to
  `#2a0a0a`).
- **`motion-reduce:` on every animation.** Non-negotiable.
- **Do not break the 43 E2E specs.** They query by role, label and accessible name. You may add
  wrapping elements and classes freely; do not rename headings, change `aria-label`s, or remove
  roles. If a spec breaks, the DOM changed in a way it shouldn't have — fix the component, not
  the test.

---

## Claude owns — the design system (must land first)

Codex is blocked on this. It's one commit, all in `app/globals.css` plus the three shared
primitives in `src/components/ui/`.

### 1. Elevation + surface tokens

Two-tier depth. Page-level panels get elevation; tiles inside them stay flat. Add
`--surface-raised`, `--shadow-panel`, `--shadow-card-hover`, and a top-highlight border token for
dark mode (`border-t-white/5` — the "lit from above" trick that stops dark cards reading as flat
rectangles).

### 2. Type scale

The app has no display size. Add `--text-hero` (48–60px, tight tracking, `tabular-nums`) and a
small-caps label treatment. Size contrast is the cheapest drama available and we're not using any
of it.

### 3. Keyframes

In `globals.css`, alongside the existing `momentum-toast-in`:

- `fade-up` — for staggered grid entrances (Codex sets `animation-delay` per index).
- `pulse-glow` — a slow, low-alpha accent glow, for the streak flame when `activeToday`.
- `count-up` isn't worth a JS counter; a `transition-colors` flash on change is enough.

### 4. Primitive upgrades

- **`ProgressBar`** — mount at 0 and set the real width in an effect, so the transition it already
  has actually fires. Today it mounts at its final value and animates nothing.
- **`StatCard`** — add a `size?: "default" | "hero"` prop. `hero` renders the value at display
  size. This is what gives every page its focal point.
- **`Badge`** — no change needed; it was fixed already (accent/success now have real surfaces).

---

## Codex owns — page-by-page application

**Start only once the tokens above are on `main`.** Do the Dashboard FIRST as the reference
implementation, get it reviewed, then apply the same language to the rest — don't do all six in
one pass and discover the vocabulary was wrong six times over.

### Per page, the hero number

Every page gets exactly one oversized focal point (`StatCard size="hero"`):

| Page | Hero |
|---|---|
| Dashboard | The streak flame + this week's cadence, as a banner |
| Prep Tracker | December checkpoint progress |
| Job CRM | The funnel's response rate |
| Task Engine | Open tasks / completed this week |
| Achievements | Current streak (already accent-tinted; make it hero-sized) |
| Weekly Review | This week's cadence |

### Colour

Use the accent/success surfaces that already exist and are barely touched. Anywhere state is
*good* — a passed mock, a hit cadence target, an unlocked achievement, an offer stage — should
carry `success`. Section headers get a subtle gradient tint (accent → transparent). The streak
flame gets `pulse-glow` when `activeToday`, and nothing when it isn't (a dead streak must not
look celebratory).

### Motion

Staggered `fade-up` on card grids (`animation-delay: calc(var(--i) * 40ms)`). Cards lift on hover
and while dragging (shadow + `-translate-y-px`). Progress bars sweep in on mount. All
`motion-reduce`-guarded.

### Empty states

Rewrite every one to sell the next action instead of reporting absence. Tie the copy to the
roadmap, which is the whole point of this app:

> **Before:** "No prep sessions logged yet."
> **After:** "Your first rep starts the December count. 75 to go." + the log button, right there.

The achievements page already does the good version of this (locked cards now cite their roadmap
source rather than saying "Locked") — match that tone.

---

## Sequencing

1. **Claude:** tokens + primitives (one commit).
2. **Codex:** Dashboard as reference implementation. Stop. Get it reviewed.
3. **Codex:** the other five pages, then empty states.

Full gate (`lint`, `typecheck`, `test`, `test:ui`) before each commit. 43 E2E specs must stay
green throughout — if one breaks, the DOM changed in a way it shouldn't have.
