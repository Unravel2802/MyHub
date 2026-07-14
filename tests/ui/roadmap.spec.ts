import { expect, test } from "./fixtures";
import {
  FakeRoadmapDb,
  mockSupabaseRoadmap,
  tickRow,
} from "./supabaseRoadmapMock";
import { FakePrepDb, mockSupabasePrep, prepEntryRow } from "./supabasePrepMock";

// The roadmap page. Its whole job is to tell the truth about where you stand —
// so these pin the places where it could quietly lie.

async function load(page: Parameters<typeof mockSupabaseRoadmap>[0], db: FakeRoadmapDb, prep?: FakePrepDb) {
  await mockSupabasePrep(page, prep ?? new FakePrepDb());
  await mockSupabaseRoadmap(page, db);
  await page.goto("/roadmap");
  await expect(
    page.getByRole("heading", { name: "Where you stand" }),
  ).toBeVisible();
}

test("renders the timeline with a station per roadmap month", async ({ page }) => {
  await load(page, new FakeRoadmapDb());

  const timeline = page.getByRole("region", { name: "The line to graduation" });
  await expect(timeline).toBeVisible();
  // Jul 2026 -> May 2027 inclusive.
  await expect(timeline.getByRole("button")).toHaveCount(11);
});

test("an auto criterion reflects real prep data and has NO checkbox", async ({
  page,
}) => {
  // The number is the truth. A roadmap you can tick complete without doing the
  // work is a roadmap that lies to you — so auto criteria must be read-only.
  const prep = new FakePrepDb(
    Array.from({ length: 12 }, (_, i) =>
      prepEntryRow({
        id: `algo-${i}`,
        entry_type: "algorithm",
        date: "2026-09-10",
      }),
    ),
  );
  await load(page, new FakeRoadmapDb(), prep);

  await page
    .getByRole("button", { name: /September 2026/ })
    .click();

  // "15 algorithm problems" in September, 12 logged.
  await expect(page.getByText("12/15")).toBeVisible();

  const autoRow = page
    .locator("li")
    .filter({ hasText: "15 algorithm problems" });
  await expect(autoRow.getByRole("checkbox")).toHaveCount(0);
});

test("ticking a manual criterion persists it", async ({ page }) => {
  const db = new FakeRoadmapDb();
  await load(page, db);

  await page.getByRole("button", { name: /July 2026/ }).click();

  const resumes = page.getByRole("checkbox", {
    name: /Two resume variants/,
  });
  await expect(resumes).not.toBeChecked();
  await resumes.check();

  await expect
    .poll(() => db.rows.find((r) => r.item_key === "2026-07.resumes")?.completed_at)
    .toBeTruthy();
});

test("a pre-ticked criterion loads as checked", async ({ page }) => {
  const db = new FakeRoadmapDb([tickRow("2026-07.design_doc")]);
  await load(page, db);

  await page.getByRole("button", { name: /July 2026/ }).click();
  await expect(
    page.getByRole("checkbox", { name: /Flagship design doc/ }),
  ).toBeChecked();
});

test("a past month with unmet criteria shows as missed, not rolled forward", async ({
  page,
}) => {
  // The red ring. The one thing the page must never soften: a roadmap that hides
  // an incomplete month is how you drift a semester without noticing.
  //
  // The clock is frozen because the roadmap STARTS in July 2026 and the suite
  // currently runs in July 2026 — so with the real clock no month has passed yet
  // and `missed` is unreachable. Pinning October makes Jul/Aug/Sep genuinely past.
  await page.clock.install({ time: new Date("2026-10-15T09:00:00") });
  await load(page, new FakeRoadmapDb());

  await expect(
    page.getByRole("button", { name: /July 2026/ }),
  ).toHaveAttribute("aria-label", /Missed/);
  await expect(
    page.getByRole("button", { name: /October 2026/ }),
  ).toHaveAttribute("aria-label", /In progress/);
  await expect(
    page.getByRole("button", { name: /December 2026/ }),
  ).toHaveAttribute("aria-label", /Upcoming/);
});

test("the readiness radar renders and a level can be claimed", async ({ page }) => {
  const db = new FakeRoadmapDb();
  await load(page, db);

  const radar = page.getByRole("region", { name: "Graduation readiness" });
  await expect(radar).toBeVisible();
  await expect(
    radar.getByRole("img", { name: /Readiness radar/ }),
  ).toBeVisible();

  await radar
    .getByRole("group", { name: "Algorithms level" })
    .getByRole("button", { name: "Strong" })
    .click();

  await expect
    .poll(() => db.rows.find((r) => r.item_key === "algorithms")?.level)
    .toBe("strong");
});
