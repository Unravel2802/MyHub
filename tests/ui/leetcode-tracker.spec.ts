import { expect, test } from "./fixtures";
import { FakePrepDb, mockSupabasePrep } from "./supabasePrepMock";
import {
  FakeLeetCodeDb,
  leetCodeAttemptRow,
  leetCodeProblemRow,
  mockSupabaseLeetCode,
} from "./supabaseLeetCodeMock";

async function load(
  page: Parameters<typeof mockSupabaseLeetCode>[0],
  db: FakeLeetCodeDb,
) {
  await mockSupabasePrep(page, new FakePrepDb());
  await mockSupabaseLeetCode(page, db);
  await page.goto("/prep");
  await expect(
    page.getByRole("heading", { name: "LeetCode Tracker" }),
  ).toBeVisible();
}

test("logs an attempt, moves its problem on the board, and shows highlighted history", async ({
  page,
}) => {
  const db = new FakeLeetCodeDb([
    leetCodeProblemRow({
      id: "two-sum",
      title: "Two Sum",
      difficulty: "easy",
      tags: ["Array", "Hash Table"],
      status: "to_review",
    }),
  ]);
  await load(page, db);

  await page.getByRole("button", { name: "Two Sum", exact: true }).click();
  const attemptForm = page.getByRole("form", { name: "Log attempt" });
  await attemptForm.getByLabel("Time to solve (minutes)").fill("18");
  await attemptForm.getByLabel("Outcome").selectOption("partial");
  await attemptForm
    .getByLabel("Attempt notes")
    .fill("Missed the complement lookup on the first pass.");
  await attemptForm.getByLabel("Solution language").selectOption("javascript");
  await attemptForm
    .getByLabel("Solution code")
    .fill("const answer = new Map();\nreturn answer;");
  await attemptForm.getByRole("button", { name: "Log attempt" }).click();

  await expect.poll(() => db.attempts).toHaveLength(1);
  await page.getByRole("button", { name: "Back to problem bank" }).click();
  await page
    .getByRole("group", { name: "LeetCode view" })
    .getByRole("button", { name: "Board" })
    .click();

  const handle = page.getByRole("button", { name: "Drag Two Sum" });
  const target = page.getByRole("region", { name: "Needs revisit" });
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Expected board card and target column");

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    from.x + from.width / 2,
    from.y + from.height / 2 + 20,
    { steps: 5 },
  );
  await page.mouse.move(to.x + to.width / 2, to.y + 100, { steps: 12 });
  await page.mouse.up();

  await expect
    .poll(() => db.problems.find((problem) => problem.id === "two-sum")?.status)
    .toBe("needs_revisit");
  await target.getByRole("button", { name: "Two Sum", exact: true }).click();

  await expect(
    page.getByText("Missed the complement lookup on the first pass."),
  ).toBeVisible();
  await expect(page.getByText("18 min", { exact: true })).toBeVisible();
  await expect(page.locator("code.language-javascript")).toContainText(
    "const answer = new Map();",
  );
  await expect(
    page.locator("code.language-javascript .hljs-keyword"),
  ).toHaveCount(3);
});

test("logging an attempt counts toward Prep Tracker's algorithm checkpoint and monthly count", async ({
  page,
}) => {
  const db = new FakeLeetCodeDb([
    leetCodeProblemRow({ id: "two-sum", title: "Two Sum" }),
  ]);
  await load(page, db);

  const checkpointStat = page.getByText(/\/\d+ algorithms/);
  await expect(checkpointStat).toContainText("0/");
  const algorithmsTile = page
    .locator("section[aria-labelledby='scorecard-heading']")
    .getByText("Algorithms", { exact: true })
    .locator("..");
  await expect(algorithmsTile).toContainText("0");

  await page.getByRole("button", { name: "Two Sum", exact: true }).click();
  const attemptForm = page.getByRole("form", { name: "Log attempt" });
  await attemptForm.getByLabel("Outcome").selectOption("solved");
  await attemptForm.getByRole("button", { name: "Log attempt" }).click();
  await expect.poll(() => db.attempts).toHaveLength(1);

  await expect(checkpointStat).toContainText("1/");
  await expect(algorithmsTile).toContainText("1");
});

