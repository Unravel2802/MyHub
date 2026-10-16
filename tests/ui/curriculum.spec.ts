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

// The "topic with no material" empty state used to be pinned here, pointed
// at whichever track hadn't been written yet on the real, live content
// directory — repointed three times (Algorithms, then Security Foundations,
// then Analytical Data Modeling) as tracks finished. Now that all 228 topics
// have chapters, there's no genuinely unwritten topic left to point it at,
// and there never needs to be one again: the empty state is pure rendering
// logic (`EmptyState` when `state.lessons.length === 0`), covered directly
// with a synthetic index in
// src/modules/curriculum/components/TopicChapters.test.tsx — no real
// content, browser, or live topic required.

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

// PR A regression cases. Existing curriculum cases above remain unchanged.
import { readFileSync } from "node:fs";
import path from "node:path";

const ESTIMATION = "/curriculum/systems-design.estimation/01-back-of-envelope";
const estimationSource = readFileSync(
  path.join(
    process.cwd(),
    "content/curriculum/systems-design.estimation/01-back-of-envelope.md",
  ),
  "utf8",
);
const textFenceCount = estimationSource
  .split("\n")
  .filter((line) => /^```text\s*$/.test(line)).length;
const sectionHeadings: string[] = [];
let insideFence = false;
for (const line of estimationSource.split("\n")) {
  if (/^```/.test(line)) insideFence = !insideFence;
  else if (!insideFence && line.startsWith("## "))
    sectionHeadings.push(line.slice(3));
}

async function openEstimation(
  page: Parameters<typeof mockSupabaseCurriculum>[0],
) {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  await page.goto(ESTIMATION);
  await expect(
    page.getByRole("heading", {
      name: "Back-of-envelope estimation",
      exact: true,
    }),
  ).toBeVisible();
}

test("estimation renders every text fence as a numbered figure with its section caption", async ({
  page,
}) => {
  await openEstimation(page);
  const figures = page.locator("[data-curriculum-reader] figure");
  await expect(figures).toHaveCount(textFenceCount);
  // Playwright's ARIA snapshot omits generated counters. Chromium's full
  // accessibility tree exposes their resolved text, so verify the real 1..n.
  const cdp = await page.context().newCDPSession(page);
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const textIn = (id: string): string => {
    const node = byId.get(id);
    if (node?.role?.value === "StaticText") return node.name?.value ?? "";
    return (node?.childIds ?? []).map(textIn).join("");
  };
  const renderedFigures = nodes.filter((node) => node.role?.value === "figure");
  expect(renderedFigures).toHaveLength(textFenceCount);
  renderedFigures.forEach((figure, index) => {
    expect(textIn(figure.nodeId)).toContain(`FIG ${index + 1}`);
  });
  await cdp.detach();
  await expect(figures.first().locator("figcaption")).toContainText(
    "The numbers to memorise",
  );
  await expect(
    figures.first().getByRole("button", { name: "Copy", exact: true }),
  ).toBeVisible();
  const lines = figures.first().locator(".whitespace-pre");
  const heights = await lines.evaluateAll((elements) =>
    elements.map((element) => element.getBoundingClientRect().height),
  );
  expect(Math.min(...heights)).toBeGreaterThan(20);
});

test("estimation TOC includes each section and recap, and tracks the clicked heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEstimation(page);
  const toc = page
    .locator("aside")
    .getByRole("navigation", { name: "Chapter contents" });
  await expect(toc.getByRole("link")).toHaveCount(sectionHeadings.length);
  for (const heading of sectionHeadings)
    await expect(
      toc.getByRole("link", { name: heading, exact: true }),
    ).toHaveCount(1);
  const worked = toc.getByRole("link", {
    name: "A worked example",
    exact: true,
  });
  await worked.click();
  await expect(worked).toHaveAttribute("aria-current", "location");
  const heading = page.getByRole("heading", {
    name: "A worked example",
    exact: true,
  });
  await expect(heading).toBeInViewport();
  expect(
    await heading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeLessThan(150);
});

