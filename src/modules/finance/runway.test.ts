import { describe, expect, it } from "vitest";
import { computeRunway } from "@/src/modules/finance/runway";
import type { FinanceTransaction } from "@/src/modules/finance/types";

let n = 0;
function txn(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  n += 1;
  return {
    id: `t${n}`,
    kind: "expense",
    amountCents: 100000,
    category: "rent",
    occurredOn: "2026-06-01",
    note: null,
    billId: null,
    paidAt: "2026-06-01T00:00:00.000Z",
    deletedAt: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("computeRunway", () => {
  const today = new Date(2026, 6, 15); // July 15, 2026

  it("divides savings by the average monthly net burn over complete months", () => {
    // May: spent 200000, no income → burn 200000. June: spent 100000 → burn
    // 100000. Average burn = 150000. Savings 900000 → 6 months.
    const runway = computeRunway(
      [
        txn({ occurredOn: "2026-05-10", amountCents: 200000 }),
        txn({ occurredOn: "2026-06-10", amountCents: 100000 }),
      ],
      900000,
      today,
    );
    expect(runway).toEqual({ months: 6, avgMonthlyBurnCents: 150000 });
  });

  it("excludes the current partial month from the burn rate", () => {
    // Only June counts (burn 100000); the big July expense is the current month.
    const runway = computeRunway(
      [
        txn({ occurredOn: "2026-06-10", amountCents: 100000 }),
        txn({ occurredOn: "2026-07-14", amountCents: 999999 }),
      ],
      500000,
      today,
    );
    expect(runway?.avgMonthlyBurnCents).toBe(100000);
    expect(runway?.months).toBe(5);
  });

  it("returns null when income covers spending (not burning down savings)", () => {
    const runway = computeRunway(
      [
        txn({ occurredOn: "2026-06-05", kind: "income", amountCents: 300000 }),
        txn({ occurredOn: "2026-06-10", kind: "expense", amountCents: 100000 }),
      ],
      500000,
      today,
    );
    expect(runway).toBeNull();
  });

  it("returns null with no completed-month activity", () => {
    expect(computeRunway([], 500000, today)).toBeNull();
    // Only current-month + unpaid rows → nothing to project from.
    expect(
      computeRunway(
        [
          txn({ occurredOn: "2026-07-10" }),
          txn({ occurredOn: "2026-06-10", paidAt: null, billId: "b" }),
        ],
        500000,
        today,
      ),
    ).toBeNull();
  });
});
