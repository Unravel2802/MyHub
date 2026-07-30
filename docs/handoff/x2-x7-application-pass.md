# X2–X7 — the application pass (Codex)

## What this is

`docs/ui-upgrade-wave3.md` is the plan. All of Claude's contract work is done — C1 (`PageTemplate`),
C2 (`StatCard` quiet state), C3 (density tokens), C4 (the three gates) are merged to `main`, and X1
(all 13 routes on `PageTemplate`) is complete. This is the rest of the wave: six application tasks,
all Codex's, applying those contracts to the actual pages.

**Branch:** `ui-wave3-page-template`. Pull before you start.

**Baseline gate**, full and green right now: `npm run lint`, `npm run typecheck`, `npm test`
(**1081 unit**), `npm run test:ui` (**124 E2E**). Do not merge below that. Full gate before every
commit, one commit per task (X2 may be two commits if the grid rewrite and the IA move are cleaner
separated — your call, just don't bundle unrelated tasks together).

**Stop for review after X2.** It's the highest-impact, most structurally invasive task in this batch
— if something about the quiet-state API or the stats-to-panel move doesn't fit, better to find out
before repeating the pattern (there isn't a repeat here, but X2 touches the same primitives X3 and
X7 depend on, so get it reviewed before building on it).

---

## X2 — Trading's stat grid: 10 tiles → 1 hero + 4 secondary

**File:** `src/modules/trading/components/TradingStatsGrid.tsx`, consumed by
`src/modules/trading/components/TradingJournal.tsx` (already on `PageTemplate`, `hero={null}`
currently — this is where that changes).

This is "the single highest-impact page fix in the plan" per the sequencing table. Two separate
things happen here:

### 2a. Stop hand-formatting "—"

Every stat in the current file passes a pre-formatted string to `value`:

```tsx
<StatCard
  hint={stats.winRate === null ? "No closed trades yet" : undefined}
  label="Win rate"
  value={stats.winRate === null ? "—" : percent(stats.winRate)}
/>
```

C2 gave `StatCard` a `value: null` state that renders this exact treatment itself (label-weight,
`text-subtle`, exactly `"—"` — `tests/ui/trading.spec.ts` matches it with
`getByText("—", { exact: true })`, so the rendered text must not change). Read
`src/components/ui/StatCard.tsx`'s header comment and the `isPending` branch before touching this
file. Every `value={x === null ? "—" : format(x)}` in this file becomes `value={x}` with `x` typed
as `number | null`, and the ternary disappears. The `hint` stays — it's exactly what a pending stat
should show.

### 2b. One hero, four secondary, five demoted

Pick the single most important number as the hero (probably `stats.totalPnlCents`, since a trading
journal's one question is "am I profitable" — but this is a judgment call, not a rule; pick whatever
reads as the page's actual headline). Keep four more as secondary `stats` on `PageTemplate`. The
remaining five move into the equity-curve/positions panels where they already have context — e.g.
win rate and profit factor make sense next to the equity curve, average win/loss next to positions.
Where exactly each one lands is your call; the constraint is just that all nine non-hero numbers stay
visible somewhere, with the four most important promoted to the page-level `stats` slot.

Wire the hero through `whenAbsent` — a fresh account's P&L is `$0.00`, which is a MEASURED zero, not
absence (see `StatCard`'s three-state comment: measured zero is never demoted, only `null`/pending
is). So this specific hero likely does NOT need `whenAbsent` if you pick total P&L — a `$0.00`
hero is legitimate data. If you pick a metric that seems fine as a hero but a fresh account renders
as `null` (win rate, profit factor), you do need `whenAbsent`, or the dev-mode console.error in
`StatCard` will tell you so at build time.

Remove the `<h2>Performance</h2>` overline and the standalone `<section>` — the four/five
secondary stats become the page's own `stats` prop, and the promoted ones move into `children`
where the panels they join already have their own headings.

---

## X3 — hero pass

Pages still missing a focal point (`hero={null}` from X1, or never had one): Task Engine (already
has one — Codex added it correctly during X1 using `whenAbsent`, skip), LeetCode, Design Drills,
Finance, Notes (Knowledge Base), and whatever's left after X2.

For each: pick the ONE number that matters most on that page, promote it to `size="hero"`, wire
`whenAbsent` for the fresh-account case. Some pages genuinely have no single metric worth
headlining (Knowledge Base, Design Drills are both content-first, not metric-first) — those keep
`hero={null}`, which is a legitimate permanent choice per the contract's own doc comment, not debt.
Don't force a hero onto a page that doesn't have one; that's exactly the "never invent a hero" rule
from X1, still true here.

`tests/ui/page-contract.spec.ts`'s `HEADLINES_ABSENCE` set currently lists `/dashboard`,
`/achievements`, `/prep` — those are X7's job (copy), not X3's (which page gets a hero at all). Don't
conflate the two: a page can get a hero in X3 that still headlines absence until X7 fixes its copy.

---

## X4 — empty-container sweep

Now unblocked by C3's density tokens (`app/globals.css`'s `@theme inline` block —
`--spacing-xs/sm/md/lg`, `--spacing-empty`). Read `src/lib/density.test.ts` to see the exact values
being asserted.

Four known containers, from the plan's audit (`docs/ui-upgrade-wave3.md` §1.5):

| Container                                                                      | Current                                                                                                                                                                                                                                                                                                                                         | Fix                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kanban column ×4 (`src/modules/task/components/BoardColumn.tsx`)               | fixed `min-h-[520px]` regardless of content                                                                                                                                                                                                                                                                                                     | replace with `min-h-empty` (the new token) on the column, or move the floor onto the empty state itself so a column with cards isn't stretched to match an empty one |
| "Weekly tasks" panel                                                           | ~290px empty                                                                                                                                                                                                                                                                                                                                    | same `min-h-empty` treatment                                                                                                                                         |
| Hub landing page                                                               | Now on `PageTemplate` with `contentWidth="narrow"` (merged since the plan's original audit) — re-check whether the dead-canvas complaint still holds now that the layout is centered/narrower; it may already be resolved or may now read as normal landing-page whitespace rather than a defect. Use judgment; this one might already be done. |
| Activity heatmap panel (`src/modules/momentum/components/ActivityHeatmap.tsx`) | stub grid hard-right-aligned in a wide panel                                                                                                                                                                                                                                                                                                    | this is a width/alignment issue, not a height one — `min-h-empty` doesn't apply; center or left-align the stub grid instead                                          |

Use `gap-xs/sm/md/lg` and `p-xs/sm/md/lg` from the same token set anywhere you're touching spacing
in these files anyway — no need to do a repo-wide spacing sweep as part of this task, just don't
introduce a new arbitrary `gap-7` while you're in a file this task already touches.

---

## X5 — hue application

Design Drills, LeetCode, and Trading's internal components have zero (Design Drills, LeetCode) or
near-zero (Trading — only the page header, from X1) module-hue usage, per the plan's audit (§1.1).
Every other module uses the hue kit (`hueClasses.ts`, `moduleHues.ts`) on headers, active states,
badges. These three don't, because they were built after the color refresh shipped.

Apply the module's own hue (`hueFor("/design-drills")`, `hueFor("/prep")` for LeetCode since it's
part of Prep Tracker's hue family — check `src/components/miniApps.ts`'s fallback chain if unsure,
`hueFor("/trading")`) to:

- section headers / active tab indicators
- badges (difficulty pills, status chips)
- chart strokes (Trading's equity curve, if it doesn't already use a semantic color)

Where a data value needs its own color mapping (e.g. difficulty → hue, not just "this whole page is
one hue"), define it as a small `const` map next to the module, mirroring `moduleHues.ts`'s own
pattern — e.g. `src/modules/designDrills/difficultyHues.ts` exporting a
`Record<Difficulty, HueName>`. Don't invent a generic "any module can define hue maps" abstraction;
each map is local to its module.

**`src/lib/noRawColor.test.ts` is the gate here** — it'll fail if you reach for `text-cyan-400`
instead of the semantic hue tokens. Run it early and often while doing this task; it's a fast unit
test, not something to discover at the end.

---

## X6 — unify the refresh affordance

Since X1 (and the `PageHeader` actions-stretch fix that came out of reviewing it), every page's
refresh button renders through `actions` and no longer stretches full-width. What's left: **two
different visual treatments** for what should be one control.

Text-label buttons (majority pattern, 4 pages): Dashboard, Prep, Job CRM, Outreach —
`className="h-10 rounded-md border border-input bg-surface px-4 text-sm ..."`, text "Refresh".

Icon-only buttons (2 pages): Trading, Task Board — `size-10` button with a `RefreshCw` icon,
`aria-label` instead of visible text.

Extract ONE shared component (e.g. `src/components/ui/RefreshButton.tsx`) and apply it everywhere,
picking the text-label treatment as the default (it's the majority pattern, and it doesn't need an
`aria-label` workaround). Only fall back to icon-only where there's a genuine space constraint (e.g.
Trading's header sits next to a tablist and might be tight) — if you're not sure a page needs the
icon variant, default to text.

**Keep every `id`** (`#dashboard-refresh`, `#outreach-refresh`, `#prep-refresh`, `#job-crm-refresh`,
etc.) — several E2E specs and command-palette registrations
(`document.getElementById("outreach-refresh")?.click()` in `OutreachLog.tsx`, for one) click these
by id. Renaming the id breaks that even though the component itself renders fine.

---

## X7 — quiet-state copy pass

Apply `pending` vs `zero` across every stat surface, and rewrite hero copy per §2.2 ("never headline
absence"). `tests/ui/page-contract.spec.ts`'s `HEADLINES_ABSENCE` set is the checklist — **it only
shrinks**, and emptying it is this task's definition of done:

```ts
const HEADLINES_ABSENCE = new Set([
  "/dashboard", // "0 days · 0 applications · 0 outreach" — the app's front door
  "/achievements", // "0 days"
  "/prep", // "0%"
]);
```

For each: give the hero `absent` (if the value is a preformatted string a zero can hide inside,
like `"0 days"`) and `whenAbsent` (the next action — "Log a task today", "Start today's streak",
"Log your first prep session"). Then remove the route from `HEADLINES_ABSENCE` and confirm
`page-contract.spec.ts` still passes — it will actively fail if you remove the entry without
actually fixing the copy, so that's your own verification, not just an honor system.

**One more found during C4's review, not in the original set:**
`src/modules/review/components/ReviewSnapshotStats.tsx` (used by Weekly Review) has a `StatCard
size="hero"` used for in-panel visual emphasis — not the page's own hero (Weekly Review itself
passes `hero={null}`), so it's invisible to `page-contract.spec.ts`'s hero check, but it still trips
`StatCard`'s own dev-mode `whenAbsent` warning on every render since it has no `whenAbsent`. Either
give it one, or reconsider whether that stat genuinely needs `size="hero"` for in-panel emphasis at
all — a smaller size might be more honest about it not being a page-level focal point.

---

## Non-goals — still true

Everything X1's brief said not to touch remains off-limits unless the specific task above says
otherwise:

- Don't invent a hero for a page that has no natural one (X3 already covers this explicitly).
- Don't touch `PageTemplate.tsx` / `PageTemplateBody.tsx` / `pageTemplate.test.tsx` /
  `StatCard.tsx`'s core quiet-state logic. If a contract looks wrong for what you're building, flag
  it — don't patch around it.
- Don't do a repo-wide spacing or hue sweep beyond the files each task actually touches.

## Traps already known

1. E2E specs query by role, label, accessible name, and several refresh buttons by `id` — X6 says
   this explicitly but it applies everywhere you touch markup.
2. Only `globals.css` names a colour — `noRawColor.test.ts` enforces it, most relevant to X5.
3. Never tint absence, never headline it — `StatCard` and `page-contract.spec.ts` both enforce this
   now, most relevant to X2/X3/X7.
4. Check both themes.
5. Pull before starting each task — this is a long sequence on one branch.
