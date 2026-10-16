import type { ChartSpec } from "./chartBlock";

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
