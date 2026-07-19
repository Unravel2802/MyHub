"use client";

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
import type { CreateBillInput } from "@/src/modules/finance/FinanceRepository";
import type { RecurringBill } from "@/src/modules/finance/types";

type RecurringBillDialogProps = {
  bill?: RecurringBill | null;
  onClose: () => void;
  onSubmit: (input: CreateBillInput) => Promise<void>;
};

function amountInputFor(bill?: RecurringBill | null): string {
  if (!bill) return "";
  return formatCents(bill.amountCents).replace(/[$,]/g, "");
}

export function RecurringBillDialog({
  bill,
  onClose,
  onSubmit,
}: RecurringBillDialogProps) {
  const [name, setName] = useState(() => bill?.name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => amountInputFor(bill));
  const [amountError, setAmountError] = useState<string | null>(null);
  const expenseCategories = categoriesForKind("expense");
  const [category, setCategory] = useState(
    () => bill?.category ?? expenseCategories[0]?.key ?? "",
  );
  const [dayOfMonth, setDayOfMonth] = useState(() =>
    String(bill?.dayOfMonth ?? 1),
  );
  const [dayError, setDayError] = useState<string | null>(null);
  const [active, setActive] = useState(() => bill?.active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = name.trim();
    const amountCents = parseAmount(amount);
    const parsedDay = Number(dayOfMonth);
    const validDay =
      Number.isInteger(parsedDay) && parsedDay >= 1 && parsedDay <= 31;

    setNameError(trimmedName ? null : "Enter a bill name.");
    setAmountError(
      amountCents === null ? "Enter a valid non-negative amount." : null,
    );
    setDayError(validDay ? null : "Enter a day from 1 to 31.");
    if (!trimmedName || amountCents === null || !validDay) return;

    setIsSubmitting(true);
    await onSubmit({
      name: trimmedName,
      amountCents,
      category,
      dayOfMonth: parsedDay,
      active,
    });
    setIsSubmitting(false);
    onClose();
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {bill ? "Edit recurring bill" : "Add recurring bill"}
          </DialogTitle>
          <DialogDescription>
            Create one due ledger entry each month until this bill is paused or
            deactivated.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={submit}>
          <FormField error={nameError} label="Name">
            {(field) => (
              <input
                {...field}
                autoComplete="off"
                className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Rent"
                value={name}
              />
            )}
          </FormField>

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
                  {expenseCategories.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <FormField
              error={dayError}
              hint="Dates clamp to the month's final day."
              label="Day of month"
            >
              {(field) => (
                <input
                  {...field}
                  className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                  inputMode="numeric"
                  max={31}
                  min={1}
                  onChange={(event) => {
                    setDayOfMonth(event.target.value);
                    if (dayError) setDayError(null);
                  }}
                  type="number"
                  value={dayOfMonth}
                />
              )}
            </FormField>

            <label className="flex h-10 items-center gap-3 rounded-md border border-input bg-surface px-3 text-sm text-body">
              <input
                checked={active}
                className="size-4 accent-primary"
                onChange={(event) => setActive(event.target.checked)}
                type="checkbox"
              />
              Active recurring bill
            </label>
          </div>

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
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? "Saving..."
                : bill
                  ? "Save changes"
                  : "Add recurring bill"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
