import { describe, expect, it } from "vitest";
import {
  DEFAULT_RISK_FRACTION,
  positionSize,
  riskBudgetCents,
  sharesForRisk,
} from "@/src/modules/trading/positionSizing";

describe("riskBudgetCents", () => {
  it("takes the configured fraction of the account", () => {
    // The source's own setup: $100 account, 2% → $2 at risk.
    expect(riskBudgetCents(10_000, DEFAULT_RISK_FRACTION)).toBe(200);
  });

  it("defaults to 2%", () => {
    expect(riskBudgetCents(10_000)).toBe(200);
  });

  it("rounds to a whole cent", () => {
    // 3333 × 0.02 = 66.66 → 67, because it is money that will be displayed.
    expect(riskBudgetCents(3_333)).toBe(67);
  });

  it("rejects a non-positive account", () => {
    expect(riskBudgetCents(0)).toBeNull();
    expect(riskBudgetCents(-100)).toBeNull();
  });

  it("rejects a fraction outside (0, 1]", () => {
    expect(riskBudgetCents(10_000, 0)).toBeNull();
    expect(riskBudgetCents(10_000, -0.02)).toBeNull();
    expect(riskBudgetCents(10_000, 1.5)).toBeNull();
  });
});

describe("sharesForRisk", () => {
  it("divides the budget by the per-share stop distance", () => {
    // Risk 200 cents, stop 20 cents away → 10 shares.
    expect(sharesForRisk(50_000, 49_980, 200)).toBe(10);
  });

  it("returns a fractional size rather than rounding", () => {
    // 200 / 300 = 0.666… — rounding down would under-risk, up would breach the
    // limit this function exists to enforce.
    expect(sharesForRisk(50_000, 49_700, 200)).toBeCloseTo(2 / 3);
  });

  it("is null when the stop is at or above entry", () => {
    expect(sharesForRisk(50_000, 50_000, 200)).toBeNull();
    expect(sharesForRisk(50_000, 50_100, 200)).toBeNull();
  });

  it("is null for a non-positive risk budget", () => {
    expect(sharesForRisk(50_000, 49_000, 0)).toBeNull();
  });
});

describe("positionSize", () => {
  it("returns both the budget and the size it justifies", () => {
    expect(positionSize(10_000, 50_000, 49_980)).toEqual({
      riskCents: 200,
      shares: 10,
    });
  });

  it("keeps the loss at the budget when the stop is hit", () => {
    // The property that matters: shares × stop distance === the risk budget.
    const sized = positionSize(50_000, 25_000, 24_650);
    expect(sized).not.toBeNull();
    expect(sized!.shares * (25_000 - 24_650)).toBeCloseTo(sized!.riskCents);
  });

  it("propagates null rather than falling back to an unjustified size", () => {
    expect(positionSize(0, 50_000, 49_000)).toBeNull();
    expect(positionSize(10_000, 50_000, 50_000)).toBeNull();
  });
});
