import { expect, test } from "./fixtures";

const PAGES = [
  "/dashboard",
  "/",
  "/prep",
  "/applications",
  "/outreach",
  "/achievements",
  "/review",
  "/offers",
  "/notes",
  "/finance",
  "/design-drills",
  "/design-drills/url-shortener",
];

test.use({ viewport: { width: 390, height: 844 } });

for (const path of PAGES) {
  test(`no horizontal overflow at 390px: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1200);

    // The reference-implementation code tabs only render on the Solution
    // tab, and only there does an unwrapped `pre` line get long enough to
    // trigger a CSS Grid auto-sizing blowout (a nested `grid` item without
    // `min-w-0` grows to its content's min-content width instead of
    // shrinking, and the whole section overflows instead of the `pre`'s own
    // overflow-x-auto scrolling) — so this path has to be exercised
    // explicitly, the default "Prompt" tab never shows code.
    const solutionTab = page.getByRole("tab", { name: "Solution" });
    if (await solutionTab.isVisible().catch(() => false)) {
      await solutionTab.click();
      await page.waitForTimeout(200);
    }

    const result = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const culprits: { tag: string; cls: string; w: number }[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        // Ignore anything inside a deliberate horizontal scroller.
        if (el.closest(".overflow-x-auto")) continue;
        if (r.width > vw + 1) {
          culprits.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className?.toString?.() ?? "").slice(0, 60),
            w: Math.round(r.width),
          });
        }
      }
      return {
        vw,
        scrollWidth: document.body.scrollWidth,
        culprits: culprits.slice(0, 5),
      };
    });

    console.log(
      `${path} vw=${result.vw} scroll=${result.scrollWidth} ${JSON.stringify(result.culprits)}`,
    );
    expect(result.scrollWidth, `${path} overflows`).toBeLessThanOrEqual(
      result.vw + 1,
    );
  });
}
