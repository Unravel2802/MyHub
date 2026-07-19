"use client";

import { useState, type FormEvent } from "react";
import { FormField } from "@/src/components/ui/FormField";
import { formatCents, parseAmount } from "@/src/modules/finance/money";

type SavingsEditorProps = {
  currentSavingsCents: number | null;
  onSubmit: (currentSavingsCents: number) => Promise<void>;
};

export function SavingsEditor({
  currentSavingsCents,
  onSubmit,
}: SavingsEditorProps) {
  const [amount, setAmount] = useState(() =>
    currentSavingsCents === null
      ? ""
      : formatCents(currentSavingsCents).replace(/[$,]/g, ""),
  );
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
    await onSubmit(amountCents);
    setIsSubmitting(false);
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <FormField
        error={amountError}
        hint="Your current available cash savings."
        label="Current savings"
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
      <button
        className="h-10 justify-self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
        disabled={isSubmitting || currentSavingsCents === null}
        type="submit"
      >
        {isSubmitting ? "Saving..." : "Update savings"}
      </button>
    </form>
  );
}
