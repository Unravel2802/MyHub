"use client";

import { format, parseISO } from "date-fns";
import { Trash2 } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { formatCents } from "@/src/lib/money";
import {
  categoriesForKind,
  CATEGORY_LABELS,
} from "@/src/modules/finance/financeCategories";
import {
  FINANCE_CATEGORY_HUES,
  type FinanceCategoryKey,
} from "@/src/modules/finance/financeCategoryHues";
import type { FinanceInlineEdit } from "@/src/modules/finance/components/useFinanceInlineEdit";
import type { FinanceTransaction } from "@/src/modules/finance/types";
import { FOCUS_CLASSES } from "@/src/modules/finance/components/financeTableStyles";

interface FinanceTransactionRowProps {
  transaction: FinanceTransaction;
  index: number;
  pending: boolean;
  billNames: Map<string, string>;
  edit: FinanceInlineEdit;
  onDelete: (transaction: FinanceTransaction) => void;
  onPayBill: (transactionId: string) => void;
}

// One ledger row, every cell inline-editable. The edit STATE lives in
// useFinanceInlineEdit and is passed in whole: exactly one cell across the
// whole table is editable at a time, so a row cannot own that state.
export function FinanceTransactionRow({
  transaction,
  index,
  pending,
  billNames,
  edit,
  onDelete,
  onPayBill,
}: FinanceTransactionRowProps) {
  const rowName =
    transaction.note ||
    (transaction.billId ? billNames.get(transaction.billId) : null) ||
    CATEGORY_LABELS.get(transaction.category) ||
    "transaction";
  const isExpense = transaction.kind === "expense";
  // A bill-generated row that has not been paid yet: the only row that offers
  // "Mark paid".
  const isDue = transaction.billId !== null && transaction.paidAt === null;
  const categoryHue =
    FINANCE_CATEGORY_HUES[transaction.category as FinanceCategoryKey];
  const inputErrorId = `transaction-${transaction.id}-edit-error`;

  return (
    <tr
      aria-busy={pending}
      className={`fade-up bg-surface transition-opacity hover:bg-surface-subtle ${pending ? "pointer-events-none opacity-50" : ""}`}
      key={transaction.id}
      style={{ ["--i" as string]: index }}
    >
      <td className="whitespace-nowrap px-3 py-3 align-top">
        {edit.isEditing(transaction.id, "date") ? (
          <div>
            <input
              aria-describedby={edit.error ? inputErrorId : undefined}
              aria-invalid={Boolean(edit.error)}
              aria-label={`Date for ${rowName}`}
              autoFocus
              className={`h-9 rounded-md border bg-surface px-2 text-foreground ${FOCUS_CLASSES} ${edit.error ? "border-danger-border" : "border-input"}`}
              onBlur={(event) => edit.onBlur(event, transaction, "date")}
              onChange={(event) => {
                edit.setDraft(event.target.value);
                if (edit.error) edit.clearError();
              }}
              onKeyDown={(event) => edit.onKeyDown(event, transaction, "date")}
              type="date"
              value={edit.draft}
            />
            {edit.error ? (
              <p
                className="mt-1 text-xs text-danger"
                id={inputErrorId}
                role="alert"
              >
                {edit.error}
              </p>
            ) : null}
          </div>
        ) : (
          <button
            aria-label={`Edit date for ${rowName}`}
            className={`rounded-sm text-left text-body ${FOCUS_CLASSES}`}
            disabled={pending}
            onClick={() => edit.begin(transaction, "date")}
            type="button"
          >
            {format(parseISO(transaction.occurredOn), "MMM d, yyyy")}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        {edit.isEditing(transaction.id, "category") ? (
          <Select
            defaultOpen
            onOpenChange={(open) => {
              if (!open) edit.closeIfEditing(transaction.id, "category");
            }}
            onValueChange={(category) =>
              edit.commitCategory(transaction.id, category)
            }
            value={transaction.category}
          >
            <SelectTrigger
              aria-label={`Category for ${rowName}`}
              className="w-40 bg-surface"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoriesForKind(transaction.kind).map((category) => (
                <SelectItem key={category.key} value={category.key}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <button
            aria-label={`Edit category for ${rowName}`}
            className={`rounded-full ${FOCUS_CLASSES}`}
            disabled={pending}
            onClick={() => edit.begin(transaction, "category")}
            type="button"
          >
            <Badge hue={categoryHue}>
              {CATEGORY_LABELS.get(transaction.category) ??
                transaction.category}
            </Badge>
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 align-top">
        {edit.isEditing(transaction.id, "kind") ? (
          <div
            aria-label={`Type for ${rowName}`}
            className="inline-flex rounded-md border border-input bg-surface p-0.5"
            onBlur={(event) => {
              // Only when focus leaves the WHOLE group — moving between the
              // two buttons must not close it.
              if (!event.currentTarget.contains(event.relatedTarget))
                edit.close();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") edit.close();
            }}
            role="group"
          >
            {(["expense", "income"] as const).map((kind) => (
              <button
                aria-pressed={transaction.kind === kind}
                autoFocus={transaction.kind === kind}
                className={`rounded px-2 py-1 capitalize ${FOCUS_CLASSES} ${transaction.kind === kind ? "bg-surface-subtle font-medium text-foreground" : "text-muted"}`}
                key={kind}
                onClick={() => edit.changeKind(transaction, kind)}
                type="button"
              >
                {kind}
              </button>
            ))}
          </div>
        ) : (
          <button
            aria-label={`Edit type for ${rowName}`}
            className={`rounded-sm capitalize text-body ${FOCUS_CLASSES}`}
            disabled={pending}
            onClick={() => edit.begin(transaction, "kind")}
            type="button"
          >
            {transaction.kind}
          </button>
        )}
      </td>
      <td className="px-3 py-3 text-right align-top">
        {edit.isEditing(transaction.id, "amount") ? (
          <div className="ml-auto w-32">
            <input
              aria-describedby={edit.error ? inputErrorId : undefined}
              aria-invalid={Boolean(edit.error)}
              aria-label={`Amount for ${rowName}`}
              autoFocus
              className={`h-9 w-full rounded-md border bg-surface px-2 text-right tabular-nums text-foreground ${FOCUS_CLASSES} ${edit.error ? "border-danger-border" : "border-input"}`}
              inputMode="decimal"
              onBlur={(event) => edit.onBlur(event, transaction, "amount")}
              onChange={(event) => {
                edit.setDraft(event.target.value);
                if (edit.error) edit.clearError();
              }}
              onKeyDown={(event) =>
                edit.onKeyDown(event, transaction, "amount")
              }
              value={edit.draft}
            />
            {edit.error ? (
              <p
                className="mt-1 text-xs text-danger"
                id={inputErrorId}
                role="alert"
              >
                {edit.error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {isDue ? <Badge tone="danger">Due</Badge> : null}
            <button
              aria-label={`Edit amount for ${rowName}`}
              className={`rounded-sm font-semibold tabular-nums ${FOCUS_CLASSES} ${isExpense ? "text-danger" : "text-hue-lime"}`}
              disabled={pending}
              onClick={() => edit.begin(transaction, "amount")}
              type="button"
            >
              {formatCents(
                isExpense ? -transaction.amountCents : transaction.amountCents,
              )}
            </button>
          </div>
        )}
      </td>
      <td className="min-w-56 px-3 py-3 align-top">
        {edit.isEditing(transaction.id, "note") ? (
          <input
            aria-label={`Note for ${rowName}`}
            autoFocus
            className={`h-9 w-full rounded-md border border-input bg-surface px-2 text-foreground ${FOCUS_CLASSES}`}
            onBlur={(event) => edit.onBlur(event, transaction, "note")}
            onChange={(event) => edit.setDraft(event.target.value)}
            onKeyDown={(event) => edit.onKeyDown(event, transaction, "note")}
            placeholder="Optional note"
            value={edit.draft}
          />
        ) : (
          <button
            aria-label={`Edit note for ${rowName}`}
            className={`block max-w-64 truncate rounded-sm text-left ${FOCUS_CLASSES} ${transaction.note || (transaction.billId && billNames.get(transaction.billId)) ? "text-body" : "text-muted"}`}
            disabled={pending}
            onClick={() => edit.begin(transaction, "note")}
            type="button"
          >
            {transaction.note ||
              (transaction.billId ? billNames.get(transaction.billId) : null) ||
              "—"}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-3 text-right align-top">
        <div className="flex justify-end gap-1">
          {isDue ? (
            <button
              className={`rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover ${FOCUS_CLASSES}`}
              disabled={pending}
              onClick={() => onPayBill(transaction.id)}
              type="button"
            >
              Mark paid
            </button>
          ) : null}
          <button
            aria-label={`Delete ${rowName}`}
            className={`rounded-md p-2 text-muted hover:bg-danger-surface hover:text-danger ${FOCUS_CLASSES}`}
            disabled={pending}
            onClick={() => onDelete(transaction)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
