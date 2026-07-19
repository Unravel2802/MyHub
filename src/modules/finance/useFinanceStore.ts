import { create } from "zustand";
import * as FinanceRepository from "@/src/modules/finance/FinanceRepository";
import type {
  CreateTransactionInput,
  UpdateTransactionInput,
} from "@/src/modules/finance/FinanceRepository";
import { monthlySummary } from "@/src/modules/finance/financeSelectors";
import type {
  FinanceTransaction,
  MonthlySummary,
} from "@/src/modules/finance/types";

// Published store for Personal Finance (docs/finance-plan.md, Phase 1). One
// store per module. Errors: console.error the real error, generic string to the
// UI (CLAUDE.md rule 6). Update/delete are optimistic with rollback, matching
// useNoteStore / useTaskStore.

export interface FinanceStore {
  transactions: FinanceTransaction[];
  isLoading: boolean;
  isCreating: boolean;
  pendingIds: Set<string>;
  error: string | null;

  fetchTransactions: () => Promise<void>;
  createTransaction: (input: CreateTransactionInput) => Promise<void>;
  updateTransaction: (
    id: string,
    input: UpdateTransactionInput,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  // The in / out / net for the month containing `date`, derived from state.
  summaryForMonth: (date: Date) => MonthlySummary;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

function withId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.add(id);
  return next;
}

function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

// Convert a partial update input into the camelCase shape held in state, for the
// optimistic pre-server render.
function optimisticPatch(
  input: UpdateTransactionInput,
): Partial<FinanceTransaction> {
  const patch: Partial<FinanceTransaction> = {};
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.amountCents !== undefined) patch.amountCents = input.amountCents;
  if (input.category !== undefined) patch.category = input.category;
  if (input.occurredOn !== undefined) patch.occurredOn = input.occurredOn;
  if (input.note !== undefined) patch.note = input.note ?? null;
  return patch;
}

export const useFinanceStore = create<FinanceStore>((set, get) => ({
  transactions: [],
  isLoading: false,
  isCreating: false,
  pendingIds: new Set(),
  error: null,

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const transactions = await FinanceRepository.getTransactions();
      set({ transactions, isLoading: false });
    } catch (error) {
      set({ isLoading: false, error: toUserMessage(error) });
    }
  },

  createTransaction: async (input) => {
    set({ isCreating: true, error: null });
    try {
      const created = await FinanceRepository.createTransaction(input);
      set({
        transactions: [created, ...get().transactions],
        isCreating: false,
      });
    } catch (error) {
      set({ isCreating: false, error: toUserMessage(error) });
    }
  },

  updateTransaction: async (id, input) => {
    const previous = get().transactions;
    set({
      transactions: previous.map((transaction) =>
        transaction.id === id
          ? { ...transaction, ...optimisticPatch(input) }
          : transaction,
      ),
      pendingIds: withId(get().pendingIds, id),
      error: null,
    });
    try {
      const updated = await FinanceRepository.updateTransaction(id, input);
      set({
        transactions: get().transactions.map((transaction) =>
          transaction.id === id ? updated : transaction,
        ),
        pendingIds: withoutId(get().pendingIds, id),
      });
    } catch (error) {
      set({
        transactions: previous,
        pendingIds: withoutId(get().pendingIds, id),
        error: toUserMessage(error),
      });
    }
  },

  deleteTransaction: async (id) => {
    const previous = get().transactions;
    set({
      transactions: previous.filter((transaction) => transaction.id !== id),
      pendingIds: withId(get().pendingIds, id),
      error: null,
    });
    try {
      await FinanceRepository.deleteTransaction(id);
      set({ pendingIds: withoutId(get().pendingIds, id) });
    } catch (error) {
      set({
        transactions: previous,
        pendingIds: withoutId(get().pendingIds, id),
        error: toUserMessage(error),
      });
    }
  },

  summaryForMonth: (date) => monthlySummary(get().transactions, date),
}));
