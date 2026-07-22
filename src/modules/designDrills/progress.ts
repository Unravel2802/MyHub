import type {
  DesignDrill,
  DesignDrillAttempt,
  DesignDrillCategory,
  DesignDrillDifficulty,
  DesignDrillSelfRating,
} from "@/src/modules/designDrills/types";

// Phase 4 domain logic for the Design Drills progress surface. Pure and
// deterministic — `now` is injected so the spaced-repetition math is testable
// against a pinned clock. Consumed by the dashboard / review-queue UI, which
// calls these with `drills` and `attempts` from the store; there is no new
// schema or store surface.

// --- Shared: latest completed attempt per drill ------------------------------

// The most recent non-deleted, completed attempt for a drill, or null if the
// drill has never been finished. ISO timestamps compare lexicographically, so a
// string compare is a chronological compare here.
export function latestCompletedAttempt(
  attempts: DesignDrillAttempt[],
  drillId: string,
): DesignDrillAttempt | null {
  let latest: DesignDrillAttempt | null = null;
  for (const attempt of attempts) {
    if (
      attempt.drillId !== drillId ||
      attempt.deletedAt !== null ||
      attempt.completedAt === null
    ) {
      continue;
    }
    if (
      latest === null ||
      attempt.completedAt > (latest.completedAt as string)
    ) {
      latest = attempt;
    }
  }
  return latest;
}

// --- Review queue (spaced repetition) ----------------------------------------

export type ReviewReason = "never_attempted" | "due" | "practiced";

export interface ReviewItem {
  drill: DesignDrill;
  reason: ReviewReason;
  lastAttemptedAt: string | null;
  lastRating: DesignDrillSelfRating | null;
  // Days until the drill is next due. <= 0 means due now; null when never
  // attempted (treated as always due, sorted to the very top).
  dueInDays: number | null;
}

// Spaced-repetition intervals (days) keyed by the last self-rating: a weak rep
// comes back around fast, a strong rep waits much longer.
const REVIEW_INTERVAL_DAYS: Record<DesignDrillSelfRating, number> = {
  weak: 2,
  solid: 7,
  strong: 21,
};

const DIFFICULTY_RANK: Record<DesignDrillDifficulty, number> = {
  warmup: 0,
  core: 1,
  advanced: 2,
};

const RATING_URGENCY: Record<DesignDrillSelfRating, number> = {
  weak: 0,
  solid: 1,
  strong: 2,
};

const REASON_ORDER: Record<ReviewReason, number> = {
  never_attempted: 0,
  due: 1,
  practiced: 2,
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Ranks every non-deleted drill by review priority:
//   1. never-attempted (nothing practiced yet), easiest difficulty first;
//   2. due — the spaced-repetition interval since the last rep has elapsed —
//      most overdue first, weaker reps breaking ties;
//   3. practiced but not yet due, soonest-due first.
// The actionable "revisit" queue is every item whose reason !== "practiced";
// the UI slices/​labels from there.
export function reviewQueue(
  drills: DesignDrill[],
  attempts: DesignDrillAttempt[],
  now: Date,
): ReviewItem[] {
  const nowMs = now.getTime();

  const items = drills
    .filter((drill) => drill.deletedAt === null)
    .map((drill): ReviewItem => {
      const last = latestCompletedAttempt(attempts, drill.id);
      if (
        last === null ||
        last.completedAt === null ||
        last.selfRating === null
      ) {
        return {
          drill,
          reason: "never_attempted",
          lastAttemptedAt: null,
          lastRating: null,
          dueInDays: null,
        };
      }
      const elapsedDays =
        (nowMs - new Date(last.completedAt).getTime()) / MS_PER_DAY;
      const dueInDays = REVIEW_INTERVAL_DAYS[last.selfRating] - elapsedDays;
      return {
        drill,
        reason: dueInDays <= 0 ? "due" : "practiced",
        lastAttemptedAt: last.completedAt,
        lastRating: last.selfRating,
        dueInDays,
      };
    });

  return items.sort(compareReviewItems);
}

function compareReviewItems(a: ReviewItem, b: ReviewItem): number {
  if (a.reason !== b.reason) {
    return REASON_ORDER[a.reason] - REASON_ORDER[b.reason];
  }

  if (a.reason === "never_attempted") {
    const rank =
      DIFFICULTY_RANK[a.drill.difficulty] - DIFFICULTY_RANK[b.drill.difficulty];
    return rank !== 0 ? rank : a.drill.title.localeCompare(b.drill.title);
  }

  // due / practiced: both dueInDays are non-null. Ascending = most overdue
  // (due) or soonest due (practiced) first.
  const dueDelta = (a.dueInDays ?? 0) - (b.dueInDays ?? 0);
  if (Math.abs(dueDelta) > 1e-9) return dueDelta < 0 ? -1 : 1;

  if (a.reason === "due" && a.lastRating !== null && b.lastRating !== null) {
    const urgency = RATING_URGENCY[a.lastRating] - RATING_URGENCY[b.lastRating];
    if (urgency !== 0) return urgency;
  }

  return a.drill.title.localeCompare(b.drill.title);
}

// --- Coverage ----------------------------------------------------------------

export interface CoverageBucket {
  total: number;
  // Distinct drills in the bucket with at least one completed attempt.
  attempted: number;
}

export interface DrillCoverage {
  overall: CoverageBucket;
  byCategory: Record<DesignDrillCategory, CoverageBucket>;
  byDifficulty: Record<DesignDrillDifficulty, CoverageBucket>;
  // Count of drills whose most recent completed attempt carries each rating.
  latestRatingCounts: Record<DesignDrillSelfRating, number>;
}

const CATEGORIES: DesignDrillCategory[] = ["system_design", "ml_system_design"];
const DIFFICULTIES: DesignDrillDifficulty[] = ["warmup", "core", "advanced"];
const RATINGS: DesignDrillSelfRating[] = ["strong", "solid", "weak"];

export function drillCoverage(
  drills: DesignDrill[],
  attempts: DesignDrillAttempt[],
): DrillCoverage {
  const live = drills.filter((drill) => drill.deletedAt === null);

  const attemptedIds = new Set(
    attempts
      .filter(
        (attempt) => attempt.deletedAt === null && attempt.completedAt !== null,
      )
      .map((attempt) => attempt.drillId),
  );

  const bucket = (): CoverageBucket => ({ total: 0, attempted: 0 });
  const overall = bucket();
  const byCategory = Object.fromEntries(
    CATEGORIES.map((category) => [category, bucket()]),
  ) as Record<DesignDrillCategory, CoverageBucket>;
  const byDifficulty = Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [difficulty, bucket()]),
  ) as Record<DesignDrillDifficulty, CoverageBucket>;
  const latestRatingCounts = Object.fromEntries(
    RATINGS.map((rating) => [rating, 0]),
  ) as Record<DesignDrillSelfRating, number>;

  for (const drill of live) {
    const attempted = attemptedIds.has(drill.id);
    overall.total += 1;
    byCategory[drill.category].total += 1;
    byDifficulty[drill.difficulty].total += 1;
    if (attempted) {
      overall.attempted += 1;
      byCategory[drill.category].attempted += 1;
      byDifficulty[drill.difficulty].attempted += 1;
    }

    const last = latestCompletedAttempt(attempts, drill.id);
    if (last?.selfRating != null) {
      latestRatingCounts[last.selfRating] += 1;
    }
  }

  return { overall, byCategory, byDifficulty, latestRatingCounts };
}
