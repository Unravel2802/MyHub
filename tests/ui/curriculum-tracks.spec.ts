import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "./fixtures";
import {
  FakeCurriculumDb,
  mockSupabaseCurriculum,
} from "./supabaseCurriculumMock";

const contentRoot = path.join(process.cwd(), "content/curriculum");
// Extend the distributed allowlist as later batches are augmented.
const EXERCISE_TRACKS = [
  "systems-design",
  "distributed.fundamentals",
  "distributed.rpc",
  "distributed.time",
  "distributed.replication",
  "distributed.partitioning",
  "distributed.consistency",
  "distributed.consensus",
  "distributed.transactions",
  "distributed.messaging",
  "distributed.coordination",
  "distributed.load-balancing",
  "distributed.failure",
  "distributed.batch-stream",
  "distributed.membership",
  "distributed.crdt",
  "distributed.scheduling",
  "foundations.programming",
  "foundations.data-structures",
  "foundations.algorithms",
  "foundations.architecture",
  "foundations.compilers",
  "foundations.complexity",
  "foundations.computability",
  "foundations.concurrency",
  "foundations.databases",
  "foundations.discrete-math",
  "foundations.information-theory",
  "foundations.memory-management",
  "foundations.networking",
  "foundations.numbers",
  "foundations.os",
  "foundations.randomized",
  "foundations.strings",
  "foundations.systems-programming",
  "craft.ai-assisted",
  "craft.architecture-styles",
  "craft.build-tooling",
  "craft.clean-code",
  "craft.code-review",
  "craft.debugging",
  "craft.design-patterns",
  "craft.docs",
  "craft.error-handling",
  "craft.formal-methods",
  "craft.functional",
  "craft.licensing",
  "craft.oop-design",
  "craft.performance",
  "craft.property-testing",
  "craft.refactoring",
  "craft.tdd",
  "craft.testing",
  "craft.type-design",
  "craft.version-control",
  "backend.api-hardening",
  "backend.auth",
  "backend.caching",
  "backend.event-sourcing",
  "backend.files",
  "backend.graphql-grpc",
  "backend.http",
  "backend.integrations",
  "backend.jobs-scheduling",
  "backend.migrations",
  "backend.multitenancy",
  "backend.nosql",
  "backend.queues",
  "backend.realtime",
  "backend.rest",
  "backend.search",
  "backend.serialization",
  "backend.services",
  "backend.sql",
  "backend.time-money",
  "backend.transactions",
  "frontend.a11y",
  "frontend.animation",
  "frontend.browser",
  "frontend.build",
  "frontend.data-fetching",
  "frontend.forms",
  "frontend.graphics",
  "frontend.html-css",
  "frontend.i18n",
  "frontend.javascript",
  "frontend.mobile",
  "frontend.offline",
  "frontend.performance",
  "frontend.react",
  "frontend.rendering",
  "frontend.routing",
  "frontend.state",
  "frontend.styling",
  "frontend.testing",
  "frontend.typescript",
  "infra.capacity-cost",
  "infra.cicd",
  "infra.cloud",
  "infra.containers",
  "infra.database-ops",
  "infra.iac",
  "infra.incidents",
  "infra.linux",
  "infra.networking-ops",
  "infra.observability",
  "infra.orchestration",
  "infra.platform",
  "infra.reliability",
  "infra.serverless-edge",
  "infra.service-mesh",
];
const tracks = [
  { prefix: "systems-design", expectedChapters: 18 },
  {
    prefix: "distributed",
    topics: [
      "fundamentals",
      "rpc",
      "time",
      "replication",
      "partitioning",
      "consistency",
      "consensus",
      "transactions",
      "messaging",
      "coordination",
      "load-balancing",
      "failure",
      "batch-stream",
      "membership",
      "crdt",
      "scheduling",
    ],
    expectedChapters: 83,
  },
  {
    prefix: "foundations",
    expectedChapters: 28,
  },
  { prefix: "craft", expectedChapters: 20 },
  { prefix: "backend", expectedChapters: 22 },
  { prefix: "frontend", expectedChapters: 20 },
  { prefix: "infra", expectedChapters: 15 },
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
    if (
      EXERCISE_TRACKS.some(
        (prefix) =>
          chapter.topic === prefix || chapter.topic.startsWith(`${prefix}.`),
      )
    ) {
      await expect(
        page.getByRole("complementary", { name: "Why this matters" }),
      ).toBeVisible();
      await expect(
        page.getByRole("complementary", {
          name: "By the end you'll be able to",
        }),
      ).toBeVisible();
      await expect(page.locator("[data-exercise-card]")).toHaveCount(3);
    }

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
