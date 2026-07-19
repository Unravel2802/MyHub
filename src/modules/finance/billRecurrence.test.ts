import { describe, expect, it } from "vitest";
import {
  billOccurrenceKey,
  dueDateFor,
  missingBillInstances,
} from "@/src/modules/finance/billRecurrence";
import type { RecurringBill } from "@/src/modules/finance/types";

function bill(overrides: Partial<RecurringBill> = {}): RecurringBill {
  return {
    id: "b1",
    name: "Rent",
    amountCents: 120000,
    category: "rent",
    dayOfMonth: 1,
    active: true,
    deletedAt: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dueDateFor", () => {
  it("uses the bill's day within the month", () => {
    expect(dueDateFor({ dayOfMonth: 5 }, new Date(2026, 6, 20))).toBe(
      "2026-07-05",
    );
  });

  it("clamps a day past the month's end to the last day", () => {
    // February 2026 has 28 days; a 31st bill lands on the 28th.
    expect(dueDateFor({ dayOfMonth: 31 }, new Date(2026, 1, 10))).toBe(
      "2026-02-28",
    );
    // A 30-day month clamps a 31st bill to the 30th.
    expect(dueDateFor({ dayOfMonth: 31 }, new Date(2026, 3, 10))).toBe(
      "2026-04-30",
    );
  });
});

describe("missingBillInstances", () => {
  const today = new Date(2026, 6, 15);

  it("returns due instances not already present", () => {
    const pending = missingBillInstances(
      [
        bill({ id: "rent", dayOfMonth: 1 }),
        bill({ id: "power", dayOfMonth: 20 }),
      ],
      new Set([billOccurrenceKey("rent", "2026-07-01")]),
      today,
    );
    expect(pending.map((p) => p.billId)).toEqual(["power"]);
    expect(pending[0].occurredOn).toBe("2026-07-20");
  });

  it("skips inactive and soft-deleted bills", () => {
    const pending = missingBillInstances(
      [
        bill({ id: "off", active: false }),
        bill({ id: "gone", deletedAt: "2026-07-01T00:00:00.000Z" }),
      ],
      new Set(),
      today,
    );
    expect(pending).toEqual([]);
  });
});
