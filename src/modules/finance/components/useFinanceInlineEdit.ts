"use client";

import { useState, type FocusEvent, type KeyboardEvent } from "react";
import { formatCents, parseAmount } from "@/src/lib/money";
import { categoriesForKind } from "@/src/modules/finance/financeCategories";
import type { UpdateTransactionInput } from "@/src/modules/finance/FinanceRepository";
import type {
  FinanceTransaction,
  TransactionKind,
} from "@/src/modules/finance/types";

export type EditableField = "date" | "category" | "kind" | "amount" | "note";

// The ledger's inline-edit state machine, lifted out of the table so the table
// renders and this decides.
//
// The state is deliberately SINGLE and owned here rather than per-row: exactly
// one cell in the table is editable at a time, so a row cannot own it — two
// rows each holding their own `editing` would let you open two editors and
// silently lose one of the drafts.
export interface FinanceInlineEdit {
  isEditing: (transactionId: string, field: EditableField) => boolean;
  draft: string;
  setDraft: (value: string) => void;
  error: string | null;
  clearError: () => void;
  begin: (transaction: FinanceTransaction, field: EditableField) => void;
  onKeyDown: (
    event: KeyboardEvent<HTMLInputElement>,
    transaction: FinanceTransaction,
    field: EditableField,
  ) => void;
  onBlur: (
    event: FocusEvent<HTMLInputElement>,
    transaction: FinanceTransaction,
    field: EditableField,
  ) => void;
  commitPatch: (id: string, patch: UpdateTransactionInput) => void;
  /** Category is a Select, not a text input — it commits on choice. */
  commitCategory: (transactionId: string, category: string) => void;
  /** Close the editor outright (Escape, or focus leaving the control). */
  close: () => void;
  /** Close the editor for this cell if it is still the one open. */
  closeIfEditing: (transactionId: string, field: EditableField) => void;
  changeKind: (
    transaction: FinanceTransaction,
    nextKind: TransactionKind,
  ) => void;
}

export function useFinanceInlineEdit(
  pendingIds: Set<string>,
  onUpdate: (id: string, input: UpdateTransactionInput) => void,
): FinanceInlineEdit {
  const [editing, setEditing] = useState<{
    id: string;
    field: EditableField;
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commitPatch(id: string, patch: UpdateTransactionInput) {
    setError(null);
    setEditing(null);
    onUpdate(id, patch);
  }

  // Returns false when the draft is invalid, so the blur handler knows to keep
  // focus in the field rather than letting a bad value disappear silently.
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

  return {
    draft,
    error,
    setDraft,
    clearError: () => setError(null),
    isEditing: (transactionId, field) =>
      editing?.id === transactionId && editing.field === field,

    begin(transaction, field) {
      // A row with a write in flight must not become editable: the optimistic
      // value it shows is not yet the value that will be there.
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
    },

    onKeyDown(event, transaction, field) {
      if (event.key === "Escape") {
        event.preventDefault();
        setError(null);
        setEditing(null);
      } else if (event.key === "Enter") {
        event.preventDefault();
        commitText(transaction, field);
      }
    },

    onBlur(event, transaction, field) {
      if (!commitText(transaction, field)) {
        const input = event.currentTarget;
        // Re-focus on the NEXT frame: focus cannot be restored from inside the
        // blur that is still unwinding.
        requestAnimationFrame(() => input.focus());
      }
    },

    commitPatch,
    close: () => setEditing(null),

    // Both of these defer closing by a tick. Radix's Select fires
    // onValueChange / onOpenChange while its popover is still closing, and
    // unmounting the trigger inside that callback strands focus on a removed
    // node — the row then loses keyboard focus entirely.
    commitCategory(transactionId, category) {
      setError(null);
      onUpdate(transactionId, { category });
      window.setTimeout(() => setEditing(null), 0);
    },

    closeIfEditing(transactionId, field) {
      window.setTimeout(
        () =>
          setEditing((current) =>
            current?.id === transactionId && current.field === field
              ? null
              : current,
          ),
        0,
      );
    },

    // Changing kind can invalidate the category (an expense category on an
    // income row), so it falls back to the first valid one rather than leaving
    // a row whose category its own kind does not allow.
    changeKind(transaction, nextKind) {
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
    },
  };
}
