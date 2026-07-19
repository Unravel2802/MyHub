"use client";

import { format } from "date-fns";
import { useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { FormField } from "@/src/components/ui/FormField";
import { categoriesForKind } from "@/src/modules/finance/financeCategories";
import { formatCents, parseAmount } from "@/src/modules/finance/money";
import type { CreateTransactionInput } from "@/src/modules/finance/FinanceRepository";
import type {
  FinanceTransaction,
  TransactionKind,
} from "@/src/modules/finance/types";

type FinanceTransactionDialogProps = {
  disabled: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTransactionInput) => Promise<void>;
  transaction?: FinanceTransaction | null;
};

function amountInputFor(transaction?: FinanceTransaction | null): string {
  if (!transaction) return "";
  return formatCents(transaction.amountCents).replace(/[$,]/g, "");
}

export function FinanceTransactionDialog({
  disabled,
  onClose,
  onSubmit,
  transaction,
}: FinanceTransactionDialogProps) {
  const initialKind = transaction?.kind ?? "expense";
  const [kind, setKind] = useState<TransactionKind>(initialKind);
  const [amount, setAmount] = useState(() => amountInputFor(transaction));
  const [amountError, setAmountError] = useState<string | null>(null);
  const [category, setCategory] = useState(
    () => transaction?.category ?? categoriesForKind(initialKind)[0]?.key ?? "",
  );
  const [occurredOn, setOccurredOn] = useState(
    () => transaction?.occurredOn ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [dateError, setDateError] = useState<string | null>(null);
  const [note, setNote] = useState(() => transaction?.note ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categories = categoriesForKind(kind);

  function changeKind(nextKind: TransactionKind) {
    setKind(nextKind);
    const nextCategories = categoriesForKind(nextKind);
    if (!nextCategories.some((item) => item.key === category)) {
      setCategory(nextCategories[0]?.key ?? "");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseAmount(amount);
    if (amountCents === null) {
      setAmountError("Enter a valid non-negative amount.");
      return;
    }
    if (!occurredOn) {
      setDateError("Choose a transaction date.");
      return;
    }

    setAmountError(null);
    setDateError(null);
    setIsSubmitting(true);
    await onSubmit({
      kind,
      amountCents,
      category,
      occurredOn,
      note: note.trim() || null,
    });
    setIsSubmitting(false);
    onClose();
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
          <DialogDescription>
            Record money that moved. Amounts are stored exactly in cents.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={submit}>
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-body">Kind</legend>
            <div className="grid grid-cols-2 gap-2">
              <button
                aria-pressed={kind === "expense"}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${kind === "expense" ? "border-danger-border bg-danger-surface text-danger" : "border-input bg-surface text-body hover:bg-surface-subtle"}`}
                onClick={() => changeKind("expense")}
                type="button"
              >
                Expense
              </button>
              <button
                aria-pressed={kind === "income"}
                className={`h-10 rounded-md border text-sm font-medium transition-colors ${kind === "income" ? "border-hue-lime-border bg-hue-lime-surface text-hue-lime" : "border-input bg-surface text-body hover:bg-surface-subtle"}`}
                onClick={() => changeKind("income")}
                type="button"
              >
                Income
              </button>
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={amountError}
              hint="Examples: 12, 12.50, or $1,234.50"
              label="Amount"
            >
              {(field) => (
                <input
                  {...field}
                  autoComplete="off"
                  className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                  inputMode="decimal"
                  onChange={(event) => {
                    setAmount(event.target.value);
                    if (amountError) setAmountError(null);
                  }}
                  placeholder="0.00"
                  value={amount}
                />
              )}
            </FormField>

            <FormField label="Category">
              {(field) => (
                <select
                  {...field}
                  className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                  onChange={(event) => setCategory(event.target.value)}
                  value={category}
                >
                  {categories.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <FormField error={dateError} label="Date">
            {(field) => (
              <input
                {...field}
                className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                onChange={(event) => {
                  setOccurredOn(event.target.value);
                  if (dateError) setDateError(null);
                }}
                required
                type="date"
                value={occurredOn}
              />
            )}
          </FormField>

          <FormField hint="Optional" label="Note">
            {(field) => (
              <textarea
                {...field}
                className="min-h-24 rounded-md border border-input bg-surface px-3 py-2 text-foreground"
                onChange={(event) => setNote(event.target.value)}
                placeholder="What was this for?"
                value={note}
              />
            )}
          </FormField>

          <DialogFooter>
            <button
              className="h-10 rounded-md border border-input bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-subtle"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
              disabled={disabled || isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Saving..."
                : transaction
                  ? "Save changes"
                  : "Add transaction"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
