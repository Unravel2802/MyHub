# Handoff — Momentum: streaks + achievements (Claude Code → Codex)

Published contract. Wave 2, Phase 5 (`myhub_plan.md` Part B) — **the centerpiece**. This is the
feature the whole gamification ask was about, so the UI matters more here than anywhere else in
Wave 2.

## What's already landed

| File | State |
|---|---|
| `supabase/migrations/0010_achievements.sql` | Done — `achievements` table + partial unique index on `(key) where deleted_at is null` |
| `src/lib/events.ts` | Done — new `outreach.logged` event in the `AppEvent` union |
| `src/modules/outreach/useOutreachStore.ts` | Done — emits `outreach.logged` on create |
| `src/modules/momentum/streaks.ts` | Done + tested — `activityDates()`, `computeStreak()` |
| `src/modules/momentum/achievementCatalog.ts` | Done — 23 achievements, each with `key` / `title` / `description` / `category` / `source` |
| `src/modules/momentum/achievementEngine.ts` | Done + tested — `evaluateAchievements()`, `newUnlocks()` |
| `src/modules/momentum/MomentumRepository.ts` | Done — `getUnlocks()`, `insertUnlocks()` (ignore-duplicates upsert) |
| `src/modules/momentum/useMomentumStore.ts` | Done — `{ streak, unlocked, pendingToasts, isLoading, error, refresh, dismissToast, subscribeToUpdates }`, with three-layer idempotency |

Full gate green: typecheck, lint, 188 unit, 32 E2E.

## Contract notes

**No XP, no levels, no points.** Locked decision. Every achievement is a discrete named thing
tied to a real roadmap number — each carries a `source` field citing the roadmap section it came
from. Don't add a "total score" anywhere.

**The streak has a grace day.** `computeStreak` counts a run ending today *or yesterday*, and
reports `activeToday` separately. So at 9am, before you've logged anything, `current` is still
(say) 12 and `activeToday` is `false`. The indicator should read as **alive but not yet fed** in
that state — dimmed flame, not a zero. Showing 0 every morning would be both wrong and exactly
the wrong emotional message.

**Toasts must not re-fire.** The store handles this (in-flight guard, synchronous diff-set
commit, DB ignore-duplicates upsert). Your job is just to render `pendingToasts` and call
`dismissToast(key)`. Don't add your own dedupe on top.

## Your work

### 1. `StreakIndicator.tsx` — the AppShell rail slot

Compact "🔥 n-day streak" in the placeholder I left in `AppShell.tsx` (`{/* Phase 5:
StreakIndicator; Phase 7: sign-out */}`). Accent-strong when `streak.activeToday`, dimmed
otherwise. Handle `current === 0` gracefully (something inviting, not a scolding zero).

**AppShell mounts the store**: it's the only always-mounted client component, so it calls
`refresh()` and `subscribeToUpdates()` once in an effect (with the returned unsubscribe as
cleanup). Every other page gets the streak for free.

### 2. `UnlockToaster.tsx`

Fixed bottom-right stack of `pendingToasts`, auto-dismissing after ~6s. Slide-up + scale-pop
entrance via a Tailwind keyframe added to `app/globals.css` — CSS only, no new dependency. This
is the one moment of delight in the app; make it feel good.

### 3. `AchievementsPage.tsx` + `app/achievements/page.tsx` + a `NAV_ITEMS` entry

Trophy grid grouped by `category` (`prep` / `career` / `consistency`). Unlocked = accent card
showing the unlock date; locked = dimmed, showing the description so you can see what you're
working toward. Header `StatCard`s: current streak, longest streak, `n/23` unlocked
(`ACHIEVEMENT_COUNT` is exported — use it rather than hardcoding 23).

### 4. `tests/ui/fixtures.ts` (new) — **do this first, it unblocks everything else**

AppShell now mounts the momentum store on *every* page, so every existing spec will suddenly see
unrouted Supabase calls (`prep_entries`, `applications`, `outreach_log`, `achievements`).

Create a Playwright `test` extended with an automatic before-each installing a **baseline
catch-all** `page.route("**/rest/v1/**", …)` that returns `[]` for GET and success for
POST/PATCH. Fixture routes register first and each spec's specific routes register later —
last-registered wins in Playwright — so specific table mocks still take precedence, while
momentum's otherwise-unrouted fetches resolve to `[]` (streak 0, no toasts). **Existing specs
then pass unchanged in behavior.** Migrate all spec files to import `test` from `./fixtures`
(~7 files, mechanical).

### 5. `tests/ui/supabaseMomentumMock.ts` + `momentum.spec.ts`

Mock must honor the ignore-duplicates upsert. Spec: cross a threshold → toast appears once → one
POST fired → the trophy shows unlocked; reload → **no duplicate toast**.

## Not yours

- `streaks.ts`, `achievementCatalog.ts`, `achievementEngine.ts` — domain logic and the catalog's
  numbers. If a threshold looks wrong, flag it; every number traces to a roadmap section and
  changing one is a spec decision, not an implementation one.
