# Color refresh — plan

The "Premium Developer Tool" pass (docs/visual-refresh.md) was *deliberately* monochromatic: zinc
shell, one indigo accent, and a green/red pair that barely appears. It fixed the broken parts —
light-mode figure/ground, AA contrast, the focus ring — but the result is austere. Evidence from
driving every page this session: the achievements page is a wall of identical grey cards, the CRM
funnel is eight identical zinc tiles, the radar is a grey wireframe, and the only per-module color
in the entire app is four small dots on the Kanban column headers.

**Locked decisions:** Confident intensity (zinc shell stays; every page gets a visible identity)
with **per-module identity hues**. Dark mode is the priority — it's what's used daily — but light
mode must not regress and stays AA.

---

## Philosophy: color must mean something

Three channels, and *only* these three. A color that encodes nothing is noise and gets cut.

1. **Place** — which module am I in? Each module owns a hue; nav, header, and the page's ambient
   wash carry it. The app becomes a set of rooms instead of one long grey corridor.
2. **Data** — what is this thing, and what state is it in? Funnel stages ramp, prep types get
   badges, achievement categories separate, activity intensity maps to a green ramp.
3. **Light (dark mode's special power)** — glows and gradients that only work against near-black:
   gradient hero numbers, a halo on the lit flame, a soft wash bleeding from each page header.

What stays monochrome, deliberately: card surfaces, borders, body text, forms. The shell is the
premium feel; color sits *on* it, never replaces it.

---

## Part 1 — The hue kit (tokens)

The standing rule holds: **only `globals.css` names a color.** Components speak semantic names.
Rather than 9 modules × 3 variants × 2 themes of bespoke tokens, define a shared kit of eight
named hues, each with three roles, in both themes:

| Role | Dark example (cyan) | Light example | Use |
|---|---|---|---|
| `--hue-cyan` | `cyan-400` `#22d3ee` | `cyan-700` `#0e7490` | text, icons, strokes — **must clear 4.5:1 on `--surface`** |
| `--hue-cyan-surface` | deep tint `#083344` | `cyan-50` `#ecfeff` | fills, badges, tinted cards |
| `--hue-cyan-border` | `cyan-900` | `cyan-200` | borders on tinted elements |

Hues: **amber, orange, rose, violet, blue, cyan, teal, emerald.** (Indigo already exists as
`--accent`.) Dark surfaces are deep-tinted, never pale — same rule as `--danger-surface` →
`#2a0a0a`, or a pill glows against the near-black canvas.

### Module → hue map

A TS constant, not CSS — the mapping is app knowledge, and one import gives every consumer the
same answer (`src/components/moduleHues.ts`, keyed by nav href):

| Module | Hue | Why |
|---|---|---|
| Dashboard | indigo (brand accent) | The hub keeps the brand color |
| Roadmap | violet | Sibling of indigo — the "meta" pages share a family |
| Task Engine | amber | The board's Todo dot is already amber |
| Prep Tracker | cyan | Cool/technical |
| Job CRM | blue | The pipeline |
| Outreach Log | rose | Human contact |
| Achievements | orange | The flame 🔥 — the one obvious choice |
| Weekly Review | teal | Calm, reflective |
| Offer Evaluator | emerald | Money and go-signals |

### The contrast gate becomes a test

Every `--hue-*` text token must clear **4.5:1 on `--surface` and `--surface-subtle`, both themes,
measured**. This has been hand-verified twice this project; the third time is automated:
`src/lib/palette.test.ts` reads `app/globals.css`, extracts the `:root` and `.dark` blocks, and
fails the unit suite if any text-role token drops below AA. Palette drift becomes a red test, not
a discovery.

---

## Part 2 — Where the color goes

### 2.1 Place (module identity)

- **Nav**: each item gets a small hue dot; the active item's background tint uses its module hue
  instead of always-indigo.
- **Page header**: the overline ("INTERVIEW PREPARATION") takes the module hue; behind the header,
  a **radial wash** — the module hue at ~7% alpha fading to transparent over ~400px. This is the
  Linear trick: the page feels colored while every component on it stays zinc. One utility,
  hue via a CSS variable set inline from the module map.
- **Hero StatCard** per page: its tint uses the module hue rather than generic accent.

### 2.2 Data

- **CRM funnel + pipeline**: stages ramp cool→warm toward the offer:
  `researching` zinc → `applied` blue → `oa` cyan → `phone_screen` teal → `onsite` violet →
  `offer` emerald → `rejected` red → `withdrawn` dim zinc. Funnel tiles get the hue as a top
  border + count color; pipeline column headers get matching dots.
- **Prep entry types**: badge hue per type — algorithm cyan, system_design blue, ml_system_design
  violet, behavioral rose, mock_interview amber, resume_deep_dive emerald. Same hues reused in the
  scorecard tiles' top borders and the time-allocation bars, so a type is one color everywhere.
- **Achievement categories**: prep cyan, career blue, consistency orange. Category headings and
  card left-borders; **unlocked cards get a soft glow in their category hue** (dark only).
- **Radar**: claimed polygon fills with an indigo→violet gradient (`<linearGradient>` in the SVG).
  The measured dashed line becomes **state-aware**: red only where it contradicts a claim, muted
  zinc when it merely agrees — today it's always red, which cries wolf.
- **Timeline**: the filled track becomes an indigo→violet gradient; "you are here" keeps its glow;
  `missed` stays exactly the red it is. **Done stays accent, not green** — eleven stations flipping
  red/green reads as a Christmas garland.

### 2.3 New: the activity heatmap

The one genuinely new element — the classic "color as data" component, and it was already promised
in the roadmap visualization spec ("density strip") but never built. A GitHub-style contribution
grid: one cell per day since July 2026, emerald ramp by activity count (prep entries + completions
+ applications + outreach that day — `activityDates` already computes the union; this needs the
per-day *count* variant). Lives on the Roadmap page under the timeline; the streak finally has a
place to *see itself*.

- Empty cells are `--surface-subtle`, **not** green-0 — an empty day is absence, and absence is
  never tinted (three strikes already: streak card, offer rate, radar evidence).
- Date math is the four-time-offender zone: local wall-clock days via `format()`, never
  `.toISOString().slice()`. The grid's week columns are Monday-start, same as everything else.

### 2.4 Light (dark-mode effects)

- **Gradient hero numbers**: the countdown, the streak count, hero StatCard values —
  `linear-gradient` text (module hue → its violet-shifted neighbor), `bg-clip-text`. Light mode:
  solid hue (gradient text on white looks washed).
- **Glows** (dark only, all `motion-reduce`-safe since they're static shadows):
  lit flame — warm orange halo; "you are here" station — indigo; unlocked achievement cards —
  category hue at low alpha. Utility: `glow` + `--glow-color` variable.
- **Progress bars**: fills become two-stop gradients (hue → hue-lighter). The 0% "not started"
  seed stays exactly as-is.

---

## Part 3 — Guard-rails (each of these has already bitten once or more)

1. **Never tint absence.** No hue on zeros, em-dashes, empty days, or "no data yet" lines. Three
   components have made this mistake; the count stops here.
2. **Only `globals.css` names a color.** A raw `text-cyan-400` in a component is a bug — invisible
   or garish in the other theme. Components use `--hue-*` tokens via the module map.
3. **AA is measured, not eyeballed** — and now enforced by `palette.test.ts`.
4. **Dark surfaces are deep-tinted, never pale.**
5. **Meaning before decoration.** Every application of color in Part 2 answers "what does this
   encode?" If a PR adds a color that encodes nothing, it gets cut.
6. **The E2E suite (63) stays green.** Color changes are class-level; roles, names and labels
   don't move.

---

## Part 4 — Work split

Standing rule: Claude owns the system and anything logic-adjacent; Codex applies it per page.

### Claude

- **K1 — the hue kit** (`app/globals.css`): 8 hues × 3 roles × 2 themes, the `wash` and `glow`
  utilities, gradient-text utility. Plus `src/components/moduleHues.ts` (the map) and
  `src/lib/palette.test.ts` (the automated AA gate). *Everything else is blocked on this.*
- **K2 — the activity heatmap**: per-day count variant of `activityDates` (pure, tested — the
  date-grid math is the recurring timezone trap), plus the `ActivityHeatmap` component and its
  placement on the Roadmap page.
- **K3 — radar + timeline recolor**: the state-aware dashed line is logic-adjacent (it must only
  be red where `measured < claimed`), and the SVG gradients live next to it.

### Codex

- **X1 — place**: nav dots + module-hued active states; header washes + hued overlines on all nine
  pages; hero StatCards take their module hue. **Stop for review after the first two pages** —
  the wash is the single most visible change in this plan, and if the alpha is wrong it'll be
  wrong everywhere.
- **X2 — data**: funnel/pipeline stage ramp, prep type badges (badge + scorecard borders +
  allocation bars, same hue per type), achievement category hues + unlock glows.
- **X3 — light**: gradient hero numbers, the glow applications, gradient progress fills.

### Sequencing

```
Claude  K1 (kit + AA test) ──▶ K2 (heatmap) ──▶ K3 (radar/timeline)
                 │
Codex            └──▶ X1 (place) ──review──▶ X2 (data) ──▶ X3 (light)
```

Full gate before every commit. Dark mode reviewed in the browser at each gate — that's the mode
that matters here, and screenshots-by-code has missed things all session that looking caught.
