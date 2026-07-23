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
    page.getByRole("link", { name: "URL Shortener", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ML Feature Store", exact: true }),
  ).toBeVisible();

  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
  await expect(page).toHaveURL("/design-drills/url-shortener");
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
  const sectionLink = solutionPanel.getByRole("link", {
    name: "2. Key generation",
  });
  await expect(sectionLink).toHaveAttribute("href", "#key-generation");
  await sectionLink.click();
  await expect(page).toHaveURL(
    /\/design-drills\/url-shortener#key-generation$/,
  );
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

test("switches solution code languages with click and keyboard navigation", async ({
  page,
}) => {
  const db = new FakeDesignDrillsDb([
    designDrillRow({
      id: "code-tabs-drill",
      title: "Code Tabs Drill",
      solution_detail: {
        ...editorialDetail,
        sections: [
          ...editorialDetail.sections,
          {
            id: "reference-implementation",
            heading: "Reference implementation",
            body: "Compare the same implementation across languages.",
            codeExamples: [
              {
                language: "cpp",
                label: "C++",
                code: "std::vector<int> ids;",
              },
              {
                language: "java",
                label: "Java",
                code: "List<Integer> ids = new ArrayList<>();",
              },
              {
                language: "python",
                label: "Python3",
                code: "ids: list[int] = []",
              },
            ],
          },
        ],
      },
    }),
  ]);
  await load(page, db);

  await page
    .getByRole("link", { name: "Code Tabs Drill", exact: true })
    .click();
  await page.getByRole("tab", { name: "Solution" }).click();

  const reference = page.locator("#reference-implementation");
  const tablist = reference.getByRole("tablist", {
    name: "Solution code examples",
  });
  const cppTab = tablist.getByRole("tab", { name: "C++" });
  const javaTab = tablist.getByRole("tab", { name: "Java" });
  const pythonTab = tablist.getByRole("tab", { name: "Python3" });

  await expect(cppTab).toHaveAttribute("aria-selected", "true");
  await expect(cppTab).toHaveAttribute("tabindex", "0");
  await expect(javaTab).toHaveAttribute("aria-selected", "false");
  await expect(javaTab).toHaveAttribute("tabindex", "-1");
  await expect(pythonTab).toHaveAttribute("aria-selected", "false");
  await expect(pythonTab).toHaveAttribute("tabindex", "-1");
  await expect(reference.getByRole("tabpanel")).toContainText(
    "std::vector<int> ids;",
  );

  await javaTab.click();
  await expect(javaTab).toHaveAttribute("aria-selected", "true");
  await expect(javaTab).toHaveAttribute("tabindex", "0");
  await expect(cppTab).toHaveAttribute("aria-selected", "false");
  await expect(cppTab).toHaveAttribute("tabindex", "-1");
  await expect(reference.getByRole("tabpanel")).toContainText(
    "List<Integer> ids = new ArrayList<>();",
  );

  await javaTab.press("ArrowRight");
  await expect(pythonTab).toBeFocused();
  await expect(pythonTab).toHaveAttribute("aria-selected", "true");
  await expect(pythonTab).toHaveAttribute("tabindex", "0");
  await expect(reference.getByRole("tabpanel")).toContainText(
    "ids: list[int] = []",
  );

  await pythonTab.press("ArrowRight");
  await expect(cppTab).toBeFocused();
  await expect(cppTab).toHaveAttribute("aria-selected", "true");
});

test("shows completed attempts newest first with saved notes and an improving rating trend", async ({
  page,
}) => {
  const db = seededDb();
  db.attempts.push(
    designDrillAttemptRow({
      id: "oldest-attempt",
      drill_id: "url-shortener",
      started_at: "2026-07-01T10:00:00.000Z",
      completed_at: "2026-07-01T10:30:00.000Z",
      duration_sec: 1800,
      notes: "Missed the cache invalidation story.",
      rubric_hits: [],
      self_rating: "weak",
    }),
    designDrillAttemptRow({
      id: "newest-attempt",
      drill_id: "url-shortener",
      started_at: "2026-07-03T10:00:00.000Z",
      completed_at: "2026-07-03T10:20:00.000Z",
      duration_sec: 1200,
      notes:
        "## Better design\n\nUsed **Base62 IDs** and a Redis hot-key cache.",
      rubric_hits: [0, 1],
      self_rating: "strong",
    }),
    designDrillAttemptRow({
      id: "middle-attempt",
      drill_id: "url-shortener",
      started_at: "2026-07-02T10:00:00.000Z",
      completed_at: "2026-07-02T10:25:00.000Z",
      duration_sec: 1500,
      notes: "Covered IDs but only sketched caching.",
      rubric_hits: [0],
      self_rating: "solid",
    }),
  );
  await load(page, db);

  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();

  const timeline = page.getByRole("list", {
    name: "Completed attempt timeline",
  });
  const attempts = timeline.locator(":scope > li");
  await expect(attempts).toHaveCount(3);
  await expect(attempts.nth(0)).toContainText("7/3/2026");
  await expect(attempts.nth(0)).toContainText("20:00");
  await expect(attempts.nth(0)).toContainText("Strong");
  await expect(attempts.nth(1)).toContainText("7/2/2026");
  await expect(attempts.nth(1)).toContainText("Solid");
  await expect(attempts.nth(2)).toContainText("7/1/2026");
  await expect(attempts.nth(2)).toContainText("Weak");

  await expect(
    page.getByRole("img", {
      name: "Self-rating trend, oldest to newest: weak, solid, strong",
    }),
  ).toBeVisible();

  const newestAttempt = attempts.nth(0);
  await expect(newestAttempt.getByLabel("Hit")).toHaveCount(2);
  await newestAttempt.getByText("View notes").click();
  await expect(
    newestAttempt.getByRole("heading", { name: "Better design" }),
  ).toBeVisible();
  await expect(newestAttempt.locator("strong")).toHaveText("Base62 IDs");

  const middleAttempt = attempts.nth(1);
  await expect(middleAttempt.getByLabel("Hit")).toHaveCount(1);
  await expect(middleAttempt.getByLabel("Missed")).toHaveCount(1);
});

test("falls back to the pre-wrapped legacy solution", async ({ page }) => {
  const db = seededDb();
  await load(page, db);

  await page
    .getByRole("link", { name: "ML Feature Store", exact: true })
    .click();
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
  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
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
    page.getByRole("heading", { name: "URL Shortener" }),
  ).toBeVisible();
});