test("estimation progress is half full at the midpoint of the article", async ({
  page,
}) => {
  await openEstimation(page);
  await page.locator("[data-curriculum-reader]").evaluate((article) => {
    const rect = article.getBoundingClientRect();
    window.scrollTo(
      0,
      window.scrollY + rect.top + (rect.height - window.innerHeight) / 2,
    );
  });
  await expect
    .poll(() =>
      page
        .locator("[data-reading-progress]")
        .evaluate((bar) => new DOMMatrix(getComputedStyle(bar).transform).a),
    )
    .toBeGreaterThan(0.35);
  await expect
    .poll(() =>
      page
        .locator("[data-reading-progress]")
        .evaluate((bar) => new DOMMatrix(getComputedStyle(bar).transform).a),
    )
    .toBeLessThan(0.65);
});

test("estimation recap has six numbered takeaways and finishes the chapter", async ({
  page,
}) => {
  await openEstimation(page);
  await expect(
    page.locator("[data-chapter-recap]").getByRole("listitem"),
  ).toHaveCount(6);
  await page.getByRole("button", { name: "Mark as read", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Read", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Chapter complete", exact: true }),
  ).toBeVisible();
});

test("estimation has an opening mobile chapter disclosure at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEstimation(page);
  const disclosure = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "In this chapter" }) });
  await expect(disclosure).toBeVisible();
  await disclosure.locator("summary").click();
  await expect(disclosure).toHaveAttribute("open", "");
  await expect(
    disclosure.getByRole("link", { name: "A worked example", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("figure Copy reports success, resets, and selects text if clipboard fails", async ({
  page,
}) => {
  await openEstimation(page);
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => {} },
    }),
  );
  const figure = page.locator("figure").first();
  await figure.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    figure.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  await expect(
    figure.getByRole("button", { name: "Copy", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    }),
  );
  await figure.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    figure.getByRole("button", { name: "Text selected", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => window.getSelection()?.toString()),
  ).toContain("TIME");
  await expect(
    figure.getByRole("button", { name: "Copy", exact: true }),
  ).toBeVisible();
});

// PR B additions. All existing reader and responsive assertions stay unchanged.
test("estimation charts render SVG and latency rows expose keyboard and hover tooltips", async ({
  page,
}) => {
  await openEstimation(page);
  await expect(
    page.locator("[data-curriculum-reader] svg[role='img']"),
  ).toHaveCount(2);
  const latency = page.getByRole("region", {
    name: "The latency ladder, log scale",
    exact: true,
  });
  const rows = latency.locator("[data-chart-row]");
  await rows.nth(1).focus();
  await expect(latency.getByRole("tooltip")).toContainText(
    "main memory: 100 ns",
  );
  await expect(latency.getByRole("tooltip")).toContainText(
    "100× the first row",
  );
  await rows.nth(1).press("Tab");
  await expect(latency.getByRole("tooltip")).toContainText("SSD read: 100 µs");
  await rows.nth(2).blur();
  await rows.nth(3).hover();
  await expect(latency.getByRole("tooltip")).toContainText(
    "same-DC round trip: 0.5 ms",
  );
  const egress = page.getByRole("region", {
    name: "Monthly egress for 40 TB/day of media",
    exact: true,
  });
  await expect(egress.locator('svg[role="img"]')).toHaveAttribute(
    "role",
    "img",
  );
  await expect(egress.locator('svg[role="img"]')).toHaveAttribute(
    "aria-label",
    /CDN, 95% hits: \$10–20k/,
  );
  const screenshot = test.info().outputPath("latency-chart.png");
  await latency.screenshot({ path: screenshot });
  await test
    .info()
    .attach("latency-chart", { path: screenshot, contentType: "image/png" });
});

test("estimation calculator starts at chapter values and changes its partition verdict at 1M DAU", async ({
  page,
}) => {
  await openEstimation(page);
  const calculator = page.getByRole("region", {
    name: "Run the estimate yourself",
    exact: true,
  });
  for (const value of ["12k/s", "120k QPS", "110 TB", "40 TB"])
    await expect(calculator.getByText(value, { exact: true })).toBeVisible();
  const partition = calculator.locator('[data-verdict="partition"]');
  await expect(partition).toHaveAttribute("data-on", "true");
  await expect(partition).toContainText(
    "Writes exceed one Postgres primary → partition, or a different store",
  );
  const dau = calculator.getByRole("slider", {
    name: "Daily active users",
    exact: true,
  });
  await dau.focus();
  await dau.press("Home");
  await expect(dau).toHaveAttribute("aria-valuetext", "1M");
  await expect(partition).toHaveAttribute("data-on", "false");
  await expect(partition).toContainText("○");
});

