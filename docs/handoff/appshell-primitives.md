# Handoff — Shared AppShell + UI primitives (Claude Code → Codex)

Published contract. Wave 2, Phase 1 (`myhub_plan.md` Part B) — a refactor, no migration, no
new domain logic. Lands first because every later Wave 2 phase needs a one-line change here
instead of touching five pages (the streak indicator in Phase 5, sign-out in Phase 7, new nav
items in Phase 5/6/8).

## What's already landed

| File | State |
|---|---|
| `src/components/appNav.ts` | Done — `NavItem` type + `NAV_ITEMS` (the same five links every page currently hand-writes) |

Everything else in this phase is yours.

## The problem this fixes

Only `src/modules/task/components/Sidebar.tsx` is an extracted component. Every other page —
`PrepTracker.tsx`, `JobApplicationCrm.tsx`, `OutreachLog.tsx`, `DailyDashboard.tsx` — duplicates
the identical `<aside>` inline, with only the `<h1>` text and which link has
`aria-current="page"` actually differing. Same for the outer page wrapper: every page repeats

```tsx
<main className="min-h-screen bg-canvas text-foreground">
  <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
    <Sidebar />
    {/* page content */}
  </div>
</main>
```

## Your work

### 1. `src/components/AppShell.tsx` (new)

Client component. Props: `{ title: string; activeHref: string; children: React.ReactNode }`.

Copy `Sidebar.tsx`'s markup and Tailwind classes **verbatim** (don't restyle anything — this is
extraction, not redesign) into `AppShell`, but:

- Wrap it in the outer `<main>`/`<div className="grid ...">` shown above, so `AppShell` owns the
  *whole* page frame, not just the sidebar. `children` renders where each page's content
  currently sits, as the grid's second column.
- Replace the five hand-written `<Link>`s with a `.map()` over `NAV_ITEMS` from
  `@/src/components/appNav`. Set `aria-current="page"` and the active styling
  (`bg-surface-subtle px-3 py-2 font-medium text-foreground`, vs. the inactive
  `text-body hover:bg-surface-subtle`) on whichever item's `href === activeHref`.
- Replace the hand-written `<h1>Task Engine</h1>` with `<h1>{title}</h1>`.
- **Leave a clearly commented placeholder** in the `<div className="lg:mt-auto">` block, above
  `<ThemeToggle />`. Phase 5 mounts a `StreakIndicator` there; Phase 7 mounts a sign-out button.
  A one-line comment (`{/* Phase 5: StreakIndicator; Phase 7: sign-out */}`) is enough — don't
  build placeholder UI for those, just leave the spot obvious.
- Import from `@/src/modules/task/components/Sidebar`'s sibling `ThemeToggle` import path
  (`@/src/components/ThemeToggle`) — unchanged.
- Shell→module imports are allowed even though module→module imports aren't (`CLAUDE.md`
  Architecture Rule 1 governs module-to-module, not app-shell-to-module) — `AppShell` living
  under `src/components/` rather than `src/modules/<x>/` is what makes it shell-level. Mirror
  the boundary note already in `useDashboardStore.ts`'s doc comment if you want the precedent
  written down again here.

### 2. `src/components/ui/ProgressBar.tsx` (new)

Lift the `ProgressBar` function out of `src/modules/dashboard/components/DailyDashboard.tsx`
**unchanged** — same props (`{ progress: number }`), same clamped-fill-at-100%-but-uncapped-text
behavior. Re-import it in `DailyDashboard.tsx` instead of defining it locally. Don't touch its
visual output — some Playwright specs may assert on the fill width.

### 3. `src/components/ui/StatCard.tsx` (new)

Extract the repeated stat-tile pattern you'll find duplicated in `BoardHeader.tsx`,
`PrepScorecard.tsx`, and `DailyDashboard.tsx`'s local `CadenceCard`/`TargetCard` components
(label + large number + optional sub-line, `rounded-lg border border-border bg-surface-subtle`
family of classes). Props:

```ts
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "accent" | "danger";
}
```

`tone` controls the value's text color (`text-foreground` default, `text-accent-strong` accent,
`text-danger` danger) — match whatever tone variations already exist across the three call
sites you're extracting from, don't invent a new palette.

### 4. `src/components/ui/Badge.tsx` (new)

Extract the pill pattern (tier badges in Job CRM, entry-type pills in Prep, the "Weekly
instance" badge on task cards, status pills). Props:

```ts
interface BadgeProps {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "danger" | "success";
}
```

Semantic tokens only (`bg-surface-subtle`/`text-muted` neutral, `bg-accent`/`text-accent-strong`
accent family, `bg-danger-surface`/`text-danger` danger, pick a `success` treatment consistent
with the existing palette — there may not be an existing green pill to copy from, so use
whatever the design tokens in `app/globals.css` offer that reads as "success" against both light
and dark).

### 5. Migrate all five pages

For each of `TaskBoard.tsx`, `PrepTracker.tsx`, `JobApplicationCrm.tsx`, `OutreachLog.tsx`,
`DailyDashboard.tsx`: replace the page's own `<main>`/grid/`<aside>` wrapper with
`<AppShell title="..." activeHref="...">{/* existing content, unchanged */}</AppShell>`, using
each page's current `<h1>` text as `title` and its current route as `activeHref`. Delete each
page's now-dead inline sidebar JSX. **Delete `src/modules/task/components/Sidebar.tsx`
entirely** once `TaskBoard.tsx` no longer imports it — it's fully superseded by `AppShell`.

## Tests

The existing 30 Playwright specs are the regression gate — **must pass unmodified**. The DOM
has to stay structurally identical (same tags, same accessible names, same `aria-current`
usage) since `tests/ui/theme.spec.ts` and others query the sidebar/nav/theme-toggle group
directly. If a selector breaks, that means the DOM changed in a way it shouldn't have — fix
`AppShell` to match the original markup, don't edit the test to match a new DOM shape.

No new unit tests needed — this phase is presentational, nothing here has domain logic to test.

## Not yours

- `StreakIndicator`, sign-out, and the new nav items for Achievements/Weekly Review/Offers —
  those are Phase 5/6/7/8, later. The placeholder comment in step 1 is all this phase needs.