test("keeps a long solution independently scrollable beside the scratchpad", async ({
  page,
}) => {
  const db = new FakeDesignDrillsDb([
    designDrillRow({
      id: "long-solution",
      title: "Long Solution Drill",
      solution_detail: {
        ...editorialDetail,
        sections: [
          ...editorialDetail.sections,
          {
            id: "long-deep-dive",
            heading: "Long deep dive",
            body: Array.from(
              { length: 30 },
              (_, index) =>
                `### Detail ${index + 1}\n\nExplain this design decision and its operational tradeoffs.`,
            ).join("\n\n"),
          },
        ],
      },
    }),
  ]);
  await load(page, db);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page
    .getByRole("link", { name: "Long Solution Drill", exact: true })
    .click();
  await page.getByRole("button", { name: "Start timed attempt" }).click();
  await page.getByRole("tab", { name: "Solution" }).click();

  const leftPane = page
    .getByRole("heading", { name: "Long Solution Drill" })
    .locator("xpath=ancestor::section[1]");
  const rightPane = page
    .getByLabel("Your design (scratchpad)")
    .locator("xpath=ancestor::section[1]");
  const leftBox = await leftPane.boundingBox();
  const rightBox = await rightPane.boundingBox();

  expect(leftBox).not.toBeNull();
  expect(rightBox).not.toBeNull();
  expect(leftBox!.height).toBeCloseTo(rightBox!.height, 0);

  const leftScroll = await leftPane.evaluate((element) => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(leftScroll.overflowY).toBe("auto");
  expect(leftScroll.scrollHeight).toBeGreaterThan(leftScroll.clientHeight);

  await page.evaluate(() => {
    window.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0);
  });
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  const outerScrollBefore = await page.evaluate(() => window.scrollY);
  const alignedRightBox = await rightPane.boundingBox();
  await leftPane.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect
    .poll(() => leftPane.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(outerScrollBefore);
  expect((await rightPane.boundingBox())?.y).toBeCloseTo(alignedRightBox!.y, 0);

  await leftPane.evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 900, height: 900 });
  const mobileLeftBox = await leftPane.boundingBox();
  const mobileRightBox = await rightPane.boundingBox();
  expect(mobileLeftBox).not.toBeNull();
  expect(mobileRightBox).not.toBeNull();
  expect(Math.abs(mobileRightBox!.x - mobileLeftBox!.x)).toBeLessThan(2);
  expect(mobileRightBox!.y).toBeGreaterThan(mobileLeftBox!.y);
  expect(
    await leftPane.evaluate((element) => getComputedStyle(element).overflowY),
  ).toBe("hidden");
});

