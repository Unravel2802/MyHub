import { describe, expect, it } from "vitest";
import {
  formatChartRange,
  formatChartValue,
  parseChartBlock,
} from "./chartBlock";

describe("parseChartBlock", () => {
  it("parses headers, rows, ranges and labels containing a colon", () => {
    expect(
      parseChartBlock(
        "type: bar\nscale: log\nunit: $/month\ntitle: Costs\ncaption: Monthly\nhighlight: direct\n---\nregion: direct: 10000-20000\nCDN: 1e3",
      ),
    ).toEqual({
      ok: true,
      spec: {
        type: "bar",
        scale: "log",
        unit: "$/month",
        title: "Costs",
        caption: "Monthly",
        highlight: "direct",
        rows: [
          { label: "region: direct", low: 10000, high: 20000 },
          { label: "CDN", low: 1000, high: 1000 },
        ],
      },
    });
  });
  it.each([
    "type: bar\nscale: log\n---\nzero: 0",
    "type: bar\nrow: 1",
    `type: bar\n---\n${Array.from({ length: 13 }, (_, i) => `row ${i}: 1`).join("\n")}`,
    "type: pie\n---\nrow: 1",
    "type: bar\n---\nrange: 20-10",
    "type: bar\n---\nrow: 1,000",
    "type: bar\n---\nrow: 1e999",
  ])("rejects invalid chart %s", (source) =>
    expect(parseChartBlock(source).ok).toBe(false),
  );
  it("defaults to linear and accepts zero and negative ranges", () => {
    const result = parseChartBlock(
      "type: bar\n---\nzero: 0\nnegative: -20--10",
    );
    expect(result.ok && result.spec.scale).toBe("linear");
    expect(result.ok && result.spec.rows[1]).toEqual({
      label: "negative",
      low: -20,
      high: -10,
    });
  });
});

describe("formatChartValue", () => {
  it.each([
    [1, "ns", "1 ns"],
    [100000, "ns", "100 µs"],
    [500000, "ns", "0.5 ms"],
    [5000000, "ns", "5 ms"],
    [1e9, "ns", "1 s"],
    [96000, "$/month", "$96k"],
    [1.2e6, "$", "$1.2M"],
    [500, "B", "500 B"],
    [1000, "B", "1 KB"],
    [2e6, "B", "2 MB"],
    [3e9, "B", "3 GB"],
    [40e12, "B", "40 TB"],
    [1.2e15, "B", "1.2 PB"],
    [20000, "requests/s", "20k requests/s"],
    [500, null, "500"],
  ])("formats %s %s", (value, unit, expected) =>
    expect(formatChartValue(value, unit)).toBe(expected),
  );
  it("shares range suffixes", () => {
    expect(formatChartRange(10000, 20000, "$/month")).toBe("$10–20k");
    expect(formatChartRange(1e7, 2e7, "ns")).toBe("10–20 ms");
    expect(formatChartRange(1e4, 2e7, "$")).toBe("$10k–$20M");
  });
});
