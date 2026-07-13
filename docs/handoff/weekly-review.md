# Handoff — Weekly Review ritual (Claude Code → Codex)

Published contract. Wave 2, Phase 6 (`myhub_plan.md` Part B) — §14's Sunday review block plus
§15's quarterly questions.

## What's already landed

| File | State |
|---|---|
| `supabase/migrations/0011_weekly_reviews.sql` | Done — `weekly_reviews` table + partial unique index on `(week_start) where deleted_at is null` |
| `src/modules/review/reviewLogic.ts` | Done + tested — `weekStartOf`, `weekStartKeyOf`, `isQuarterBoundaryWeek`, `QUARTERLY_QUESTIONS`, `buildSnapshot` |
| `src/modules/review/types.ts` | Done — `WeeklyReview`, `QuarterlyAnswers` |
| `src/modules/review/ReviewRepository.ts` | Done — `getReviews`, `getReviewForWeek`, `upsertReview` (`onConflict: "week_start"`) |
| `src/modules/review/useReviewStore.ts` | Done — `{ reviews, currentSnapshot, isLoading, isSaving, error, fetchReviews, saveReview, reviewForWeek, isQuarterBoundary }` |

## The one idea that matters here

**A review freezes its numbers.** `weekly_reviews.snapshot` stores the week's actuals as they
stood when you hit save. The past-reviews list must render **that frozen snapshot**, never
recomputed live data — otherwise soft-deleting a prep entry in December would silently rewrite
what your October review said you'd done that week. A review is a record of what you knew when
you wrote it.

The store handles the capture: `saveReview({ today, ... })` calls `buildSnapshot` itself at save
time. Don't pass a snapshot in, and don't reuse `currentSnapshot` (which is for *displaying*
live numbers while you write, and can be hours stale if the tab's been open).

## Your work

`app/review/page.tsx` + `WeeklyReview.tsx` + a `NAV_ITEMS` entry ("Weekly Review"):

1. **"This week" panel** — the live actuals from `currentSnapshot` (cadence, scorecard,
   checkpoint). Fetched via `useReviewStore.fetchReviews()`, which goes through the repositories.
   **Not** `useDashboardStore` — that's a different module's store, and reaching into it would
   break rule 1.
2. **Reflection form** — three textareas: what went well / what needs work / one fix for next
   week. Plus the five `QUARTERLY_QUESTIONS`, rendered **only when
   `isQuarterBoundary(new Date())` is true**. Off-boundary weeks must not show them at all.
   Answers go in as `QuarterlyAnswers` (a `Record<string, string>` keyed by question index).
3. **Past reviews list** — each showing its frozen snapshot numbers alongside the reflection
   text. Re-opening the current week's review should pre-fill the form from
   `reviewForWeek(weekStartKeyOf(new Date()))` if one exists, since re-saving updates rather
   than duplicating.

## Tests

Mock + `tests/ui/weekly-review.spec.ts`:
- Save a review → it appears in the past-reviews list.
- Re-save the same week → **upserts, does not duplicate** (assert one row, not two).
- Quarterly questions hidden on an ordinary week, shown on a boundary week. Pin the clock for
  this one — `isQuarterBoundaryWeek` is a pure function of the date, so freeze it rather than
  hoping CI runs in the right week.

## Not yours

- `reviewLogic.ts` — domain logic, tested. In particular `isQuarterBoundaryWeek` has a subtle
  edge (a quarter-end landing exactly on the week's own Sunday, and a week straddling New
  Year's); the tests pin both. If it looks wrong, flag it rather than adjusting it.
