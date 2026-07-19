import { endOfMonth, format, getDate, setDate } from "date-fns";
import type { RecurringBill } from "@/src/modules/finance/types";

// A generated bill instance that doesn't exist yet — what regenerate inserts
// into finance_transactions (as an unpaid expense).
export interface PendingBillInstance {
  billId: string;
  occurredOn: string; // yyyy-MM-dd due date
  amountCents: number;
  category: string;
}

// Stable key for "this bill, this due date" — matches the (bill_id, occurred_on)
// unique constraint. Used to diff existing instances against what's due.
export function billOccurrenceKey(billId: string, occurredOn: string): string {
  return `${billId}:${occurredOn}`;
}

// The due date (yyyy-MM-dd) of a bill in the month containing `monthDate`, via
// date-fns (never UTC slicing). day_of_month is clamped to the month's last day,
// so a "31st" bill lands on Feb 28/29 and on the 30th of a 30-day month rather
// than rolling into the next month.
export function dueDateFor(
  bill: Pick<RecurringBill, "dayOfMonth">,
  monthDate: Date,
): string {
  const lastDay = getDate(endOfMonth(monthDate));
  const day = Math.min(bill.dayOfMonth, lastDay);
  return format(setDate(monthDate, day), "yyyy-MM-dd");
}

// The instances that SHOULD exist for the month containing `today` but don't yet
// (by key). Only active, non-deleted bills produce instances. Mirrors
// taskRecurrence.missingOccurrences.
export function missingBillInstances(
  bills: RecurringBill[],
  existingKeys: ReadonlySet<string>,
  today: Date,
): PendingBillInstance[] {
  return bills
    .filter((bill) => bill.active && bill.deletedAt === null)
    .map((bill) => ({
      billId: bill.id,
      occurredOn: dueDateFor(bill, today),
      amountCents: bill.amountCents,
      category: bill.category,
    }))
    .filter(
      (instance) =>
        !existingKeys.has(
          billOccurrenceKey(instance.billId, instance.occurredOn),
        ),
    );
}
