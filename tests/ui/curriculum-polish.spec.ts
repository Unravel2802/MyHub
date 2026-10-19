import { expect, test } from "./fixtures";
import {
  FakeCurriculumDb,
  mockSupabaseCurriculum,
} from "./supabaseCurriculumMock";

const payments =
  "/curriculum/systems-design.case-payments/01-payments-and-ledgers";

test("sequence message labels paint a surface backing beneath their text", async ({
  page,
}) => {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(payments);
  const label = page.locator("text.messageText").filter({
    hasText: "Charge with provider idempotency key",
  });
  await expect(label).toBeVisible();

  for (const dark of [false, true]) {
    await page.evaluate(
      (enabled) => document.documentElement.classList.toggle("dark", enabled),
      dark,
    );
    // A paint-order stroke is an opaque halo behind the foreground glyphs.
    // Check the rendered SVG, including the new token colour after re-theming.
    await expect
      .poll(() =>
        page.evaluate(() => {
          // Theme changes replace Mermaid's SVG. Query and inspect in one
          // synchronous callback so a detached old label cannot escape the poll.
          const text = Array.from(
            document.querySelectorAll<SVGTextElement>("text.messageText"),
          ).find((element) =>
            element.textContent?.includes(
              "Charge with provider idempotency key",
            ),
          );
          const frame = text
            ?.closest("[data-mermaid-diagram]")
            ?.querySelector("section");
          if (!text || !frame) return null;
          const style = getComputedStyle(text);
          const surface = getComputedStyle(frame).backgroundColor;
          return {
            surfaceBacking: style.stroke === surface,
            opaque: !["none", "transparent", "rgba(0, 0, 0, 0)"].includes(
              style.stroke,
            ),
            strokeWidth: style.strokeWidth,
            paintOrder: style.paintOrder,
          };
        }),
      )
      .toEqual({
        surfaceBacking: true,
        opaque: true,
        strokeWidth: "5px",
        paintOrder: "stroke",
      });
  }
});

test("payments mobile scroll hints sit below nodes and actors and hide at the end", async ({
  page,
}) => {
  await mockSupabaseCurriculum(page, new FakeCurriculumDb());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(payments);
  const diagrams = page.locator("[data-mermaid-diagram]");
  await expect(diagrams).toHaveCount(2);
  let checkedHints = 0;
  for (const diagram of await diagrams.all()) {
    const svg = diagram.locator("[data-mermaid-svg] > svg");
    await expect(svg).toBeVisible();
    // A visible hint also proves that the fit/measurement effects completed.
    const hint = diagram.locator("[data-mermaid-scroll-hint]");
    const viewport = diagram.locator("[data-mermaid-viewport]");
    const fade = diagram.locator("[data-mermaid-scroll-fade]");
    await expect
      .poll(() =>
        viewport.evaluate((frame) => frame.scrollWidth > frame.clientWidth + 1),
      )
      .toBe(true);
    await expect(hint).toBeVisible();
    await expect(fade).toBeVisible();
    await expect(fade).toHaveCSS("background-image", /linear-gradient/);
    await diagram.scrollIntoViewIfNeeded();
    const hintBox = (await hint.boundingBox())!;
    const frameBox = (await diagram.locator("section").boundingBox())!;
    expect(hintBox.x).toBeGreaterThanOrEqual(frameBox.x);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(
      frameBox.x + frameBox.width,
    );
    expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(
      frameBox.y + frameBox.height,
    );
    // Flow/state nodes and Mermaid's top/bottom sequence actor rectangles.
    const nodes = svg.locator("g.node, rect.actor");
    expect(await nodes.count()).toBeGreaterThan(0);
    for (const node of await nodes.all()) {
      const box = (await node.boundingBox())!;
      const overlaps =
        hintBox.x < box.x + box.width &&
        hintBox.x + hintBox.width > box.x &&
        hintBox.y < box.y + box.height &&
        hintBox.y + hintBox.height > box.y;
      expect(overlaps).toBe(false);
    }
    // The entire drawing, including labels, also ends above the cue row.
    const svgBox = (await svg.boundingBox())!;
    expect(hintBox.y).toBeGreaterThanOrEqual(svgBox.y + svgBox.height);
    checkedHints += 1;
    await viewport.evaluate((frame) => {
      frame.scrollLeft = frame.scrollWidth;
    });
    await expect(hint).toHaveCount(0);
    await expect(fade).toHaveCount(0);
  }
  expect(checkedHints).toBe(2);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