test("estimation check-yourself uses a native disclosure and reveals its answer", async ({
  page,
}) => {
  await openEstimation(page);
  const check = page.locator("details").filter({
    has: page.locator("summary", { hasText: "A service gets 50M DAU" }),
  });
  const answer = check.getByText("20,000 QPS", { exact: true });
  await expect(answer).not.toBeVisible();
  await expect(check.locator("summary")).toContainText("Check yourself");
  await check.locator("summary").click();
  await expect(check).toHaveAttribute("open", "");
  await expect(answer).toBeVisible();
  await expect(check).not.toContainText("[!CHECK]");
});

test("estimation callouts keep their labels, inline formatting and marker-free copy", async ({
  page,
}) => {
  await openEstimation(page);
  const key = page.getByRole("complementary", {
    name: "Key point",
    exact: true,
  });
  await expect(key).toContainText("Key point");
  await expect(key.locator("strong")).toHaveText(
    "That last block is the point of the exercise.",
  );
  await expect(key).not.toContainText("[!KEY]");
  const pitfall = page.getByRole("complementary", {
    name: "Pitfall",
    exact: true,
  });
  await expect(pitfall).toContainText("Designing for the average.");
  await expect(pitfall).not.toContainText("[!PITFALL]");
  await expect(
    page.getByRole("complementary", { name: "In the interview", exact: true }),
  ).toContainText("Say each assumption out loud");
});

test("Raft keeps both entirely bold Key rule boxes", async ({ page }) => {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  await page.goto("/curriculum/distributed.consensus/03-raft-election-and-log");
  const rules = page
    .locator("[data-curriculum-reader] blockquote")
    .filter({ has: page.getByText("Key rule", { exact: true }) });
  await expect(rules).toHaveCount(2);
  await expect(rules.nth(0).locator("strong")).not.toBeEmpty();
  await expect(rules.nth(1).locator("strong")).not.toBeEmpty();
});

test("estimation charts scroll within their frames at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEstimation(page);
  const charts = page.locator("[data-curriculum-reader] svg[role='img']");
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all()) {
    const dimensions = await chart.evaluate((svg) => {
      const scroller = svg.parentElement!;
      return {
        svg: svg.getBoundingClientRect().width,
        scroll: scroller.scrollWidth,
        width: scroller.clientWidth,
        overflow: getComputedStyle(scroller).overflowX,
      };
    });
    expect(dimensions.svg).toBeGreaterThanOrEqual(560);
    expect(dimensions.scroll).toBeGreaterThan(dimensions.width);
    expect(dimensions.overflow).toBe("auto");
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

// PR C additions. Existing curriculum and responsive cases are untouched.
import { readdirSync } from "node:fs";

test("estimation renders the seeded Mermaid diagram and re-renders when dark mode is added", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("myhub-theme", "light"));
  await openEstimation(page);
  const diagram = page.locator("[data-mermaid-diagram]");
  await expect(diagram).toHaveCount(1);
  await expect(
    diagram.getByRole("region", { name: "A worked example", exact: true }),
  ).toContainText("DIAGRAM");
  const svg = diagram.locator("[data-mermaid-svg] > svg");
  await expect(svg).toBeVisible({ timeout: 20000 });
  await expect(svg).toContainText("Client");
  await expect(svg).toContainText("Postgres, partitioned");
  await expect(svg.locator("foreignObject")).toHaveCount(0);
  await expect(page.locator("[data-mermaid-error]")).toHaveCount(0);
  const beforeId = await svg.getAttribute("id");
  expect(beforeId).not.toContain(":");
  const node = svg.locator(".node rect").first();
  const beforeFill = await node.evaluate(
    (element) => getComputedStyle(element).fill,
  );
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await expect.poll(() => svg.getAttribute("id")).not.toBe(beforeId);
  await expect(svg).toBeVisible();
  await expect
    .poll(() => node.evaluate((element) => getComputedStyle(element).fill))
    .not.toBe(beforeFill);
  await expect(page.locator("[data-mermaid-error]")).toHaveCount(0);
  const screenshot = test.info().outputPath("mermaid-dark.png");
  await diagram.screenshot({ path: screenshot });
  await test
    .info()
    .attach("mermaid-dark", { path: screenshot, contentType: "image/png" });
});

