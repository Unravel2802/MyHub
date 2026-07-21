import { expect, test } from "./fixtures";
import {
  designDrillAttemptRow,
  designDrillRow,
  FakeDesignDrillsDb,
  mockSupabaseDesignDrills,
} from "./supabaseDesignDrillsMock";

const editorialDetail = {
  summary:
    "A URL shortener is a **read-heavy key-value lookup** with code generation on the write path.",
  sections: [
    {
      id: "requirements",
      heading: "Requirements",
      body: "- Resolve short codes quickly\n- Keep codes unique",
    },
    {
      id: "key-generation",
      heading: "Key generation",
      body: "Use **Base62** over independently allocated integer ranges.",
    },
  ],
  estimates: [
    {
      label: "Read throughput",
      value: "~12K rps",
      note: "10:1 read:write skew",
    },
  ],
  references: [
    { label: "Base62 encoding", url: "https://en.wikipedia.org/wiki/Base62" },
  ],
};

function seededDb() {
  return new FakeDesignDrillsDb([
    designDrillRow({
      id: "url-shortener",
      title: "URL Shortener",
      solution_detail: editorialDetail,
    }),
    designDrillRow({
      id: "feature-store",
      title: "ML Feature Store",
      slug: "ml-feature-store",
      category: "ml_system_design",
      difficulty: "core",
      prompt: "Design an online and offline feature store.",
      solution: "Separate offline computation from low-latency online serving.",
    }),
  ]);
}

async function load(
  page: Parameters<typeof mockSupabaseDesignDrills>[0],
  db: FakeDesignDrillsDb,
) {
  await mockSupabaseDesignDrills(page, db);
  await page.goto("/design-drills");
  await expect(
    page.getByRole("heading", { name: "Design Drills", exact: true }).last(),
  ).toBeVisible();
}

test("lists seeded drills and opens the structured editorial", async ({
  page,
}) => {
  const db = seededDb();
  db.attempts.push(
    designDrillAttemptRow({
      id: "past-attempt",
      drill_id: "url-shortener",
      completed_at: new Date().toISOString(),
      duration_sec: 900,
      self_rating: "solid",
    }),
  );
  await load(page, db);

  await expect(
    page.getByRole("button", { name: "URL Shortener" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ML Feature Store" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "URL Shortener" }).click();
  await expect(
    page.getByRole("heading", { name: "Your past attempts" }),
  ).toBeVisible();

  const promptTab = page.getByRole("tab", { name: "Prompt" });
  const solutionTab = page.getByRole("tab", { name: "Solution" });
  await expect(promptTab).toHaveAttribute("aria-selected", "true");
  await promptTab.press("ArrowRight");
  await expect(solutionTab).toBeFocused();
  await expect(solutionTab).toHaveAttribute("aria-selected", "true");
  const solutionPanel = page.getByRole("tabpanel");
  await expect(solutionPanel).toContainText(
    "A URL shortener is a read-heavy key-value lookup",
  );
  await expect(
    solutionPanel.getByRole("navigation", { name: "Solution outline" }),
  ).toBeVisible();
  await expect(
    solutionPanel.getByRole("link", { name: "2. Key generation" }),
  ).toHaveAttribute("href", "#key-generation");
  await expect(
    solutionPanel.getByRole("heading", { name: "Key generation" }),
  ).toBeVisible();
  await expect(solutionPanel).toContainText("Read throughput");
  await expect(solutionPanel).toContainText("~12K rps");
  await expect(
    solutionPanel
      .locator("strong")
      .filter({ hasText: "read-heavy key-value lookup" }),
  ).toHaveText("read-heavy key-value lookup");
});

test("falls back to the pre-wrapped legacy solution", async ({ page }) => {
  const db = seededDb();
  await load(page, db);

  await page.getByRole("button", { name: "ML Feature Store" }).click();
  await page.getByRole("tab", { name: "Solution" }).click();

  const solutionPanel = page.getByRole("tabpanel");
  await expect(solutionPanel).toContainText(
    "Separate offline computation from low-latency online serving.",
  );
  await expect(solutionPanel.locator(".whitespace-pre-wrap")).toBeVisible();
  await expect(
    solutionPanel.getByRole("navigation", { name: "Solution outline" }),
  ).toHaveCount(0);
});

test("runs a timed attempt and persists the self-grade", async ({ page }) => {
  const db = seededDb();
  await load(page, db);
  await page.getByRole("button", { name: "URL Shortener" }).click();
  await page.getByRole("button", { name: "Start timed attempt" }).click();

  const timer = page.getByRole("timer");
  await expect(timer).toBeVisible();
  await expect.poll(async () => timer.textContent()).not.toBe("00:00");

  const promptTab = page.getByRole("tab", { name: "Prompt" });
  const solutionTab = page.getByRole("tab", { name: "Solution" });
  await expect(promptTab).toHaveAttribute("aria-selected", "true");
  await solutionTab.click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "A URL shortener is a read-heavy key-value lookup",
  );
  await promptTab.click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Design a URL shortener",
  );

  await page
    .getByLabel("Your design (scratchpad)")
    .fill("Use Base62 IDs and cache hot redirects.");
  await page.getByRole("button", { name: "Submit & self-grade" }).click();
  await expect(
    page.getByRole("heading", { name: "Self-grade against the rubric" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Covers key generation" }).check();
  await page.getByRole("radio", { name: /Solid/ }).check();
  await page.getByRole("button", { name: "Finish attempt" }).click();

  await expect.poll(() => db.attempts).toHaveLength(1);
  await expect
    .poll(() => db.attempts[0])
    .toMatchObject({
      completed_at: expect.any(String),
      notes: "Use Base62 IDs and cache hot redirects.",
      rubric_hits: [0],
      self_rating: "solid",
    });
  await expect(
    page.getByRole("button", { name: "URL Shortener" }),
  ).toBeVisible();
});

test("rolls back a failed timed-attempt create", async ({ page }) => {
  const db = seededDb();
  db.failNext("design_drill_attempts", "POST");
  await load(page, db);

  const row = page.getByRole("listitem").filter({ hasText: "URL Shortener" });
  await row.getByRole("button", { name: "Start drill" }).click();

  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toBeVisible();
  await expect.poll(() => db.attempts).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "URL Shortener" }),
  ).toBeVisible();
});
