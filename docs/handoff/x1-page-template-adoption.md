# X1 — Adopt `PageTemplate` across the remaining routes (Codex)

## What this is

`docs/ui-upgrade-wave3.md` is the plan. Claude has published the page contract (C1); this is the
application half. Read `docs/ui-upgrade-wave3.md` §1.2, §1.3, §1.6 and §2.1 before starting — the
"why" matters here, because the whole point of the contract is that the rules stop being things
someone has to remember.

**Branch:** `ui-wave3-page-template`. Pull before you start — Claude is working on C2 (a `StatCard`
API change) in parallel and it will land on this branch. `git pull` before each page.

## The contract

`src/components/ui/PageTemplate.tsx` — read it and `PageTemplateBody.tsx` first. The slot order
**is** the contract:

```
header -> error -> hero -> stats -> data (children) -> compose
```

`compose` (entry forms) always renders after `children` (the data). No prop reorders them. That is
deliberate: Trading shipped a nine-field form above its equity curve and journal, which is the exact
defect `docs/visual-refresh.md` §1.5 diagnosed and fixed for three other modules. It came back
because "data before forms" lived only in prose.

## The reference

**Commit `75d46cd`** converts `src/modules/outreach/components/OutreachLog.tsx`. Read that diff
before touching anything — it is the pattern to copy. It went −74/+52 lines.

What the template absorbs from every page, so delete these as you go:

- the `<AppShell activeHref=... title=...>` wrapper
- the `<section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">` padding wrapper
- the `<PageHeader ... bleed className="mb-6">` call (the template renders it; pass `eyebrow`,
  `title`, `icon`, `description`, `actions` straight through)
- the hand-rolled `aria-live="assertive" role="alert"` error banner — pass `error={...}` instead.
  Outreach had **two** byte-identical banners; they folded to `error={error ?? companyError}`.
- the `hueFor("/x")` import — the template resolves the hue from `href`

`href` is the single source of truth: it drives both the rail's active state and the module hue, so
they can't disagree. Pass `navTitle` only when the rail should read differently from the nav label
(`navTitle="Daily Dashboard"` for a nav item labelled "Dashboard").

## Scope: 13 route containers

| File                                                           | Note                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `src/modules/dashboard/components/DailyDashboard.tsx`          | has a hero already                                     |
| `src/modules/roadmap/components/RoadmapPage.tsx`               |                                                        |
| `src/modules/prep/components/PrepTracker.tsx`                  |                                                        |
| `src/modules/jobApplications/components/JobApplicationCrm.tsx` |                                                        |
| `src/modules/momentum/components/AchievementsPage.tsx`         |                                                        |
| `src/modules/review/WeeklyReview.tsx`                          |                                                        |
| `src/modules/offers/OfferEvaluator.tsx`                        |                                                        |
| `src/modules/finance/components/FinancePage.tsx`               |                                                        |
| `src/modules/knowledgeBase/components/KnowledgeBasePage.tsx`   | likely `hero={null}`                                   |
| `src/modules/designDrills/components/DesignDrillsPage.tsx`     | likely `hero={null}`                                   |
| `src/modules/task/components/TaskBoard.tsx`                    | **special — see below**                                |
| `src/modules/trading/components/TradingJournal.tsx`            | **special — see below**                                |
| `app/page.tsx` (hub)                                           | **assess first** — may not fit; flag rather than force |

`src/modules/outreach/components/OutreachLog.tsx` is already done.

### Special case 1 — Task board (two files)

`TaskBoard.tsx` calls `AppShell` (line ~262) but the `PageHeader` lives in a separate
`BoardHeader.tsx`. Converting means restructuring across both: `BoardHeader`'s header props move up
into `TaskBoard`'s `PageTemplate` call, and whatever `BoardHeader` renders besides the header
(the toolbar, the filter chips) becomes ordinary content. Do this one **after** you have three
simple conversions under your belt.

### Special case 2 — Trading (AppShell is in the route file)

`app/trading/page.tsx` holds the `AppShell`; `TradingJournal.tsx` holds the `PageHeader`. Both move
into one `PageTemplate` call inside `TradingJournal.tsx`.

**Convert Trading structurally in X1** — moving `<Panel title="Log an entry">` into the `compose`
slot fixes the form-first defect immediately and is the single biggest win in this pass.

**Do not touch the ten-tile `TradingStatsGrid` in X1.** Leave it where it is, inside `children`.
Reducing it to one hero + four secondary is X2 and depends on Claude's C2 quiet-state API.

**Tabs question:** Trading has a `role="tablist"` between the header and the content. There is no
slot for it. Put it as the **first child of `children`** for now. If that reads wrong on screen,
**flag it — do not invent a slot.** Contract changes are Claude's (CLAUDE.md §4).

## Non-goals — do not do these in X1

These are separate, sequenced tasks and doing them here will cause a merge collision with Claude:

- ❌ **Do not invent heroes.** If a page has no existing focal point, pass `hero={null}`. The hero
  pass is X3 and it depends on C2. A hero you invent now will likely headline a zero, which is the
  specific thing §2.2 bans.
- ❌ **Do not invent stats.** Only move an _existing_ row of ≤4 stat cards into `stats`. If a page
  has more than four, leave them in `children` — the extras get dropped silently otherwise.
- ❌ **Do not change empty-container heights.** That is X4 and it needs C3's density tokens.
- ❌ **Do not apply module hues to inner components.** That is X5.
- ❌ **Do not edit `PageTemplate.tsx`, `PageTemplateBody.tsx`, or `pageTemplate.test.tsx`.** If the
  contract is wrong, flag it and Claude fixes it.

## Stop for review after two pages

Convert **`RoadmapPage.tsx` and `PrepTracker.tsx` first, then stop and hand back.** If the
template's ergonomics are wrong, they are wrong thirteen times, and the last refresh already cost a
merge by discovering that late (`docs/visual-refresh.md`, "Note on collisions").

## Gate

Full gate before **every** commit: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run test:ui`. Baseline is **516 unit / 111 E2E green** — do not merge below that.

One commit per page (or per closely-related pair). Do not bundle.

## Traps that have already bitten this project

1. **The E2E specs query by role, label and accessible name.** Adding wrappers and classes is free;
   renaming a heading, changing an `aria-label`, or dropping a role is not. Several refresh buttons
   are queried by `id` (`#dashboard-refresh`, `#outreach-refresh`) — keep those ids.
2. **Only `globals.css` names a colour.** A raw `bg-zinc-900` or `text-indigo-400` in a component is
   a bug — it will be wrong in the other theme. Use the semantic tokens.
3. **Never tint absence** — no hue on zeros, em-dashes or empty days.
4. **Check both themes.** Dark is the daily driver, but light must not regress.
5. **Pull before starting each page.** C2 is landing on this branch in parallel.