test("rolls back a failed attempt create", async ({ page }) => {
  const db = new FakeLeetCodeDb([
    leetCodeProblemRow({ id: "two-sum", title: "Two Sum" }),
  ]);
  db.failNext("leetcode_attempts", "POST");
  await load(page, db);

  await page.getByRole("button", { name: "Two Sum", exact: true }).click();
  const attemptForm = page.getByRole("form", { name: "Log attempt" });
  await attemptForm
    .getByLabel("Attempt notes")
    .fill("This optimistic row should disappear.");
  await attemptForm.getByRole("button", { name: "Log attempt" }).click();

  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toBeVisible();
  await expect(
    page.getByText("This optimistic row should disappear."),
  ).toHaveCount(0);
  expect(db.attempts).toHaveLength(0);
});

test("filters, sorts, and inline edits the problem table", async ({ page }) => {
  const db = new FakeLeetCodeDb(
    [
      leetCodeProblemRow({
        id: "two-sum",
        title: "Two Sum",
        difficulty: "easy",
        tags: ["Array"],
        status: "solved",
      }),
      leetCodeProblemRow({
        id: "median",
        title: "Median of Two Sorted Arrays",
        difficulty: "hard",
        tags: ["Binary Search"],
        status: "to_review",
      }),
    ],
    [
      leetCodeAttemptRow({
        id: "two-sum-new",
        problem_id: "two-sum",
        date: "2026-07-24",
      }),
      leetCodeAttemptRow({
        id: "two-sum-old",
        problem_id: "two-sum",
        date: "2026-07-20",
      }),
    ],
  );
  await load(page, db);

  const twoSumRow = page.getByRole("row").filter({ hasText: "Two Sum" });
  await expect(twoSumRow).toContainText("2");
  await expect(twoSumRow).toContainText("2026-07-24");

  const filters = page.getByRole("group", {
    name: "Filter LeetCode problems",
  });
  await filters.getByLabel("Difficulty").selectOption("hard");
  await expect(
    page.getByRole("button", { name: "Median of Two Sorted Arrays" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Two Sum", exact: true }),
  ).toHaveCount(0);

  await filters.getByLabel("Difficulty").selectOption("all");
  await filters.getByLabel("Tag").selectOption("Array");
  await expect(
    page.getByRole("button", { name: "Two Sum", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Median of Two Sorted Arrays" }),
  ).toHaveCount(0);
  await filters.getByLabel("Tag").selectOption("all");

  await page.getByLabel("Status for Two Sum").selectOption("in_progress");
  await expect
    .poll(() => db.problems.find((problem) => problem.id === "two-sum")?.status)
    .toBe("in_progress");

  await page.getByLabel("Tags for Two Sum").fill("Array, Two Pointers");
  await page.getByLabel("Tags for Two Sum").press("Enter");
  await expect
    .poll(() => db.problems.find((problem) => problem.id === "two-sum")?.tags)
    .toEqual(["Array", "Two Pointers"]);

  await page.getByRole("button", { name: "Attempts" }).click();
  await page.getByRole("button", { name: "Attempts" }).click();
  await expect(page.locator("tbody tr").first()).toContainText("Two Sum");

  const addForm = page.getByRole("form", { name: "Add problem" });
  await addForm.getByLabel("Problem title").fill("Valid Parentheses");
  await addForm.getByLabel("Difficulty").selectOption("easy");
  await addForm.getByLabel("Tags").fill("Stack");
  await addForm.getByRole("button", { name: "Add problem" }).click();
  await expect
    .poll(() =>
      db.problems.find((problem) => problem.title === "Valid Parentheses"),
    )
    .toBeTruthy();

  await page
    .getByRole("button", { name: "Valid Parentheses", exact: true })
    .click();
  await page.getByText("Edit problem details", { exact: true }).click();
  const editForm = page.getByRole("form", { name: "Edit problem" });
  await editForm.getByLabel("Problem title").fill("Valid Parentheses Revised");
  await editForm.getByRole("button", { name: "Save changes" }).click();
  await expect
    .poll(() =>
      db.problems.find(
        (problem) => problem.title === "Valid Parentheses Revised",
      ),
    )
    .toBeTruthy();
});
