import { describe, expect, it } from "vitest";
import {
  billsDueThisMonth,
  budgetProgressForMonth,
  monthlySummary,
  monthToDateSpend,
} from "@/src/modules/finance/financeSelectors";
import type {
  Budget,
  FinanceTransaction,
  RecurringBill,
} from "@/src/modules/finance/types";

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

describe("billsDueThisMonth", () => {
  const jul = new Date(2026, 6, 15);

  const bills: RecurringBill[] = [
    {
      id: "rent",
      name: "Rent",
      amountCents: 120000,
      category: "rent",
      dayOfMonth: 1,
      active: true,
      deletedAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    {
      id: "power",
      name: "Electricity",
      amountCents: 8500,
      category: "utilities",
      dayOfMonth: 20,
      active: true,
      deletedAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
  ];

  it("returns unpaid bill instances this month, sorted by due date, with names", () => {
    const due = billsDueThisMonth(
      [
        txn({ billId: "power", paidAt: null, occurredOn: "2026-07-20" }),
        txn({ billId: "rent", paidAt: null, occurredOn: "2026-07-01" }),
        // paid bill instance — not "due"
        txn({ billId: "rent", paidAt: "2026-07-02T00:00:00.000Z" }),
        // ad-hoc unpaid-looking row (no billId) — not a bill
        txn({ billId: null, paidAt: null }),
      ],
      bills,
      jul,
    );
    expect(due.map((d) => [d.billId, d.name])).toEqual([
      ["rent", "Rent"],
      ["power", "Electricity"],
    ]);
  });

  it("falls back to a generic name when the bill template is gone", () => {
    const due = billsDueThisMonth(
      [txn({ billId: "orphan", paidAt: null, occurredOn: "2026-07-10" })],
      bills,
      jul,
    );
    expect(due[0].name).toBe("Recurring bill");
  });
});

describe("monthToDateSpend", () => {
  const jul = new Date(2026, 6, 15);

  it("reports settled spend and net for the month", () => {
    const spend = monthToDateSpend(
      [
        txn({ kind: "income", amountCents: 300000 }),
        txn({ kind: "expense", amountCents: 120000 }),
        // unpaid bill instance — excluded
        txn({ kind: "expense", amountCents: 90000, paidAt: null, billId: "b" }),
      ],
      jul,
    );
    expect(spend).toEqual({ spentCents: 120000, netCents: 180000 });
  });
});

describe("budgetProgressForMonth", () => {
  const jul = new Date(2026, 6, 15);

  function budget(category: string, amountCents: number): Budget {
    return {
      id: category,
      category,
      amountCents,
      deletedAt: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    };
  }

  it("sums settled expenses per budgeted category for the month", () => {
    const progress = budgetProgressForMonth(
      [
        txn({ category: "groceries", amountCents: 4000 }),
        txn({ category: "groceries", amountCents: 3000 }),
        // unpaid bill instance — not yet spent
        txn({
          category: "rent",
          amountCents: 120000,
          paidAt: null,
          billId: "b",
        }),
        // income and other-month rows don't count
        txn({ category: "groceries", kind: "income", amountCents: 9999 }),
        txn({
          category: "groceries",
          amountCents: 9999,
          occurredOn: "2026-06-30",
        }),
      ],
      [budget("groceries", 50000), budget("rent", 120000)],
      jul,
    );
    expect(progress).toEqual([
      { category: "groceries", limitCents: 50000, spentCents: 7000 },
      { category: "rent", limitCents: 120000, spentCents: 0 },
    ]);
  });
});
