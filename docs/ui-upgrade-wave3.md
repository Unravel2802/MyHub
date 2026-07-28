# MyHub — UI Upgrade Wave 3: "Make the system hold"

Goal: stop the design system from decaying as modules are added, and fix what a **quiet account**
looks like — because that's what MyHub looks like most mornings.

This plan is written from a real inspection: nine routes captured at 1440×900 in dark mode, the
Dashboard in light mode, and Trading at 390px, using the project's own Playwright auth fixture
(`tests/ui/fixtures.ts`, all REST calls stubbed to `[]`). Findings marked ★ are **defects, not
taste**.

Prior passes, both shipped:

- `docs/visual-refresh.md` — the "Premium Developer Tool" pass. Tokens, zinc + indigo, AA contrast,
  the global focus ring, the primitive set (`Panel`, `StatCard`, `EmptyState`, `FormField`,
  `ProgressBar`), the information-architecture flip, and the hero pass.
- `docs/color-refresh.md` — the hue kit. 8 module hues × 3 roles × 2 themes, `moduleHues.ts`,
  header washes, dark-mode glows, the activity heatmap, and `palette.test.ts` as an automated AA gate.

**Both plans were good and both were correctly executed. This plan exists because neither of them
survived contact with the modules built after they shipped.**

---

## Part 1 — Audit: what's actually wrong

### ★ 1.1 The design system stopped being applied to new modules

Measured by grepping for the hue kit (`hue-*`, `wash`, `glow`) across every module component:

| Module                       | Components | Files using the hue kit | Built                   |
| ---------------------------- | ---------- | ----------------------- | ----------------------- |
| Design Drills                | 10         | **0**                   | after the color refresh |
| LeetCode Tracker             | 7          | **0**                   | after the color refresh |
| Trading                      | 8          | 2 (page chrome only)    | after the color refresh |
| Finance                      | 8          | 4                       | with the color refresh  |
| Job CRM / Momentum / Roadmap | —          | applied                 | with the color refresh  |

The two largest modules in the app — Design Drills (10 components) and LeetCode (7) — have **zero**
module-hue usage. Trading has it only on its page header. The color refresh's core promise, "the app
becomes a set of rooms instead of one long grey corridor," is now true for the nine pages that
existed in July and false for everything built since.

**This is the headline finding.** The other defects below are symptoms of the same cause: the rules
live in prose in two markdown files, and nothing in the build enforces them.

### ★ 1.2 Trading reintroduced the form-first defect the last plan fixed

`docs/visual-refresh.md` §1.5 called this out as the structural reason the app felt lifeless, and X1
fixed it for Job CRM, Prep, and Outreach. Trading, built afterwards, does exactly the thing that was
banned:

- **10 identical stat tiles** in a 5×2 grid (~250px), of which **8 render `—`**.
- Then **"Log an entry"** — a 9-field form, ~570px tall.
- The equity curve, positions, and journal — the actual content — start at ~1150px, **below the fold
  at 1440×900**.

At 390px it is worse: you scroll past ~430px of tiles and ~600px of form before the first piece of
data. You open a trading journal to see how you're trading, not to fill in a form.

### ★ 1.3 No hero on the pages built after the hero pass

`visual-refresh.md` X3 specified exactly one oversized focal point per page via `StatCard size="hero"`.

| Page                    | Hero | Reality                                |
| ----------------------- | ---- | -------------------------------------- |
| Dashboard               | ✓    | present                                |
| Trading                 | ✗    | 10 equal-weight tiles                  |
| Task Engine             | ✗    | 3 equal-weight tiles (`0` / `0` / `0`) |
| LeetCode, Design Drills | ✗    | none                                   |

`size="hero"` exists, is tested, and is used on exactly the pages that existed when it was written.

### ★ 1.4 The front door headlines absence

The Dashboard's hero renders, at display size, in the largest type in the application:

> **0 days · 0 applications · 0 outreach**

Both prior plans established "**never tint absence**" and enforced it well — nothing here is
_tinted_. But nobody wrote the rule that matters more: **don't headline absence.** The single
biggest element on the app's landing page is a statement of three things you have not done. Trading
compounds it — 8 of 10 tiles are `—`, Month-to-date shows `—` and `—`.

A personal productivity app is _mostly_ looked at on quiet days. The quiet state is the common case
and it is currently the unhandled one.

### ★ 1.5 Empty containers are enormous

| Container              | Empty height                          | Content                                    |
| ---------------------- | ------------------------------------- | ------------------------------------------ |
| Kanban column × 4      | ~400px each (**~1600px total**)       | one icon + two lines                       |
| "Weekly tasks" panel   | ~290px                                | one empty state                            |
| Hub landing page       | content ends at ~480px of 900         | **~47% dead canvas**                       |
| Activity heatmap panel | ~75px of grid in a ~1100px-wide panel | a stub grid, hard right-aligned dead space |

"Empty pipeline columns are large dead boxes" was already logged as an X1 follow-up in
`visual-refresh.md` (line 231), routed into X4, and never fixed. The Task board has the same defect
in four columns.

### ★ 1.6 One action, three treatments

`Refresh` renders as:

