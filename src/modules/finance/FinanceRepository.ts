import { supabase } from "@/src/lib/supabaseClient";
import type {
  FinanceTransaction,
  TransactionKind,
} from "@/src/modules/finance/types";

// Published repository for Personal Finance (docs/finance-plan.md, Phase 1).
// Soft deletes only. Owns finance_transactions (migration 0019). The
// recurring_bills / budgets / settings tables and their methods arrive in
// Phases 2-3. Row <-> camelCase mapping mirrors every other *Repository.ts.

interface FinanceTransactionRow {
  id: string;
  kind: TransactionKind;
  amount_cents: number;
  category: string;
  occurred_on: string;
  note: string | null;
  bill_id: string | null;
  paid_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: FinanceTransactionRow): FinanceTransaction {
  return {
    id: row.id,
    kind: row.kind,
    amountCents: row.amount_cents,
    category: row.category,
    occurredOn: row.occurred_on,
    note: row.note,
    billId: row.bill_id,
    paidAt: row.paid_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateTransactionInput {
  kind: TransactionKind;
  amountCents: number;
  category: string;
  occurredOn: string; // yyyy-MM-dd
  note?: string | null;
}

export type UpdateTransactionInput = Partial<CreateTransactionInput>;

export async function getTransactions(): Promise<FinanceTransaction[]> {
  const { data, error } = await supabase
    .from("finance_transactions")
    .select("*")
    .is("deleted_at", null)
    .order("occurred_on", { ascending: false });

  if (error) throw error;
  return data.map(fromRow);
}

// Ad-hoc transactions settle on creation — paid_at = now(). A DUE bill instance
// (Phase 2) is created with paid_at null instead, by the generation logic.
export async function createTransaction(
  input: CreateTransactionInput,
): Promise<FinanceTransaction> {
  const { data, error } = await supabase
    .from("finance_transactions")
    .insert({
      kind: input.kind,
      amount_cents: input.amountCents,
      category: input.category,
      occurred_on: input.occurredOn,
      note: input.note ?? null,
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function updateTransaction(
  id: string,
  input: UpdateTransactionInput,
): Promise<FinanceTransaction> {
  const patch: Record<string, unknown> = {};
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.amountCents !== undefined) patch.amount_cents = input.amountCents;
  if (input.category !== undefined) patch.category = input.category;
  if (input.occurredOn !== undefined) patch.occurred_on = input.occurredOn;
  if (input.note !== undefined) patch.note = input.note ?? null;

  const { data, error } = await supabase
    .from("finance_transactions")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase
    .from("finance_transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}