test("a broken Mermaid diagram preserves its source and displays Diagram error", async ({
  page,
}) => {
  await page.goto("/test-only/curriculum-mermaid");
  const diagram = page.locator("[data-mermaid-error]");
  await expect(diagram).toBeVisible({ timeout: 20000 });
  await expect(
    diagram.getByText("Diagram error", { exact: true }),
  ).toBeVisible();
  await expect(diagram.locator("figure")).toContainText("flowchart LR");
  await expect(diagram.locator("figure")).toContainText("A[unterminated");
  await expect(diagram.locator("[data-mermaid-svg]")).toHaveCount(0);
  // Mermaid's temporary syntax-error SVG must be cleaned up too.
  await expect(page.locator("body > div[id^='dmermaid-']")).toHaveCount(0);
});

test("chapters without Mermaid make no Mermaid chunk request, with a positive control", async ({
  page,
}) => {
  // Chunk filenames are hashed. Discover the library chunks in the actual
  // production build using Mermaid's public API name; don't guess filenames.
  const chunkDir = path.join(process.cwd(), ".next/static/chunks");
  const mermaidChunks = new Set(
    readdirSync(chunkDir)
      .filter(
        (file) =>
          file.endsWith(".js") &&
          readFileSync(path.join(chunkDir, file), "utf8").includes(
            "mermaidAPI",
          ),
      )
      .map((file) => `/_next/static/chunks/${file}`),
  );
  expect(mermaidChunks.size).toBeGreaterThan(0);
  const requested: string[] = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (mermaidChunks.has(pathname)) requested.push(pathname);
  });
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  await page.goto(`/curriculum/${DS}/${CHAPTERS[1]}`);
  await expect(
    page.getByRole("heading", { name: "Hash tables", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisit later", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Flagged to revisit", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(requested).toEqual([]);
  // The same observer must detect the library when a diagram is present.
  await page.goto(ESTIMATION);
  await expect(page.locator("[data-mermaid-svg] > svg")).toBeVisible({
    timeout: 20000,
  });
  expect(requested.length).toBeGreaterThan(0);
});

test("wide Mermaid diagrams scroll inside their frame at 390px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEstimation(page);
  const svg = page.locator("[data-mermaid-svg] > svg");
  await expect(svg).toBeVisible({ timeout: 20000 });
  const geometry = await svg.evaluate((element) => {
    const scroller = element.closest("[data-mermaid-svg]")!.parentElement!;
    return {
      svg: element.getBoundingClientRect().width,
      width: scroller.clientWidth,
      scroll: scroller.scrollWidth,
      overflow: getComputedStyle(scroller).overflowX,
    };
  });
  expect(geometry.svg).toBeGreaterThan(geometry.width);
  expect(geometry.scroll).toBeGreaterThan(geometry.width);
  expect(geometry.overflow).toBe("auto");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("PR B follow-ups keep chart text readable, one focus stroke and inline disclosure labels", async ({
  page,
}) => {
  await openEstimation(page);
  const chart = page.getByRole("region", {
    name: "The latency ladder, log scale",
    exact: true,
  });
  const svg = chart.locator("svg[role='img']");
  expect(
    await svg.evaluate(
      (element) => (element as SVGSVGElement).viewBox.baseVal.width,
    ),
  ).toBe(620);
  const fontSizes = await svg.locator("text").evaluateAll((elements) =>
    elements.map((element) => {
      const matrix = (element as SVGTextElement).getScreenCTM()!;
      return (
        parseFloat(getComputedStyle(element).fontSize) *
        Math.hypot(matrix.a, matrix.b)
      );
    }),
  );
  expect(Math.min(...fontSizes)).toBeGreaterThanOrEqual(12);
  await expect(svg.locator("text").filter({ hasText: /^ns$/ })).toHaveCount(0);
  const row = chart.locator("[data-chart-row]").first();
  await row.focus();
  expect(
    await row.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).toBe("none");
  await expect(row.locator("rect").first()).toHaveAttribute(
    "stroke",
    "var(--track)",
  );
  const checkLabel = page
    .locator("details summary span")
    .filter({ hasText: /^Check yourself$/ })
    .first();
  expect(
    await checkLabel.evaluate((element) => getComputedStyle(element).display),
  ).toBe("inline");
});