- a **full-width bar** across the header (Dashboard),
- an **icon-only button** (Trading),
- a **text button** inside a mixed toolbar (Tasks).

On Dashboard it occupies prime hero real estate for a control nobody needs to see first.

### 1.7 The hub's workspace concept isn't reflected in the nav

`/` presents MyHub as **Mini-apps** (Career, Money) + **Core tools**. The sidebar ignores this and
lists 12 destinations flat with `CAREER` / `MONEY` group headers. Two competing mental models: the
hub says "pick a workspace," the rail says "everything is always here." The rail is also at capacity
— 12 items + 2 headers + streak + theme toggle + sign-out reach the bottom edge at 900px.

### 1.8 Light mode: fixed, and confirmed fixed

The 1.04:1 figure/ground failure from `visual-refresh.md` §1.1 is genuinely gone — canvas is grey,
cards are white, the header wash reads. **No regression, no action needed.** Recorded so the next
pass doesn't re-audit it.

---

## Part 2 — What we're building

Not a new look. The look is right — the "Premium Developer Tool" register with module hues is
working where it's applied. Wave 3 is **structural**: make the rules impossible to skip, and answer
the quiet-account question.

### 2.1 `PageTemplate` — make the rules structural, not remembered

Every defect in §1.2, §1.3, and §1.6 is a page that forgot a rule. Pages should not be able to.

```ts
type PageTemplateProps = {
  /** Route key — drives the module hue, wash, and overline. No per-page hue wiring. */
  module: ModuleKey;
  title: string;
  description?: string;
  /** Exactly one. Not optional — a page with no focal point is the bug. */
  hero: ReactNode;
  /** Secondary metrics. Capped at 4 — see §2.3. */
  stats?: ReactNode;
  /** Refresh / create / filter. One slot, one placement, one treatment. */
  actions?: ReactNode;
  /** Data first. Always rendered above `compose`. */
  children: ReactNode;
  /** Forms and entry UI. Structurally forced below the data. */
  compose?: ReactNode;
};
```

The `compose` slot is the load-bearing idea: **the form-first defect becomes unexpressible.** A page
cannot put its entry form above its data, because the template controls the order.

`hero` being required, not optional, is deliberate for the same reason.

### 2.2 The quiet-state contract

`StatCard` currently takes a value and each caller hand-rolls its own `—` plus a sentence. Three
distinct states are being collapsed into one:

| State     | Meaning                                                 | Treatment                                                  |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| `value`   | measured, non-zero                                      | full weight, hue, gradient hero numbers                    |
| `zero`    | **measured** zero — 0 trades closed                     | full weight, neutral, no hue                               |
| `pending` | **not yet measurable** — win rate with no closed trades | subdued, `—` at _label_ weight not value weight, hint line |

`visual-refresh.md` §1.6 already flagged "sentences styled as statistics" — `pending` is the fix,
and it makes the distinction a type rather than a convention.

**And the rule this pass adds:**

> ★ **Never headline absence.** A `hero` must not render a bare zero or `—`. When the underlying
> metric is zero or pending, the hero renders the **next action** instead.

Applied to the Dashboard: `0 days · 0 applications · 0 outreach` becomes a hero that states what to
do next — the three counters demote into the "Weekly cadence" panel that already displays them
properly, with targets and "to go" counts. Nothing is lost; the same numbers stop being the headline.

### 2.3 Density

The app is spacious when empty and will be dense when full — backwards for a dashboard.

- **Empty containers cap at `min-h-[120px]`.** A Kanban column with nothing in it is a slot, not a
  room. Saves ~1100px on the Task board alone.
- **Secondary stat grids cap at 4 tiles.** Trading's 10 become 1 hero + 4 secondary; the remaining
  five move into the equity/positions panels where they have context. Ten equal tiles is not a
  scoreboard, it's a wall.
- **Panels size to content**, with the spacing scale (`--space-*`) tightened to the 8–32px dashboard
  ramp rather than the current 16–64px.

### 2.4 Navigation

Resolve §1.7 in favour of the rail, which is what actually gets used: keep all destinations
reachable, but make the rail **workspace-aware** — the current workspace's group expanded, the others
collapsed to their header. The hub stays as the landing page.

---

## Part 3 — The gates (this is what makes Wave 3 different)

Both prior plans stated their rules in prose. Both rules were then broken by the next module.
`palette.test.ts` is the counter-example: it was automated, and **colour contrast has not regressed
since**. That's the model.

`CLAUDE.md` §4 is explicit that automated checks are the real merge gate, not a formality. Three new
gates:

| Gate                       | Guards                                                                                                                                           | Type       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `no-raw-color.test.ts`     | "Only `globals.css` names a colour" — scans `src/**/*.tsx` for raw Tailwind palette utilities (`bg-zinc-*`, `text-indigo-*`, …) and hex literals | Vitest     |
| `page-contract.spec.ts`    | Every route renders **exactly one** hero, and no `<form>` precedes the first data panel                                                          | Playwright |
| `palette.test.ts` (extend) | Add the hue-kit tokens used by modules built after the colour refresh                                                                            | Vitest     |

