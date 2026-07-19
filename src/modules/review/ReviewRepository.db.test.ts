import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildSnapshot } from "@/src/modules/review/reviewLogic";

let ReviewRepository: typeof import("@/src/modules/review/ReviewRepository");
let admin: SupabaseClient;

const TEST_WEEK = "2099-12-28"; // Monday, namespaced outside app data.

beforeAll(async () => {
  ReviewRepository = await import("@/src/modules/review/ReviewRepository");
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
});

describe("ReviewRepository weekly review upsert (db)", () => {
  afterEach(async () => {
    await admin.from("weekly_reviews").delete().eq("week_start", TEST_WEEK);
  });

  it("upsertReview updates one week in place without 42P10", async () => {
    const snapshot = buildSnapshot([], [], [], new Date("2026-07-19T12:00:00"));
    const created = await ReviewRepository.upsertReview({
      weekStart: TEST_WEEK,
      wentWell: "__dbtest_first__",
      snapshot,
    });
    const updated = await ReviewRepository.upsertReview({
      weekStart: TEST_WEEK,
      wentWell: "__dbtest_second__",
      needsWork: "__dbtest_follow_up__",
      snapshot,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.wentWell).toBe("__dbtest_second__");

    const saved = await ReviewRepository.getReviewForWeek(TEST_WEEK);
    expect(saved).toMatchObject({
      id: created.id,
      wentWell: "__dbtest_second__",
      needsWork: "__dbtest_follow_up__",
    });

    const { data, error } = await admin
      .from("weekly_reviews")
      .select("id")
      .eq("week_start", TEST_WEEK);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
