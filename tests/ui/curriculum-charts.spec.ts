import { expect, test } from "./fixtures";

const longLabel =
  "Reservation across exceptionally long regional service boundaries";

test("chart labels fit inside their SVG and truncated labels retain full accessible tooltips", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/test-only/curriculum-chart");
  await page.evaluate(() => document.fonts.ready);
  const charts = page.getByRole("region");
  await expect(charts).toHaveCount(2);
  for (const chart of await charts.all()) {
    const svg = chart.locator("svg[role='img']");
    await expect(
      svg.getByText("In-process stock reservation", { exact: true }),
    ).toBeVisible();
    const truncated = svg.getByRole("group", {
      name: `${longLabel}:`,
      exact: false,
    });
    await expect(truncated.locator("[data-chart-label]")).toHaveText(/…$/);
    await truncated.focus();
    await expect(chart.getByRole("tooltip")).toContainText(longLabel);
    await truncated.blur();
    await truncated.hover();
    await expect(chart.getByRole("tooltip")).toContainText(longLabel);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() =>
          svg.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return Array.from(
              element.querySelectorAll("[data-chart-label]"),
            ).every((label) => {
              const bounds = label.getBoundingClientRect();
              return bounds.left >= box.left && bounds.right <= box.right;
            });
          }),
        )
        .toBe(true);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
});

test("chart axis titles only add currency context absent from tick labels", async ({
  page,
}) => {
  await page.goto("/test-only/curriculum-chart");
  const latency = page.getByRole("region", {
    name: "Inventory latency",
    exact: true,
  });
  await expect(
    latency.locator("svg text").filter({ hasText: /^ms$/ }),
  ).toHaveCount(0);
  await expect(
    latency.locator("svg text").filter({ hasText: /^0 ms$/ }),
  ).toHaveCount(1);
  const cost = page.getByRole("region", { name: "Monthly cost", exact: true });
  await expect(
    cost.locator("svg text").filter({ hasText: /^USD\/month$/ }),
  ).toHaveCount(1);
});
