import { describe, expect, it } from "vitest";
import { monthlySummary } from "@/src/modules/finance/financeSelectors";
import type { FinanceTransaction } from "@/src/modules/finance/types";

let counter = 0;
function txn(overrides: Partial<FinanceTransaction> = {}): FinanceTransaction {
  counter += 1;
  return {
    id: `t${counter}`,
    kind: "expense",
    amountCents: 1000,
    category: "other",
    occurredOn: "2026-07-10",
    note: null,
    billId: null,
    paidAt: "2026-07-10T00:00:00.000Z",
    deletedAt: null,
    createdAt: "2026-07-10T00:00:00.000Z",
    updatedAt: "2026-07-10T00:00:00.000Z",
    ...overrides,
  };
}

describe("monthlySummary", () => {
  const jul = new Date(2026, 6, 15);

  it("sums settled income and expense for the month, netting them", () => {
    const summary = monthlySummary(
      [
        txn({ kind: "income", amountCents: 500000 }),
        txn({ kind: "expense", amountCents: 150000 }),
        txn({ kind: "expense", amountCents: 50000 }),
      ],
      jul,
    );
    expect(summary).toEqual({
      incomeCents: 500000,
      expenseCents: 200000,
      netCents: 300000,
    });
  });

  it("excludes unpaid (due) bill instances", () => {
    const summary = monthlySummary(
      [
        txn({
          kind: "expense",
          amountCents: 120000,
          paidAt: null,
          billId: "b1",
        }),
      ],
      jul,
    );
    expect(summary).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
    });
  });

  it("excludes other months and soft-deleted rows", () => {
    const summary = monthlySummary(
      [
        txn({ amountCents: 999, occurredOn: "2026-06-30" }),
        txn({ amountCents: 999, deletedAt: "2026-07-11T00:00:00.000Z" }),
      ],
      jul,
    );
    expect(summary).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
    });
  });
});
