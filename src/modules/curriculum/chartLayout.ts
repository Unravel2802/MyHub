import type { ChartSpec } from "./chartBlock";

export const CHART_DIMENSIONS = {
  viewBoxWidth: 620,
  minWidth: 600,
  fontSize: 13,
  rowHeight: 34,
  barHeight: 20,
  labelInset: 12,
  labelGap: 12,
  labelMinWidth: 80,
  labelMaxWidth: 240,
  valueWidth: 120,
  top: 20,
} as const;

export function chartAxisTitle(unit: string | null): string | null {
  // All other formatChartValue outputs already carry their unit on each tick.
  return unit?.startsWith("$") ? `USD${unit.slice(1)}` : null;
}

// Layout only: the parsed chart contract stays in chartBlock.ts. The initial
// estimate is replaced with loaded-font measurements in the browser.
export function chartLabelColumn(
  labels: readonly string[],
  measure: (label: string) => number = (label) =>
    Array.from(label).length * CHART_DIMENSIONS.fontSize * 0.65,
) {
  const width = Math.max(
    CHART_DIMENSIONS.labelMinWidth,
    Math.min(
      CHART_DIMENSIONS.labelMaxWidth,
      Math.max(0, ...labels.map(measure)),
    ),
  );
  const displayLabels = labels.map((label) => {
    if (measure(label) <= width) return label;
    const characters = Array.from(label);
    let low = 0;
    let high = characters.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (measure(`${characters.slice(0, mid).join("")}…`) <= width) low = mid;
      else high = mid - 1;
    }
    return `${characters.slice(0, low).join("").trimEnd()}…`;
  });
  const left = CHART_DIMENSIONS.labelInset + width + CHART_DIMENSIONS.labelGap;
  return {
    width,
    left,
    plotWidth:
      CHART_DIMENSIONS.viewBoxWidth - left - CHART_DIMENSIONS.valueWidth,
    displayLabels,
  };
}

export function chartLayout(spec: ChartSpec) {
  const values = spec.rows.flatMap((row) => [row.low, row.high]);
  let min: number;
  let max: number;
  let ticks: number[];
  if (spec.scale === "log") {
    const step = spec.unit === "ns" ? 3 : 1;
    const start = Math.floor(Math.log10(Math.min(...values)) / step) * step;
    const end = Math.max(
      start + step,
      Math.ceil(Math.log10(Math.max(...values)) / step) * step,
    );
    min = 10 ** start;
    max = 10 ** end;
    ticks = Array.from(
      { length: Math.round((end - start) / step) + 1 },
      (_, i) => 10 ** (start + i * step),
    );
  } else {
    const low = Math.min(0, ...values);
    const high = Math.max(0, ...values);
    const rough = (high - low || 1) / 4;
    const power = 10 ** Math.floor(Math.log10(rough));
    const step =
      ([1, 2, 2.5, 5, 10].find((size) => size * power >= rough) ?? 10) * power;
    min = Math.floor(low / step) * step;
    max = Math.ceil(high / step) * step;
    if (max === min) max = min + step * 4;
    ticks = Array.from(
      { length: Math.round((max - min) / step) + 1 },
      (_, i) => min + i * step,
    );
  }
  const ratio = (value: number) =>
    spec.scale === "log"
      ? (Math.log10(value) - Math.log10(min)) /
        (Math.log10(max) - Math.log10(min))
      : (value - min) / (max - min);
  return { ticks, ratio, baseline: spec.scale === "log" ? 0 : ratio(0) };
}
