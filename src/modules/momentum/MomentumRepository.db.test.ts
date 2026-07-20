import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AchievementKey } from "@/src/modules/momentum/achievementCatalog";

let MomentumRepository: typeof import("@/src/modules/momentum/MomentumRepository");
let admin: SupabaseClient;

// Achievement keys are a closed catalog, so this test cannot invent a
// __dbtest_* key. Snapshot any pre-existing row and remove only the ID this
// test created. CI starts from a clean database; this also keeps a reused local
// test stack safe.
const TEST_KEY: AchievementKey = "streak_100";
let originalIds = new Set<string>();

beforeAll(async () => {
  MomentumRepository =
    await import("@/src/modules/momentum/MomentumRepository");
  admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
});

describe("MomentumRepository achievements (db)", () => {
  afterEach(async () => {
    const { data } = await admin
      .from("achievements")
      .select("id")
      .eq("key", TEST_KEY);
    const createdIds = (data ?? [])
      .map((row) => row.id as string)
      .filter((id) => !originalIds.has(id));
    if (createdIds.length > 0) {
      await admin.from("achievements").delete().in("id", createdIds);
    }
    originalIds = new Set();
  });

  it("insertUnlocks persists once and ignores a duplicate without 42P10", async () => {
    const { data: original, error: originalError } = await admin
      .from("achievements")
      .select("id")
      .eq("key", TEST_KEY);
    expect(originalError).toBeNull();
    originalIds = new Set((original ?? []).map((row) => row.id as string));

    await MomentumRepository.insertUnlocks([TEST_KEY]);
    await MomentumRepository.insertUnlocks([TEST_KEY]);

    const { data, error } = await admin
      .from("achievements")
      .select("id, key")
      .eq("key", TEST_KEY)
      .is("deleted_at", null);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].key).toBe(TEST_KEY);
  });
});
