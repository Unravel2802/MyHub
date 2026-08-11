"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORY_LABELS } from "@/src/modules/finance/financeCategories";
import { FinanceTransactionRow } from "@/src/modules/finance/components/FinanceTransactionRow";
import { FOCUS_CLASSES } from "@/src/modules/finance/components/financeTableStyles";
import { useFinanceInlineEdit } from "@/src/modules/finance/components/useFinanceInlineEdit";
import type { UpdateTransactionInput } from "@/src/modules/finance/FinanceRepository";
import type { FinanceTransaction } from "@/src/modules/finance/types";

type SortKey = "date" | "category" | "kind" | "amount";
type SortDirection = "ascending" | "descending";

type FinanceTransactionTableProps = {
  billNames: Map<string, string>;
  pendingIds: Set<string>;
  transactions: FinanceTransaction[];
  onDelete: (transaction: FinanceTransaction) => void;
  onPayBill: (transactionId: string) => void;
  onUpdate: (id: string, input: UpdateTransactionInput) => void;
};

export function FinanceTransactionTable({
  billNames,
  pendingIds,
  transactions,
  onDelete,
  onPayBill,
  onUpdate,
}: FinanceTransactionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] =
    useState<SortDirection>("descending");
  const edit = useFinanceInlineEdit(pendingIds, onUpdate);

  const sortedTransactions = useMemo(() => {
    const direction = sortDirection === "ascending" ? 1 : -1;
    return [...transactions].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "date") {
        comparison = a.occurredOn.localeCompare(b.occurredOn);
      } else if (sortKey === "category") {
        comparison = (
          CATEGORY_LABELS.get(a.category) ?? a.category
        ).localeCompare(CATEGORY_LABELS.get(b.category) ?? b.category);
      } else if (sortKey === "kind") {
        comparison = a.kind.localeCompare(b.kind);
      } else {
        comparison = a.amountCents - b.amountCents;
      }
      if (comparison !== 0) return comparison * direction;
      return a.createdAt.localeCompare(b.createdAt) * direction;
    });
  }, [sortDirection, sortKey, transactions]);

  function sortBy(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) =>
        current === "ascending" ? "descending" : "ascending",
      );
      return;
    }
    setSortKey(nextKey);
    setSortDirection("ascending");
  }

  function header(label: string, key: SortKey, className = "text-left") {
    const active = sortKey === key;
    const DirectionIcon =
      active && sortDirection === "descending" ? ChevronDown : ChevronUp;
    return (
      <th
        aria-sort={active ? sortDirection : "none"}
        className={`px-3 py-2 text-xs font-medium uppercase tracking-widest text-muted ${className}`}
        scope="col"
      >
        <button
          className={`inline-flex items-center gap-1 rounded-sm ${FOCUS_CLASSES}`}
          onClick={() => sortBy(key)}
          type="button"
        >
          {label}
          <DirectionIcon
            aria-hidden="true"
            className={`size-3.5 ${active ? "opacity-100" : "opacity-35"}`}
          />
        </button>
      </th>
    );
  }

  return (
    <div className="max-h-[28rem] max-w-full overflow-x-auto overflow-y-auto rounded-lg border border-border">
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-surface-subtle">
          <tr className="border-b border-border">
            {header("Date", "date")}
            {header("Category", "category")}
            {header("Type", "kind")}
            {header("Amount", "amount", "text-right")}
            <th
              className="px-3 py-2 text-left text-xs font-medium uppercase tracking-widest text-muted"
              scope="col"
            >
              Note
            </th>
            <th className="px-3 py-2 text-right" scope="col">
              <span className="sr-only">Row actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sortedTransactions.map((transaction, index) => (
            <FinanceTransactionRow
              billNames={billNames}
              edit={edit}
              index={index}
              key={transaction.id}
              onDelete={onDelete}
              onPayBill={onPayBill}
              pending={pendingIds.has(transaction.id)}
              transaction={transaction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