The "only globals.css names a colour" rule has been written in prose **three times across two
documents** and violated each time. It stops being prose here.

---

## Part 4 — Work split (≈35% Claude / 65% Codex)

Per `CLAUDE.md`: Claude owns contracts, correctness-critical logic, and the automated gates that
protect them. Codex owns application across modules. Claude reviews rather than types.

### Claude — contracts + gates (~35%)

- **C1 — `PageTemplate` contract.** The component above, with the slot ordering that makes
  form-first unexpressible, plus unit tests for the ordering guarantee. Module hue resolution wired
  once, from the route.
- **C2 — quiet-state contract.** `StatCard`'s `value | zero | pending` API (§2.2), the "hero never
  headlines absence" invariant, and tests for each state in both themes.
- **C3 — density tokens.** The `--space-*` ramp retune and the empty-container `min-h` policy as
  tokens, so Codex applies a token rather than picking a number 15 times.
- **C4 — the three gates** (Part 3). The durable deliverable — these outlive the pass.
- **C5 — review.** Browser review in dark mode at every Codex gate. No application code from Claude.

### Codex — application (~65%)

- **X1 — adopt `PageTemplate` on all 15 routes.** Mechanical against a published contract.
  **Stop for review after the first two pages** — if the template's ergonomics are wrong, they're
  wrong 15 times.
- **X2 — Trading IA flip (§1.2).** Data first: equity curve, positions, journal. "Log an entry"
  moves into the `compose` slot, collapsed by default. 10 tiles → 1 hero + 4 secondary. This is the
  single highest-impact page fix in the plan.
- **X3 — hero pass** on Task Engine, LeetCode, Design Drills, Finance, Notes, and the remaining
  routes lacking one (§1.3).
- **X4 — empty-container sweep (§1.5).** Kanban columns, weekly-tasks panel, hub dead canvas,
  heatmap panel width.
- **X5 — hue application** to Design Drills, LeetCode, and Trading's components (§1.1) — the module
  hue on headers, badges, chart strokes, and active states. Define any data→hue maps as small TS
  constants next to their module, mirroring `moduleHues.ts`.
- **X6 — unify the refresh affordance** (§1.6) into the template's `actions` slot; remove the
  full-width Dashboard bar.
- **X7 — quiet-state copy pass.** Apply `pending` vs `zero` across every stat surface; rewrite the
  Dashboard hero per §2.2.

### Sequencing

```
Claude  C1 ──▶ C2 ──▶ C3 ──▶ C4 (gates land before X-work merges)
                                    │
Codex                               └──▶ X1 ──review──▶ X2 ──▶ X3 ──▶ X4 ──▶ X5 ──▶ X6 ──▶ X7
                                             ▲              ▲       ▲
                                             └── Claude reviews in the browser, dark mode ──┘
```

C4 before X1 is deliberate: the gates should be red _before_ Codex starts, so the work turns them
green rather than being audited afterwards.

---

## Part 5 — Guard-rails

1. **Never headline absence.** New this pass, and the one most likely to be forgotten (§2.2).
2. **Never tint absence.** Carried forward — no hue on zeros, em-dashes, or empty days.
3. **Only `globals.css` names a colour.** Now enforced by `no-raw-color.test.ts`.
4. **No new dependencies.** Tailwind + the existing tokens. The approved list has no animation
   library; do not reach for framer-motion.
5. **Both themes, every time.** Dark surfaces deep-tinted, never pale.
6. **`motion-reduce:` on every animation.**
7. **Don't break the E2E suite.** Specs query by role, label, and accessible name. Adding wrappers
   and classes is free; renaming headings or removing roles is not. `PageTemplate` adoption is the
   risk point — it moves DOM structure on all 15 routes. If a spec breaks, check the component first.
8. Full gate (`lint`, `typecheck`, `test`, `test:ui`) before every commit.

---

## Appendix — on the `ui-ux-pro-max` skill

Installed at `.claude/skills/ui-ux-pro-max/` during this session. Assessment after using it:

**Its `--design-system` generator misroutes MyHub.** Queried with MyHub's actual description, it
returned a _"Real-Time / Operations Landing"_ pattern with hero-plus-CTA sections and a
`SaaS Mobile (High-Tech Boutique)` style. MyHub is a single-user, logged-in, dense internal tool —
it has no landing page and no conversion funnel. The generator's 192 product types are oriented
toward marketing sites, and its colour/typography output would replace a token system that is
already measured, AA-verified, and CI-gated. **Do not run `--design-system --persist` against this
repo** — it writes a `design-system/MASTER.md` that would compete with `globals.css` for authority.

**What it is genuinely useful for**, and where Codex should reach for it:

- `--domain ux` — the 98 UX guidelines, as a checklist against a built page.
- `--domain chart` — grounding the equity curve and heatmap (X2, X4).
- `--stack nextjs` / `--stack shadcn` — implementation notes matching the actual stack.
- Its **pre-delivery checklist** — a reasonable final sweep, and it agrees with our existing rules
  (SVG icons not emoji, 150–300ms transitions, visible focus, `prefers-reduced-motion`, 4.5:1).

Treat it as a reference library, not as an authority over `globals.css`.
