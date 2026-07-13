import type { Page } from "@playwright/test";

export type ReviewRow = {
  id: string;
  week_start: string;
  went_well: string | null;
  needs_work: string | null;
  next_week_fix: string | null;
  quarterly_answers: Record<string, string> | null;
  snapshot: Record<string, unknown>;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

const STAMP = "2026-07-13T00:00:00.000Z";

export function snapshot(): Record<string, unknown> {
  return {
    cadence: {
      applications: { count: 0, target: { min: 5, max: 10 } },
      outreach: { count: 0, target: { min: 2, max: 3 } },
      mockInterviews: { count: 0, target: { min: 1 } },
    },
    scorecard: {
      countsByType: {
        algorithm: 0,
        system_design: 0,
        ml_system_design: 0,
        behavioral: 0,
        mock_interview: 0,
        resume_deep_dive: 0,
      },
      solved: 0,
      attempted: 0,
      solveRate: null,
      averageTimeToSolveMin: null,
    },
    checkpoint: {
      checkpoint: {
        label: "December 2026 semester review",
        throughDate: "2026-12-31",
        algorithm: { min: 75, max: 100 },
        systemDesign: { min: 6 },
        mlSystemDesign: { min: 2 },
        mockInterview: { min: 14 },
      },
      algorithm: { actual: 0, target: 75, progress: 0 },
      systemDesign: { actual: 0, target: 6, progress: 0 },
      mlSystemDesign: { actual: 0, target: 2, progress: 0 },
      mockInterview: { actual: 0, target: 14, progress: 0 },
    },
  };
}

export class FakeReviewDb {
  reviews: ReviewRow[];
  constructor(reviews: ReviewRow[] = []) {
    this.reviews = reviews;
  }
}

export async function mockSupabaseReview(page: Page, db: FakeReviewDb) {
  await page.route("**/rest/v1/weekly_reviews*", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          db.reviews.filter((row) => row.deleted_at === null),
        ),
      });
      return;
    }
    if (request.method() === "POST") {
      const payload = request.postDataJSON() as Omit<
        ReviewRow,
        "id" | "created_at" | "updated_at" | "deleted_at"
      >;
      const existing = db.reviews.find(
        (row) =>
          row.week_start === payload.week_start && row.deleted_at === null,
      );
      const row: ReviewRow = {
        id: existing?.id ?? `review-${payload.week_start}`,
        created_at: existing?.created_at ?? STAMP,
        updated_at: STAMP,
        deleted_at: null,
        ...payload,
      };
      if (existing) Object.assign(existing, row);
      else db.reviews.push(row);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(row),
      });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}
