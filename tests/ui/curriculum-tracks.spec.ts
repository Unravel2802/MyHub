import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import {
  FakeCurriculumDb,
  mockSupabaseCurriculum,
} from "./supabaseCurriculumMock";

const contentRoot = path.join(process.cwd(), "content/curriculum");
// Extend the distributed allowlist as later batches are augmented.
const tracks = [
  { prefix: "systems-design", expectedChapters: 18 },
  {
    prefix: "distributed",
    topics: ["fundamentals", "rpc", "time", "replication"],
    expectedChapters: 22,
  },
];
const chapters = tracks.flatMap((track) => {
  const chapters = readdirSync(contentRoot)
    .filter(
      (topic) =>
        topic.startsWith(`${track.prefix}.`) &&
        (!track.topics ||
          track.topics.some((id) => topic === `${track.prefix}.${id}`)),
    )
    .sort()
    .flatMap((topic) =>
      readdirSync(path.join(contentRoot, topic))
        .filter((file) => /^\d{2}-.+\.md$/.test(file))
        .sort()
        .map((file) => ({
          topic,
          lesson: file.replace(/\.md$/, ""),
          diagrams: (
            readFileSync(path.join(contentRoot, topic, file), "utf8").match(
              /^```mermaid\s*$/gm,
            ) ?? []
          ).length,
        })),
    );

  test(`${track.prefix} gate covers all ${track.expectedChapters} chapters`, () => {
    expect(chapters).toHaveLength(track.expectedChapters);
    if (track.prefix === "systems-design") {
      for (const chapter of chapters)
        expect(chapter.diagrams).toBeGreaterThan(0);
    }
  });
  return chapters;
});

for (const chapter of chapters) {
  test(`${chapter.topic}/${chapter.lesson}: visuals render and stay within the page`, async ({
    page,
  }) => {
    await mockSupabaseCurriculum(page, new FakeCurriculumDb());
    await page.setViewportSize({ width: 1440, height: 1000 });
    const response = await page.goto(
      `/curriculum/${chapter.topic}/${chapter.lesson}`,
    );
    expect(response?.ok()).toBe(true);
    await expect(page.locator("article")).toBeVisible();

    const diagrams = page.locator("[data-mermaid-diagram]");
    await expect(diagrams).toHaveCount(chapter.diagrams);
    for (const diagram of await diagrams.all()) {
      await expect(diagram.locator("[data-mermaid-svg] > svg")).toBeVisible();
      // Wait for the fit effect/ResizeObserver as well as Mermaid's render.
      // A hidden off-screen hint would still fail the count below.
      await expect
        .poll(() =>
          diagram.locator("[data-mermaid-viewport]").evaluate((frame) => {
            const svg = frame.querySelector("svg");
            return svg !== null && frame.scrollWidth <= frame.clientWidth + 1;
          }),
        )
        .toBe(true);
    }
    await expect(page.locator("[data-mermaid-error]")).toHaveCount(0);
    await expect(page.getByText(/Chart error|Widget not found/)).toHaveCount(0);
    await expect(page.getByText("Scroll →", { exact: true })).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);
    // Resizing must leave every diagram rendered, even when its own frame
    // scrolls. The document itself must never carry the overflow.
    await expect(page.locator("[data-mermaid-svg] > svg")).toHaveCount(
      chapter.diagrams,
    );
    await expect(page.locator("[data-mermaid-error]")).toHaveCount(0);
  });
}
