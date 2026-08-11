"use client";

import { CalendarClock } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import { formatCents } from "@/src/lib/money";
import { CATEGORY_LABELS } from "@/src/modules/finance/financeCategories";
import {
  FINANCE_CATEGORY_HUES,
  type FinanceCategoryKey,
} from "@/src/modules/finance/financeCategoryHues";
import type { RecurringBill } from "@/src/modules/finance/types";

interface RecurringBillsPanelProps {
  bills: RecurringBill[];
  onAdd: () => void;
  onEdit: (bill: RecurringBill) => void;
  onDeactivate: (bill: RecurringBill) => void;
}

// The recurring-bill templates. Presentational: it renders the list and calls
// back, so FinancePage keeps ownership of the dialogs and the confirmations.
export function RecurringBillsPanel({
  bills,
  onAdd,
  onEdit,
  onDeactivate,
}: RecurringBillsPanelProps) {
  return (
    <Panel
      aside={<Badge tone="neutral">{bills.length}</Badge>}
      description="Templates create one due ledger entry each month. Paused bills remain available to edit."
      overline="Monthly obligations"
      title="Recurring bills"
    >
      {bills.length === 0 ? (
        <EmptyState
          action={
            <button
              className="text-hue-lime hover:underline"
              onClick={onAdd}
              type="button"
            >
              Add a recurring bill
            </button>
          }
          description="Add rent, utilities, or another repeating expense to generate its monthly due entry."
          icon={CalendarClock}
          title="No recurring bills yet"
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {/* Copied, not sorted in place: `bills` is the store's array, and
              Array.prototype.sort mutates. */}
          {[...bills]
            .sort(
              (a, b) =>
                a.dayOfMonth - b.dayOfMonth || a.name.localeCompare(b.name),
            )
            .map((bill, index) => (
              <li
                className="fade-up rounded-lg border border-border bg-surface-subtle p-4"
                key={bill.id}
                style={{ ["--i" as string]: index }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {bill.name}
                      </p>
                      <Badge tone={bill.active ? "success" : "neutral"}>
                        {bill.active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                      <Badge
                        hue={
                          FINANCE_CATEGORY_HUES[
                            bill.category as FinanceCategoryKey
                          ]
                        }
                      >
                        {CATEGORY_LABELS.get(bill.category) ?? bill.category}
                      </Badge>
                      <span>Due day {bill.dayOfMonth}</span>
                    </div>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-foreground">
                    {formatCents(bill.amountCents)}
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    className="rounded-md border border-input bg-surface px-3 py-1.5 text-sm text-body hover:bg-surface-subtle"
                    onClick={() => onEdit(bill)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-danger-border bg-danger-surface px-3 py-1.5 text-sm text-danger hover:border-danger"
                    onClick={() => onDeactivate(bill)}
                    type="button"
                  >
                    Deactivate
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </Panel>
  );
}
