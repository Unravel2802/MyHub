import { describe, expect, it } from "vitest";
import {
  formatCents,
  parseAmount,
  sumCents,
} from "@/src/modules/finance/money";

describe("parseAmount", () => {
  it("parses dollars-and-cents strings to integer cents", () => {
    expect(parseAmount("12.50")).toBe(1250);
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("0.09")).toBe(9);
    expect(parseAmount(".5")).toBe(50);
  });

  it("strips $, commas and whitespace", () => {
    expect(parseAmount(" $1,234.56 ")).toBe(123456);
  });

  it("rounds to the nearest cent", () => {
    expect(parseAmount("12.999")).toBe(1300);
  });

  it("returns null on invalid or negative input", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("1.2.3")).toBeNull();
    expect(parseAmount(".")).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats integer cents as a money string", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(9)).toBe("$0.09");
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(0)).toBe("$0.00");
  });

  it("handles negatives (net cash flow)", () => {
    expect(formatCents(-1250)).toBe("-$12.50");
  });
});

describe("sumCents", () => {
  it("sums in integer cents without float drift", () => {
    expect(sumCents([10, 20, 3])).toBe(33);
    expect(sumCents([])).toBe(0);
  });
});