test("pauses and resumes the attempt timer without counting paused time", async ({
  page,
}) => {
  const db = seededDb();
  await load(page, db);
  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
  await page.clock.install();
  await page.getByRole("button", { name: "Start timed attempt" }).click();

  const timer = page.getByRole("timer");
  await page.clock.fastForward(2_200);
  await expect(timer).toHaveText("00:02");

  await page.getByRole("button", { name: "Pause timer" }).click();
  await expect(
    page.getByRole("button", { name: "Resume timer" }),
  ).toBeVisible();
  await page.clock.fastForward(5_000);
  await expect(timer).toHaveText("00:02");

  await page.getByRole("button", { name: "Resume timer" }).click();
  await page.clock.fastForward(1_000);
  await expect(timer).toHaveText("00:03");

  await page.getByRole("button", { name: "Pause timer" }).click();
  await page.clock.fastForward(3_000);
  await expect(timer).toHaveText("00:03");
});

test("resets an empty scratchpad quietly and confirms before clearing notes", async ({
  page,
}) => {
  const db = seededDb();
  await load(page, db);
  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
  await page.getByRole("button", { name: "Start timed attempt" }).click();

  const scratchpad = page.getByLabel("Your design (scratchpad)");
  const reset = page.getByRole("button", { name: "Reset to default" });
  let dialogCount = 0;
  page.on("dialog", () => {
    dialogCount += 1;
  });

  await reset.click();
  await expect(scratchpad).toHaveValue("");
  expect(dialogCount).toBe(0);

  await scratchpad.fill("Keep this design unless I confirm.");
  const dismissDialog = page.waitForEvent("dialog");
  const dismissClick = reset.click();
  const dismissed = await dismissDialog;
  expect(dismissed.message()).toBe(
    "Reset the scratchpad? This clears what you've written.",
  );
  await dismissed.dismiss();
  await dismissClick;
  await expect(scratchpad).toHaveValue("Keep this design unless I confirm.");

  const acceptDialog = page.waitForEvent("dialog");
  const acceptClick = reset.click();
  const accepted = await acceptDialog;
  await accepted.accept();
  await acceptClick;
  await expect(scratchpad).toHaveValue("");
});

test("highlights code, renders line numbers, and remembers the language", async ({
  page,
}) => {
  const db = seededDb();
  await load(page, db);
  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
  await page.getByRole("button", { name: "Start timed attempt" }).click();

  const language = page.getByRole("combobox", { name: "Code language" });
  await expect(language).toHaveValue("markdown");
  await expect(language.getByRole("option", { name: "C++" })).toHaveAttribute(
    "value",
    "cpp",
  );
  await expect(
    language.getByRole("option", { name: "Python3" }),
  ).toHaveAttribute("value", "python");
  await language.selectOption("javascript");
  await page
    .getByLabel("Your design (scratchpad)")
    .fill("const cache = new Map();\nreturn cache;");

  const highlightedCode = page.locator(".code-pad code.language-javascript");
  await expect(highlightedCode).toHaveClass(/hljs/);
  await expect(highlightedCode.locator(".hljs-keyword")).toHaveCount(3);
  await expect(page.locator(".code-pad-line-number")).toHaveText(["1", "2"]);

  await page.reload();
  await page.getByRole("button", { name: "Start timed attempt" }).click();
  await expect(language).toHaveValue("javascript");
});

