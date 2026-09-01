import { expect, test } from "./fixtures";
import {
  FakeCurriculumDb,
  mockSupabaseCurriculum,
  mockSupabaseCurriculumWriteFailure,
  readRow,
} from "./supabaseCurriculumMock";

// The curriculum map. The unit suite covers the layout and the rollups; these
// pin the things only a real browser can prove — that the upsert PostgREST
// actually sends is one Postgres will accept, that a tick survives a reload,
// and that a failed write rolls the tick back instead of leaving the page
// claiming progress the database never stored.

const DS = "foundations.data-structures";
// Every chapter of foundations.data-structures. The "completed topic" test
// below marks all of them, so this list has to stay in step with the directory
// — a chapter added there and not here silently turns that test into a
// partial-progress test that still passes.
const CHAPTERS = [
  "01-arrays-and-memory",
  "02-hash-tables",
  "03-trees-and-heaps",
  "04-linked-structures",
  "05-graphs",
  "06-choosing-a-data-structure",
];

// Match a graph node by its title attribute, anchored on the label.
//
// NOT getByRole with a loose /Algorithms/ — the catalog has three topics whose
// names contain that word, and a node's accessible name also carries its
// sr-only progress text. Both make a substring match ambiguous the moment a
// topic is added, which is a test that breaks for a reason unrelated to what it
// is checking.
function node(
  page: Parameters<typeof mockSupabaseCurriculum>[0],
  label: string,
) {
  return page.getByTitle(new RegExp(`^${label} \\u2014 `));
}

async function load(
  page: Parameters<typeof mockSupabaseCurriculum>[0],
  db: FakeCurriculumDb,
) {
  await mockSupabaseCurriculum(page, db);
  await page.goto("/curriculum");
  await expect(
    page.getByRole("heading", { name: "Learn the whole stack, in order" }),
  ).toBeVisible();
}

test("renders a node per topic in the selected track", async ({ page }) => {
  await load(page, new FakeCurriculumDb());

  await expect(node(page, "Data Structures")).toBeVisible();
  await expect(node(page, "Algorithms")).toBeVisible();
  // Switching tracks swaps the graph rather than appending to it.
  await page.getByRole("button", { name: /^Backend Engineering/ }).click();
  await expect(node(page, "Caching")).toBeVisible();
  await expect(node(page, "Data Structures")).toHaveCount(0);
});

test("a topic with no material says so instead of showing an empty list", async ({
  page,
}) => {
  await load(page, new FakeCurriculumDb());

  await node(page, "Algorithms").click();
  await expect(page.getByText("Nothing to read here yet")).toBeVisible();
});

test("marking a chapter read persists and survives a reload", async ({
  page,
}) => {
  const db = new FakeCurriculumDb();
  await load(page, db);

  await node(page, "Data Structures").click();
  await page
    .getByRole("button", { name: "Mark Arrays and the memory model read" })
    .click();

  // The write reached the database with a conflict target Postgres accepts —
  // the mock returns 42P10 otherwise, which would roll the tick back below.
  await expect.poll(() => db.keys()).toEqual([`${DS}/${CHAPTERS[0]}`]);

  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Mark Arrays and the memory model unread",
    }),
  ).toBeVisible();
});

test("a failed write rolls the tick back and shows a generic message", async ({
  page,
}) => {
  // The page must never keep showing progress the database refused. And the
  // banner must not leak the Postgres error — architecture rule 6.
  await mockSupabaseCurriculumWriteFailure(page, new FakeCurriculumDb());
  await page.goto("/curriculum");
  await node(page, "Data Structures").click();

  const tick = page.getByRole("button", {
    name: "Mark Arrays and the memory model read",
  });
  await tick.click();

  await expect(
    page.getByText("Something went wrong, please try again later."),
  ).toBeVisible();
  await expect(page.getByText(/relation "curriculum_progress"/)).toHaveCount(0);
  await expect(tick).toBeVisible();
});

test("a completed topic fills its progress bar and lights the track count", async ({
  page,
}) => {
  const db = new FakeCurriculumDb(
    CHAPTERS.map((chapter) => readRow(`${DS}/${chapter}`)),
  );
  await load(page, db);

  const dataStructures = node(page, "Data Structures");
  await expect(dataStructures).toContainText("Data Structures");
  await expect(
    dataStructures.getByText(
      `${CHAPTERS.length} of ${CHAPTERS.length} chapters read`,
    ),
  ).toBeAttached();
  // The track chip counts every chapter in the TRACK, not just this topic, so
  // assert the done half rather than pinning a total that moves whenever a
  // sibling topic gains material.
  await expect(
    page.getByRole("button", { name: /^CS Foundations/ }),
    // Lookbehind, not \b: the chip renders as "CS Foundations6/12" with no
    // separator, and there is no word boundary between "s" and "6".
  ).toContainText(new RegExp(`(?<!\\d)${CHAPTERS.length}/\\d+`));
});

test("a chapter opens as a readable page and can be marked read there", async ({
  page,
}) => {
  const db = new FakeCurriculumDb();
  await mockSupabaseCurriculum(page, db);
  await page.goto(`/curriculum/${DS}/${CHAPTERS[1]}`);

  // Level 2, not 1: AppShell owns the page's single h1. And exactly ONE
  // "Hash tables" heading — the chapter file opens with `# Hash tables`, which
  // stripLeadingTitle removes so it isn't rendered twice.
  await expect(page.getByRole("heading", { name: "Hash tables" })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Hash tables" }),
  ).toBeVisible();
  // The markdown actually rendered, rather than arriving as escaped text.
  await expect(
    page.getByRole("heading", { level: 2, name: "Collisions" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect.poll(() => db.keys()).toEqual([`${DS}/${CHAPTERS[1]}`]);
  await expect(page.getByRole("button", { name: "Read" })).toBeVisible();

  // Reading order: the footer offers the neighbours, not the map.
  await page.getByRole("link", { name: /Trees and heaps/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Trees and heaps" }),
  ).toBeVisible();
});

test("a chapter that does not exist 404s rather than rendering an empty page", async ({
  page,
}) => {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  const response = await page.goto(`/curriculum/${DS}/99-not-written`);
  expect(response?.status()).toBe(404);
});

test("a path-traversal lesson id does not read a file off disk", async ({
  page,
}) => {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  const response = await page.goto(
    "/curriculum/foundations.data-structures/..%2F..%2F..%2F.env.local",
  );
  expect(response?.status()).toBe(404);
});
