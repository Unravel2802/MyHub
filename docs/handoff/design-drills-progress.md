# Handoff — Design Drills Phase 4: progress + review queue (Claude → Codex)

A **progress dashboard** (how much of the bank you've covered, and how solid it
is) plus a **spaced-repetition "revisit" queue**. Claude owns the ranking + the
coverage math (pure, unit-tested); **Codex owns the dashboard UI, the queue UI,
and the tests.** No schema and no store change — both functions derive from the
`drills` and `attempts` already in the store.

## Published contract (already landed by Claude)

`src/modules/designDrills/progress.ts` (unit-tested in `progress.test.ts`):

```ts
// Spaced-repetition ranking. Pass `new Date()` for `now`.
reviewQueue(drills, attempts, now: Date): ReviewItem[]

interface ReviewItem {
  drill: DesignDrill;
  reason: "never_attempted" | "due" | "practiced";
  lastAttemptedAt: string | null;
  lastRating: DesignDrillSelfRating | null;
  dueInDays: number | null; // <= 0 = due now; null = never attempted (always due)
}

// Coverage across the bank.
drillCoverage(drills, attempts): DrillCoverage

interface CoverageBucket { total: number; attempted: number } // attempted = distinct drills with >=1 completed attempt
interface DrillCoverage {
  overall: CoverageBucket;
  byCategory: Record<DesignDrillCategory, CoverageBucket>;
  byDifficulty: Record<DesignDrillDifficulty, CoverageBucket>;
  latestRatingCounts: Record<DesignDrillSelfRating, number>; // by each drill's most recent completed rating
}
```

Ranking rules (already implemented + tested — don't reimplement): never-attempted
first (easiest difficulty first), then **due** (interval elapsed since the last
rep — weak 2d / solid 7d / strong 21d — most overdue first, weaker ties break
ahead), then **practiced** (not yet due, soonest-due first). The actionable
"revisit" queue is every item whose `reason !== "practiced"`.

## What Codex builds

1. **Coverage panel** on the Design Drills surface (likely the list view header
   area): overall `attempted/total`, plus per-category and per-difficulty
   breakdowns and the strong/solid/weak split from `latestRatingCounts`. Reuse
   `StatCard`, `ProgressBar`, `Badge`, the hue kit; drive with
   `drillCoverage(drills, attempts)`.
2. **"Revisit weak drills" queue** — call `reviewQueue(drills, attempts, new Date())`,
   take the items where `reason !== "practiced"` (cap to a sensible top N), and
   render each as a row linking to `/design-drills/[slug]` with a reason chip
   ("New", "Due", overdue-by-N-days) and the last rating. Empty state when
   nothing is due ("all caught up").
3. Wire it into `DesignDrillsPage` (data already loaded via `fetchDrills` /
   `fetchAttempts`). Decide placement — a section on the list view, or a small
   "Review" tab/panel; keep it consistent with the existing page.
4. **Tests** — E2E covering: coverage counts reflect seeded attempts; the queue
   surfaces never-attempted + due drills and links to the right slug; "all caught
   up" empty state. Extend `tests/ui/supabaseDesignDrillsMock.ts` fixtures as
   needed (no new endpoints — it's all derived client-side).

## Constraints

- Pure client-side derivation — do **not** add a repo method, store field, or DB
  query for progress/review. Call `reviewQueue` / `drillCoverage` with store data.
- Pass a real `new Date()` at the call site (don't hardcode); keep components
  deterministic by not recomputing `now` mid-render loop.
- `lucide-react` icons only; reuse existing UI primitives and tokens.
