import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let RoadmapRepository: typeof import("@/src/modules/roadmap/RoadmapRepository");
let admin: SupabaseClient;

const TEST_ITEM_KEY = "__dbtest_roadmap_criterion__";

beforeAll(async () => {
  RoadmapRepository = await import("@/src/modules/roadmap/RoadmapRepository");
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
});

describe("RoadmapRepository criterion upsert (db)", () => {
  afterEach(async () => {
    await admin.from("roadmap_progress").delete().eq("item_key", TEST_ITEM_KEY);
  });

  it("tickCriterion remains idempotent and revives its row without 42P10", async () => {
    await RoadmapRepository.tickCriterion(TEST_ITEM_KEY);
    await RoadmapRepository.tickCriterion(TEST_ITEM_KEY);

    let { data, error } = await admin
      .from("roadmap_progress")
      .select("id, completed_at, deleted_at")
      .eq("item_key", TEST_ITEM_KEY);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].completed_at).not.toBeNull();
    expect(data?.[0].deleted_at).toBeNull();
    const originalId = data?.[0].id;

    await RoadmapRepository.untickCriterion(TEST_ITEM_KEY);
    await RoadmapRepository.tickCriterion(TEST_ITEM_KEY);

    ({ data, error } = await admin
      .from("roadmap_progress")
      .select("id, completed_at, deleted_at")
      .eq("item_key", TEST_ITEM_KEY));
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].id).toBe(originalId);
    expect(data?.[0].completed_at).not.toBeNull();
    expect(data?.[0].deleted_at).toBeNull();
  });
});
