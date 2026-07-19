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
import type { Budget } from "@/src/modules/finance/types";

type BudgetDialogProps = {
  budget?: Budget | null;
  initialCategory?: string;
  onClose: () => void;
  onSubmit: (category: string, amountCents: number) => Promise<void>;
};

function amountInputFor(budget?: Budget | null): string {
  if (!budget) return "";
  return formatCents(budget.amountCents).replace(/[$,]/g, "");
}

export function BudgetDialog({
  budget,
  initialCategory,
  onClose,
  onSubmit,
}: BudgetDialogProps) {
  const categories = categoriesForKind("expense");
  const [category, setCategory] = useState(
    () => budget?.category ?? initialCategory ?? categories[0]?.key ?? "",
  );
  const [amount, setAmount] = useState(() => amountInputFor(budget));
  const [amountError, setAmountError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseAmount(amount);
    if (amountCents === null) {
      setAmountError("Enter a valid non-negative amount.");
      return;
    }

    setAmountError(null);
    setIsSubmitting(true);
    await onSubmit(category, amountCents);
    setIsSubmitting(false);
    onClose();
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{budget ? "Edit budget" : "Set a budget"}</DialogTitle>
          <DialogDescription>
            Set a standing monthly limit for one expense category.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={submit}>
          <FormField label="Category">
            {(field) => (
              <select
                {...field}
                className="h-10 rounded-md border border-input bg-surface px-3 text-foreground disabled:bg-disabled"
                disabled={Boolean(budget)}
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

          <FormField
            error={amountError}
            hint="This limit repeats every month."
            label="Monthly limit"
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
                : budget
                  ? "Save limit"
                  : "Set budget"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
