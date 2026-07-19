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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import type { CreateReceivableInput } from "@/src/modules/finance/FinanceRepository";
import { formatCents, parseAmount } from "@/src/modules/finance/money";
import type { Receivable, ReceivableStatus } from "@/src/modules/finance/types";

type ReceivableDialogProps = {
  onClose: () => void;
  onSubmit: (input: CreateReceivableInput) => Promise<void>;
  receivable?: Receivable | null;
};

const EDITABLE_STATUSES: Array<{
  label: string;
  value: Exclude<ReceivableStatus, "paid">;
}> = [
  { label: "Not requested", value: "not_requested" },
  { label: "Requested", value: "requested" },
];

function amountInputFor(receivable?: Receivable | null): string {
  if (!receivable) return "";
  return formatCents(receivable.amountCents).replace(/[$,]/g, "");
}

export function ReceivableDialog({
  onClose,
  onSubmit,
  receivable,
}: ReceivableDialogProps) {
  const [person, setPerson] = useState(() => receivable?.person ?? "");
  const [personError, setPersonError] = useState<string | null>(null);
  const [amount, setAmount] = useState(() => amountInputFor(receivable));
  const [amountError, setAmountError] = useState<string | null>(null);
  const [reason, setReason] = useState(() => receivable?.reason ?? "");
  const [dueOn, setDueOn] = useState(() => receivable?.dueOn ?? "");
  const [status, setStatus] = useState<Exclude<ReceivableStatus, "paid">>(() =>
    receivable?.status === "requested" ? "requested" : "not_requested",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedPerson = person.trim();
    const amountCents = parseAmount(amount);

    setPersonError(trimmedPerson ? null : "Enter the person's name.");
    setAmountError(
      amountCents === null ? "Enter a valid non-negative amount." : null,
    );
    if (!trimmedPerson || amountCents === null) return;

    setIsSubmitting(true);
    await onSubmit({
      person: trimmedPerson,
      amountCents,
      reason: reason.trim() || null,
      dueOn: dueOn || null,
      status,
    });
    setIsSubmitting(false);
    onClose();
  }

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {receivable ? "Edit money owed" : "Add money owed"}
          </DialogTitle>
          <DialogDescription>
            Track money before it arrives. It becomes income only when you mark
            it paid.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-5" onSubmit={submit}>
          <FormField error={personError} label="Person">
            {(field) => (
              <input
                {...field}
                autoComplete="off"
                className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                onChange={(event) => {
                  setPerson(event.target.value);
                  if (personError) setPersonError(null);
                }}
                placeholder="Who owes you?"
                value={person}
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

            <FormField hint="Optional" label="Due date">
              {(field) => (
                <input
                  {...field}
                  className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                  onChange={(event) => setDueOn(event.target.value)}
                  type="date"
                  value={dueOn}
                />
              )}
            </FormField>
          </div>

          <FormField label="Status">
            {(field) => (
              <Select
                onValueChange={(value) =>
                  setStatus(value as Exclude<ReceivableStatus, "paid">)
                }
                value={status}
              >
                <SelectTrigger
                  aria-describedby={field["aria-describedby"]}
                  aria-invalid={field["aria-invalid"]}
                  className="w-full bg-surface"
                  id={field.id}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_STATUSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>

          <FormField hint="Optional" label="Reason">
            {(field) => (
              <textarea
                {...field}
                className="min-h-24 rounded-md border border-input bg-surface px-3 py-2 text-foreground"
                onChange={(event) => setReason(event.target.value)}
                placeholder="Dinner, tickets, shared supplies..."
                value={reason}
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
                : receivable
                  ? "Save changes"
                  : "Add money owed"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