test("Tab indents the scratchpad instead of moving focus away", async ({
  page,
}) => {
  const db = seededDb();
  await load(page, db);
  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
  await page.getByRole("button", { name: "Start timed attempt" }).click();

  const scratchpad = page.getByLabel("Your design (scratchpad)");
  await scratchpad.fill("line one\nline two");
  await scratchpad.focus();
  await scratchpad.evaluate((el) =>
    (el as HTMLTextAreaElement).setSelectionRange(0, 0),
  );

  await page.keyboard.press("Tab");
  await expect(scratchpad).toHaveValue("  line one\nline two");
  await expect(scratchpad).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(scratchpad).toHaveValue("line one\nline two");
  await expect(scratchpad).toBeFocused();
});

test("Enter auto-indents the scratchpad like an editor", async ({ page }) => {
  const db = seededDb();
  await load(page, db);
  await page.getByRole("link", { name: "URL Shortener", exact: true }).click();
  await page.getByRole("button", { name: "Start timed attempt" }).click();

  const scratchpad = page.getByLabel("Your design (scratchpad)");

  // Plain line: new line inherits the same indentation, no change.
  await scratchpad.fill("  const x = 1;");
  await scratchpad.focus();
  await scratchpad.evaluate((el) => {
    const textarea = el as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  await page.keyboard.press("Enter");
  await expect(scratchpad).toHaveValue("  const x = 1;\n  ");

  // Opening a block indents one level deeper on the next line.
  await scratchpad.fill("  if (ok) {");
  await scratchpad.evaluate((el) => {
    const textarea = el as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  await page.keyboard.press("Enter");
  await expect(scratchpad).toHaveValue("  if (ok) {\n    ");

  // Typing the closing bracket on that now-empty indented line snaps back
  // to the block's own indent level instead of staying over-indented.
  await page.keyboard.type("}");
  await expect(scratchpad).toHaveValue("  if (ok) {\n  }");

  // Python-style trailing colon also opens a block.
  await scratchpad.fill("def f():");
  await scratchpad.evaluate((el) => {
    const textarea = el as HTMLTextAreaElement;
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  });
  await page.keyboard.press("Enter");
  await expect(scratchpad).toHaveValue("def f():\n  ");

  // Backspace on an empty indented line removes one full indent level.
  await page.keyboard.press("Backspace");
  await expect(scratchpad).toHaveValue("def f():\n");
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
    page.getByRole("link", { name: "URL Shortener", exact: true }),
  ).toBeVisible();
});

test("loads a known drill directly and shows not-found after loading an unknown slug", async ({
  page,
}) => {
  const db = seededDb();
  await mockSupabaseDesignDrills(page, db);

  await page.goto("/design-drills/url-shortener");
  await expect(
    page.getByRole("heading", { name: "URL Shortener" }),
  ).toBeVisible();
  await expect(page.getByText("Drill not found")).toHaveCount(0);

  await page.goto("/design-drills/does-not-exist");
  await expect(page.getByText("Drill not found")).toBeVisible();
  await expect(page.getByText("Loading drill…")).toHaveCount(0);
});

test("persists bookmarks and filters the drill bank", async ({ page }) => {
  const db = seededDb();
  await load(page, db);

  const bookmark = page.getByRole("button", {
    name: "Bookmark URL Shortener",
  });
  await bookmark.click();
  await expect.poll(() => db.bookmarks).toHaveLength(1);
  await expect(db.bookmarks[0]).toMatchObject({
    drill_id: "url-shortener",
    deleted_at: null,
  });
  await expect(
    page.getByRole("button", { name: "Remove URL Shortener bookmark" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Remove URL Shortener bookmark" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Bookmarked only" }).click();
  await expect(
    page.getByRole("link", { name: "URL Shortener", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ML Feature Store", exact: true }),
  ).toHaveCount(0);
});

test("searches drills by prompt and clears the query", async ({ page }) => {
  const db = seededDb();
  await load(page, db);

  const search = page.getByRole("searchbox", { name: "Search drills" });
  await search.fill("online and offline");
  await expect(
    page.getByRole("link", { name: "ML Feature Store", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "URL Shortener", exact: true }),
  ).toHaveCount(0);

  await search.fill("");
  await expect(
    page.getByRole("link", { name: "URL Shortener", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ML Feature Store", exact: true }),
  ).toBeVisible();
});

test("paginates and numbers filtered drills, then resets on filter change", async ({
  page,
}) => {
  const db = new FakeDesignDrillsDb(
    Array.from({ length: 12 }, (_, index) => {
      const position = index + 1;
      return designDrillRow({
        id: `pagination-drill-${position}`,
        title: `Pagination Drill ${String(position).padStart(2, "0")}`,
        category: position === 12 ? "ml_system_design" : "system_design",
      });
    }),
  );
  await load(page, db);

  await expect(
    page.getByRole("link", { name: "Pagination Drill 01", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pagination Drill 11", exact: true }),
  ).toHaveCount(0);

  const pagination = page.getByRole("navigation", { name: "Drill pages" });
  await expect(
    pagination.getByRole("button", { name: "Previous" }),
  ).toBeDisabled();
  await expect(pagination.getByRole("button", { name: "Next" })).toBeEnabled();
  await pagination.getByRole("button", { name: "Page 2" }).click();

  const eleventhRow = page
    .getByRole("link", { name: "Pagination Drill 11", exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(eleventhRow).toBeVisible();
  await expect(eleventhRow.getByText("11", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Pagination Drill 01", exact: true }),
  ).toHaveCount(0);
  await expect(
    pagination.getByRole("button", { name: "Page 2" }),
  ).toHaveAttribute("aria-current", "page");

  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption("ml_system_design");
  const filteredRow = page
    .getByRole("link", { name: "Pagination Drill 12", exact: true })
    .locator("xpath=ancestor::li[1]");
  await expect(filteredRow).toBeVisible();
  await expect(filteredRow.getByText("1", { exact: true })).toBeVisible();
  await expect(pagination).toHaveCount(0);
});

test("shows coverage and links new and overdue drills in the review queue", async ({
  page,
}) => {
  const db = seededDb();
  const fourDaysAgo = new Date(
    Date.now() - 4 * 24 * 60 * 60 * 1000,
  ).toISOString();
  db.attempts.push(
    designDrillAttemptRow({
      id: "due-url-shortener",
      drill_id: "url-shortener",
      started_at: fourDaysAgo,
      completed_at: fourDaysAgo,
      duration_sec: 1200,
      self_rating: "weak",
    }),
  );
  await load(page, db);

  await expect(page.getByRole("heading", { name: "Coverage" })).toBeVisible();
  await expect(page.getByText("1 / 2", { exact: true })).toBeVisible();
  const weakCard = page.getByText("Weak", { exact: true }).locator("..");
  await expect(weakCard.getByText("1", { exact: true })).toBeVisible();

  await expect(
    page.getByRole("heading", { name: "Revisit weak drills" }),
  ).toBeVisible();
  await expect(page.getByText("New", { exact: true })).toBeVisible();
  await expect(page.getByText("Overdue 2d", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review ML Feature Store: New" }),
  ).toHaveAttribute("href", "/design-drills/ml-feature-store");
  await expect(
    page.getByRole("link", { name: "Review URL Shortener: Overdue 2d" }),
  ).toHaveAttribute("href", "/design-drills/url-shortener");
});

test("shows all caught up when every drill is still inside its review interval", async ({
  page,
}) => {
  const db = seededDb();
  const completedAt = new Date().toISOString();
  db.attempts.push(
    designDrillAttemptRow({
      id: "recent-url-shortener",
      drill_id: "url-shortener",
      completed_at: completedAt,
      self_rating: "strong",
    }),
    designDrillAttemptRow({
      id: "recent-feature-store",
      drill_id: "feature-store",
      completed_at: completedAt,
      self_rating: "strong",
    }),
  );
  await load(page, db);

  await expect(page.getByText("2 / 2", { exact: true })).toBeVisible();
  await expect(page.getByText("All caught up", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Nothing needs another rep today.", { exact: true }),
  ).toBeVisible();
});
