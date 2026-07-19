import { supabase } from "@/src/lib/supabaseClient";
import {
  billOccurrenceKey,
  missingBillInstances,
} from "@/src/modules/finance/billRecurrence";
import type {
  Budget,
  FinanceSettings,
  FinanceTransaction,
  RecurringBill,
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

// Mark a generated bill instance paid. Sets paid_at so it leaves "bills due" and
// starts counting toward month-to-date spend. The amount stays the bill's
// expected amount — edit the transaction if the actual differed.
export async function payBillInstance(
  transactionId: string,
): Promise<FinanceTransaction> {
  const { data, error } = await supabase
    .from("finance_transactions")
    .update({ paid_at: new Date().toISOString() })
    .eq("id", transactionId)
    .select()
    .single();

  if (error) throw error;
  return fromRow(data);
}

// --- Recurring bills -------------------------------------------------------

interface RecurringBillRow {
  id: string;
  name: string;
  amount_cents: number;
  category: string;
  day_of_month: number;
  active: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromBillRow(row: RecurringBillRow): RecurringBill {
  return {
    id: row.id,
    name: row.name,
    amountCents: row.amount_cents,
    category: row.category,
    dayOfMonth: row.day_of_month,
    active: row.active,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateBillInput {
  name: string;
  amountCents: number;
  category: string;
  dayOfMonth: number;
  active?: boolean;
}

export type UpdateBillInput = Partial<CreateBillInput>;

export async function getBills(): Promise<RecurringBill[]> {
  const { data, error } = await supabase
    .from("recurring_bills")
    .select("*")
    .is("deleted_at", null)
    .order("day_of_month", { ascending: true });

  if (error) throw error;
  return data.map(fromBillRow);
}

export async function createBill(
  input: CreateBillInput,
): Promise<RecurringBill> {
  const { data, error } = await supabase
    .from("recurring_bills")
    .insert({
      name: input.name,
      amount_cents: input.amountCents,
      category: input.category,
      day_of_month: input.dayOfMonth,
      active: input.active ?? true,
    })
    .select()
    .single();

  if (error) throw error;
  return fromBillRow(data);
}

export async function updateBill(
  id: string,
  input: UpdateBillInput,
): Promise<RecurringBill> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.amountCents !== undefined) patch.amount_cents = input.amountCents;
  if (input.category !== undefined) patch.category = input.category;
  if (input.dayOfMonth !== undefined) patch.day_of_month = input.dayOfMonth;
  if (input.active !== undefined) patch.active = input.active;

  const { data, error } = await supabase
    .from("recurring_bills")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return fromBillRow(data);
}

export async function deleteBill(id: string): Promise<void> {
  const { error } = await supabase
    .from("recurring_bills")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// Ensure every active bill has an instance for the month containing `today`, and
// return the instances newly created (empty on a repeat load). Idempotent, and
// mirrors TaskRepository.regenerateWeeklyInstances: it reads existing instances
// INCLUDING soft-deleted ones (a dismissed bill stays dismissed), inserts one
// unpaid expense per missing occurrence, and treats a 23505 unique-violation as
// a concurrent-load success rather than an error.
export async function regenerateMonthlyBillInstances(
  today: Date = new Date(),
): Promise<FinanceTransaction[]> {
  const bills = await getBills();
  const activeBills = bills.filter((bill) => bill.active);
  if (activeBills.length === 0) return [];

  const billIds = activeBills.map((bill) => bill.id);
  const { data: existingRows, error: existingError } = (await supabase
    .from("finance_transactions")
    .select("bill_id, occurred_on")
    .in("bill_id", billIds)) as {
    data: { bill_id: string | null; occurred_on: string | null }[] | null;
    error: unknown;
  };

  if (existingError) throw existingError;
  const existingKeys = new Set(
    (existingRows ?? []).flatMap((row) =>
      row.bill_id && row.occurred_on
        ? [billOccurrenceKey(row.bill_id, row.occurred_on)]
        : [],
    ),
  );

  const pending = missingBillInstances(activeBills, existingKeys, today);
  const created: FinanceTransaction[] = [];

  for (const instance of pending) {
    const { data, error } = await supabase
      .from("finance_transactions")
      .insert({
        kind: "expense" satisfies TransactionKind,
        amount_cents: instance.amountCents,
        category: instance.category,
        occurred_on: instance.occurredOn,
        note: null,
        bill_id: instance.billId,
        // DUE, not yet paid — leaves the summary untouched until marked paid.
        paid_at: null,
      })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") continue;
      throw error;
    }
    created.push(fromRow(data));
  }

  return created;
}

// --- Budgets (Phase 3) -----------------------------------------------------

interface BudgetRow {
  id: string;
  category: string;
  amount_cents: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

function fromBudgetRow(row: BudgetRow): Budget {
  return {
    id: row.id,
    category: row.category,
    amountCents: row.amount_cents,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from("finance_budgets")
    .select("*")
    .is("deleted_at", null)
    .order("category", { ascending: true });

  if (error) throw error;
  return data.map(fromBudgetRow);
}

// One budget per category. Upsert on the PLAIN unique (category) constraint
// (migration 0021), clearing deleted_at so a previously-removed budget for the
// same category is revived rather than colliding.
export async function upsertBudget(
  category: string,
  amountCents: number,
): Promise<Budget> {
  const { data, error } = await supabase
    .from("finance_budgets")
    .upsert(
      { category, amount_cents: amountCents, deleted_at: null },
      { onConflict: "category" },
    )
    .select()
    .single();

  if (error) throw error;
  return fromBudgetRow(data);
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase
    .from("finance_budgets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

// --- Settings (Phase 3) ----------------------------------------------------

export async function getSettings(): Promise<FinanceSettings> {
  const { data, error } = await supabase
    .from("finance_settings")
    .select("current_savings_cents")
    .maybeSingle();

  if (error) throw error;
  return { currentSavingsCents: data?.current_savings_cents ?? 0 };
}

// Single-row upsert on the fixed `id = true` key (migration 0022).
export async function updateSavings(
  currentSavingsCents: number,
): Promise<FinanceSettings> {
  const { data, error } = await supabase
    .from("finance_settings")
    .upsert(
      { id: true, current_savings_cents: currentSavingsCents },
      { onConflict: "id" },
    )
    .select("current_savings_cents")
    .single();

  if (error) throw error;
  return { currentSavingsCents: data.current_savings_cents };
}
