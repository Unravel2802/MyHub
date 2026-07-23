"use client";

import { format, parseISO } from "date-fns";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { Badge } from "@/src/components/ui/Badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  FINANCE_CATEGORIES,
  categoriesForKind,
} from "@/src/modules/finance/financeCategories";
import {
  FINANCE_CATEGORY_HUES,
  type FinanceCategoryKey,
} from "@/src/modules/finance/financeCategoryHues";
import { formatCents, parseAmount } from "@/src/modules/finance/money";
import type { UpdateTransactionInput } from "@/src/modules/finance/FinanceRepository";
import type {
  FinanceTransaction,
  TransactionKind,
} from "@/src/modules/finance/types";

type SortKey = "date" | "category" | "kind" | "amount";
type SortDirection = "ascending" | "descending";
type EditableField = "date" | "category" | "kind" | "amount" | "note";

type FinanceTransactionTableProps = {
  billNames: Map<string, string>;
  pendingIds: Set<string>;
  transactions: FinanceTransaction[];
  onDelete: (transaction: FinanceTransaction) => void;
  onPayBill: (transactionId: string) => void;
  onUpdate: (id: string, input: UpdateTransactionInput) => void;
};

const CATEGORY_LABELS = new Map(
  FINANCE_CATEGORIES.map((category) => [category.key, category.label]),
);

const focusClasses =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas";

