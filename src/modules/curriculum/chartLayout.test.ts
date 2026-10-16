import { expect, it } from "vitest";
import { CHART_DIMENSIONS, chartAxisTitle, chartLayout } from "./chartLayout";
import { parseChartBlock } from "./chartBlock";

function layout(source: string) {
  const parsed = parseChartBlock(source);
  if (!parsed.ok) throw new Error(parsed.error);
  return chartLayout(parsed.spec);
}
it("places powers of 1000 at equal intervals on ns log charts", () => {
  const chart = layout(
    "type: bar\nscale: log\nunit: ns\n---\ncache: 1\ncross-region: 100000000",
  );
  expect(chart.ticks).toEqual([1, 1000, 1000000, 1000000000]);
  expect(chart.ratio(1000)).toBeCloseTo(1 / 3);
});
it("uses nice currency ticks and keeps negative bars on the correct side of zero", () => {
  expect(layout("type: bar\n---\ncost: 96000").ticks).toEqual([
    0, 25000, 50000, 75000, 100000,
  ]);
  const chart = layout("type: bar\n---\nloss: -20\ngain: 20");
  expect(chart.ratio(-20)).toBeLessThan(chart.baseline);
  expect(chart.ratio(20)).toBeGreaterThan(chart.baseline);
});
it("has a finite domain for a zero-only chart", () => {
  const chart = layout("type: bar\n---\nnone: 0");
  expect(Number.isFinite(chart.ratio(0))).toBe(true);
});

it("keeps chart text readable near 1:1 with distinct bars", () => {
  expect(CHART_DIMENSIONS.viewBoxWidth).toBe(620);
  expect(CHART_DIMENSIONS.rowHeight).toBe(34);
  expect(CHART_DIMENSIONS.barHeight).toBe(20);
  expect(CHART_DIMENSIONS.rowHeight - CHART_DIMENSIONS.barHeight).toBe(14);
  expect(
    (CHART_DIMENSIONS.fontSize * CHART_DIMENSIONS.minWidth) /
      CHART_DIMENSIONS.viewBoxWidth,
  ).toBeGreaterThanOrEqual(12);
});
it.each([
  ["ns", null],
  ["B", null],
  [null, null],
  ["$/month", "USD/month"],
  ["requests/s", "requests/s"],
])("only adds a useful axis title for %s", (unit, expected) => {
  expect(chartAxisTitle(unit)).toBe(expected);
});
