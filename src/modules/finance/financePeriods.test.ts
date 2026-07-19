import { describe, expect, it } from "vitest";
import {
  isInMonth,
  monthBounds,
  monthKeyOf,
} from "@/src/modules/finance/financePeriods";

describe("financePeriods", () => {
  // Local July 15, 2026 — constructed with local Y/M/D so the test exercises the
  // same local-time bucketing the code uses, not UTC parsing.
  const jul15 = new Date(2026, 6, 15);

  it("monthKeyOf returns the local yyyy-MM", () => {
    expect(monthKeyOf(jul15)).toBe("2026-07");
  });

  it("monthBounds returns the inclusive first and last day", () => {
    expect(monthBounds(jul15)).toEqual({
      firstDay: "2026-07-01",
      lastDay: "2026-07-31",
    });
  });

  it("isInMonth includes both boundaries and excludes neighbours", () => {
    expect(isInMonth("2026-07-01", jul15)).toBe(true);
    expect(isInMonth("2026-07-31", jul15)).toBe(true);
    expect(isInMonth("2026-06-30", jul15)).toBe(false);
    expect(isInMonth("2026-08-01", jul15)).toBe(false);
  });
});