function displayName(
  transaction: FinanceTransaction,
  billNames: Map<string, string>,
) {
  return (
    transaction.note ||
    (transaction.billId ? billNames.get(transaction.billId) : null) ||
    CATEGORY_LABELS.get(transaction.category) ||
    "transaction"
  );
}

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
  const [editing, setEditing] = useState<{
    id: string;
    field: EditableField;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function beginEdit(transaction: FinanceTransaction, field: EditableField) {
    if (pendingIds.has(transaction.id)) return;
    const nextDraft =
      field === "amount"
        ? formatCents(transaction.amountCents).replace(/[$,]/g, "")
        : field === "date"
          ? transaction.occurredOn
          : field === "note"
            ? (transaction.note ?? "")
            : "";
    setDraft(nextDraft);
    setError(null);
    setEditing({ id: transaction.id, field });
  }

  function commitPatch(id: string, patch: UpdateTransactionInput) {
    setError(null);
    setEditing(null);
    onUpdate(id, patch);
  }

  function commitText(transaction: FinanceTransaction, field: EditableField) {
    if (field === "amount") {
      const amountCents = parseAmount(draft);
      if (amountCents === null) {
        setError("Enter a valid non-negative amount.");
        return false;
      }
      commitPatch(transaction.id, { amountCents });
      return true;
    }
    if (field === "date") {
      if (!draft) {
        setError("Choose a transaction date.");
        return false;
      }
      commitPatch(transaction.id, { occurredOn: draft });
      return true;
    }
    commitPatch(transaction.id, { note: draft.trim() || null });
    return true;
  }

  function handleInputKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    transaction: FinanceTransaction,
    field: EditableField,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      setError(null);
      setEditing(null);
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitText(transaction, field);
    }
  }

  function handleInputBlur(
    event: FocusEvent<HTMLInputElement>,
    transaction: FinanceTransaction,
    field: EditableField,
  ) {
    if (!commitText(transaction, field)) {
      const input = event.currentTarget;
      requestAnimationFrame(() => input.focus());
    }
  }

  function changeKind(
    transaction: FinanceTransaction,
    nextKind: TransactionKind,
  ) {
    const validCategories = categoriesForKind(nextKind);
    const categoryIsValid = validCategories.some(
      (category) => category.key === transaction.category,
    );
    commitPatch(transaction.id, {
      kind: nextKind,
      ...(categoryIsValid
        ? {}
        : { category: validCategories[0]?.key ?? transaction.category }),
    });
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
          className={`inline-flex items-center gap-1 rounded-sm ${focusClasses}`}
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
          {sortedTransactions.map((transaction, index) => {
            const pending = pendingIds.has(transaction.id);
            const rowName = displayName(transaction, billNames);
            const isExpense = transaction.kind === "expense";
            const isDue =
              transaction.billId !== null && transaction.paidAt === null;
            const categoryHue =
              FINANCE_CATEGORY_HUES[transaction.category as FinanceCategoryKey];
            const isEditing = (field: EditableField) =>
              editing?.id === transaction.id && editing.field === field;
            const inputErrorId = `transaction-${transaction.id}-edit-error`;

            return (
              <tr
                aria-busy={pending}
                className={`fade-up bg-surface transition-opacity hover:bg-surface-subtle ${pending ? "pointer-events-none opacity-50" : ""}`}
                key={transaction.id}
                style={{ ["--i" as string]: index }}
              >
                <td className="whitespace-nowrap px-3 py-3 align-top">
                  {isEditing("date") ? (
                    <div>
                      <input
                        aria-describedby={error ? inputErrorId : undefined}
                        aria-invalid={Boolean(error)}
                        aria-label={`Date for ${rowName}`}
                        autoFocus
                        className={`h-9 rounded-md border bg-surface px-2 text-foreground ${focusClasses} ${error ? "border-danger-border" : "border-input"}`}
                        onBlur={(event) =>
                          handleInputBlur(event, transaction, "date")
                        }
                        onChange={(event) => {
                          setDraft(event.target.value);
                          if (error) setError(null);
                        }}
                        onKeyDown={(event) =>
                          handleInputKeyDown(event, transaction, "date")
                        }
                        type="date"
                        value={draft}
                      />
                      {error ? (
                        <p
                          className="mt-1 text-xs text-danger"
                          id={inputErrorId}
                          role="alert"
                        >
                          {error}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      aria-label={`Edit date for ${rowName}`}
                      className={`rounded-sm text-left text-body ${focusClasses}`}
                      disabled={pending}
                      onClick={() => beginEdit(transaction, "date")}
                      type="button"
                    >
                      {format(parseISO(transaction.occurredOn), "MMM d, yyyy")}
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top">
                  {isEditing("category") ? (
                    <Select
                      defaultOpen
                      onOpenChange={(open) => {
                        if (!open) {
                          window.setTimeout(
                            () =>
                              setEditing((current) =>
                                current?.id === transaction.id &&
                                current.field === "category"
                                  ? null
                                  : current,
                              ),
                            0,
                          );
                        }
                      }}
                      onValueChange={(category) => {
                        setError(null);
                        onUpdate(transaction.id, { category });
                        window.setTimeout(() => setEditing(null), 0);
                      }}
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
                      className={`rounded-full ${focusClasses}`}
                      disabled={pending}
                      onClick={() => beginEdit(transaction, "category")}
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
                  {isEditing("kind") ? (
                    <div
                      aria-label={`Type for ${rowName}`}
                      className="inline-flex rounded-md border border-input bg-surface p-0.5"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget))
                          setEditing(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setEditing(null);
                      }}
                      role="group"
                    >
                      {(["expense", "income"] as const).map((kind) => (
                        <button
                          aria-pressed={transaction.kind === kind}
                          autoFocus={transaction.kind === kind}
                          className={`rounded px-2 py-1 capitalize ${focusClasses} ${transaction.kind === kind ? "bg-surface-subtle font-medium text-foreground" : "text-muted"}`}
                          key={kind}
                          onClick={() => changeKind(transaction, kind)}
                          type="button"
                        >
                          {kind}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      aria-label={`Edit type for ${rowName}`}
                      className={`rounded-sm capitalize text-body ${focusClasses}`}
                      disabled={pending}
                      onClick={() => beginEdit(transaction, "kind")}
                      type="button"
                    >
                      {transaction.kind}
                    </button>
                  )}
                </td>
                <td className="px-3 py-3 text-right align-top">
                  {isEditing("amount") ? (
                    <div className="ml-auto w-32">
                      <input
                        aria-describedby={error ? inputErrorId : undefined}
                        aria-invalid={Boolean(error)}
                        aria-label={`Amount for ${rowName}`}
                        autoFocus
                        className={`h-9 w-full rounded-md border bg-surface px-2 text-right tabular-nums text-foreground ${focusClasses} ${error ? "border-danger-border" : "border-input"}`}
                        inputMode="decimal"
                        onBlur={(event) =>
                          handleInputBlur(event, transaction, "amount")
                        }
                        onChange={(event) => {
                          setDraft(event.target.value);
                          if (error) setError(null);
                        }}
                        onKeyDown={(event) =>
                          handleInputKeyDown(event, transaction, "amount")
                        }
                        value={draft}
                      />
                      {error ? (
                        <p
                          className="mt-1 text-xs text-danger"
                          id={inputErrorId}
                          role="alert"
                        >
                          {error}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      {isDue ? <Badge tone="danger">Due</Badge> : null}
                      <button
                        aria-label={`Edit amount for ${rowName}`}
                        className={`rounded-sm font-semibold tabular-nums ${focusClasses} ${isExpense ? "text-danger" : "text-hue-lime"}`}
                        disabled={pending}
                        onClick={() => beginEdit(transaction, "amount")}
                        type="button"
                      >
                        {formatCents(
                          isExpense
                            ? -transaction.amountCents
                            : transaction.amountCents,
                        )}
                      </button>
                    </div>
                  )}
                </td>
                <td className="min-w-56 px-3 py-3 align-top">
                  {isEditing("note") ? (
                    <input
                      aria-label={`Note for ${rowName}`}
                      autoFocus
                      className={`h-9 w-full rounded-md border border-input bg-surface px-2 text-foreground ${focusClasses}`}
                      onBlur={(event) =>
                        handleInputBlur(event, transaction, "note")
                      }
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) =>
                        handleInputKeyDown(event, transaction, "note")
                      }
                      placeholder="Optional note"
                      value={draft}
                    />
                  ) : (
                    <button
                      aria-label={`Edit note for ${rowName}`}
                      className={`block max-w-64 truncate rounded-sm text-left ${focusClasses} ${transaction.note || (transaction.billId && billNames.get(transaction.billId)) ? "text-body" : "text-muted"}`}
                      disabled={pending}
                      onClick={() => beginEdit(transaction, "note")}
                      type="button"
                    >
                      {transaction.note ||
                        (transaction.billId
                          ? billNames.get(transaction.billId)
                          : null) ||
                        "—"}
                    </button>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right align-top">
                  <div className="flex justify-end gap-1">
                    {isDue ? (
                      <button
                        className={`rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover ${focusClasses}`}
                        disabled={pending}
                        onClick={() => onPayBill(transaction.id)}
                        type="button"
                      >
                        Mark paid
                      </button>
                    ) : null}
                    <button
                      aria-label={`Delete ${rowName}`}
                      className={`rounded-md p-2 text-muted hover:bg-danger-surface hover:text-danger ${focusClasses}`}
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
          })}
        </tbody>
      </table>
    </div>
  );
}
