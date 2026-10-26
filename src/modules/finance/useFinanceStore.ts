import { create } from "zustand";
import * as FinanceRepository from "@/src/modules/finance/FinanceRepository";
import type {
  CreateBillInput,
  CreateHouseholdMemberInput,
  CreateReceivableInput,
  CreateTransactionInput,
  UpdateBillInput,
  UpdateHouseholdMemberInput,
  UpdateReceivableInput,
  UpdateTransactionInput,
} from "@/src/modules/finance/FinanceRepository";
import {
  budgetProgressForMonth,
  monthlySummary,
  outstandingReceivables,
  totalOwedCents,
} from "@/src/modules/finance/financeSelectors";
import { computeRunway } from "@/src/modules/finance/runway";
import {
  planRentSplit,
  rentShareReason,
  type RentSplitError,
  type UtilityItem,
} from "@/src/modules/finance/rentSplit";
import {
  planSplit,
  type SplitError,
  type SplitParticipant,
} from "@/src/modules/finance/splitBill";
import type {
  Budget,
  BudgetProgress,
  FinanceSettings,
  FinanceTransaction,
  HouseholdMember,
  MonthlySummary,
  Receivable,
  RecurringBill,
  Runway,
} from "@/src/modules/finance/types";

// Published store for Personal Finance (docs/finance-plan.md, Phase 1). One
// store per module. Errors: console.error the real error, generic string to the
// UI (CLAUDE.md rule 6). Update/delete are optimistic with rollback, matching
// useNoteStore / useTaskStore.

export interface SplitIntoReceivablesInput {
  totalCents: number;
  participants: SplitParticipant[];
  reason?: string | null;
  dueOn?: string | null;
}

export interface SplitRentInput {
  // Heads every receivable's reason, e.g. "Rent Oct 2026".
  title: string;
  utilities: UtilityItem[];
  dueOn?: string | null;
}

export interface FinanceStore {
  transactions: FinanceTransaction[];
  bills: RecurringBill[];
  budgets: Budget[];
  receivables: Receivable[];
  household: HouseholdMember[];
  settings: FinanceSettings | null;
  isLoading: boolean;
  isCreating: boolean;
  pendingIds: Set<string>;
  error: string | null;

  // Generates this month's bill instances (best-effort) before reading, so due
  // bills appear on the finance page without needing the dashboard.
  fetchTransactions: () => Promise<void>;
  createTransaction: (input: CreateTransactionInput) => Promise<void>;
  updateTransaction: (
    id: string,
    input: UpdateTransactionInput,
  ) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  // Mark a due bill instance paid (optimistic).
  payBill: (transactionId: string) => Promise<void>;

  fetchBills: () => Promise<void>;
  createBill: (input: CreateBillInput) => Promise<void>;
  updateBill: (id: string, input: UpdateBillInput) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;

  fetchBudgets: () => Promise<void>;
  upsertBudget: (category: string, amountCents: number) => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;

  fetchSettings: () => Promise<void>;
  updateSavings: (currentSavingsCents: number) => Promise<void>;

  fetchReceivables: () => Promise<void>;
  createReceivable: (input: CreateReceivableInput) => Promise<void>;
  updateReceivable: (id: string, input: UpdateReceivableInput) => Promise<void>;
  deleteReceivable: (id: string) => Promise<void>;
  // Split `totalCents` evenly across `participants` (see splitBill.ts) and save
  // one receivable per person who isn't you, all sharing `reason` / `dueOn`.
  // Returns the planning error (nothing saved) so the form can show it; a
  // persistence failure sets `error` like every other action and returns null.
  splitIntoReceivables: (
    input: SplitIntoReceivablesInput,
  ) => Promise<SplitError | null>;
  // Convert a receivable to a settled income transaction and mark it paid. The
  // new transaction lands in `transactions` so the ledger + summary update.
  markReceivablePaid: (id: string) => Promise<void>;

  fetchHousehold: () => Promise<void>;
  createHouseholdMember: (input: CreateHouseholdMemberInput) => Promise<void>;
  updateHouseholdMember: (
    id: string,
    input: UpdateHouseholdMemberInput,
  ) => Promise<void>;
  deleteHouseholdMember: (id: string) => Promise<void>;
  // Mark which member is you (null = nobody). Optimistic with rollback.
  setHouseholdMe: (id: string | null) => Promise<void>;
  // Split this month's rent over `household` (see rentSplit.ts): one
  // receivable per OTHER member for room rent + their utility shares, reason
  // itemized. Same return contract as splitIntoReceivables.
  splitRent: (input: SplitRentInput) => Promise<RentSplitError | null>;

  // The in / out / net for the month containing `date`, derived from state.
  summaryForMonth: (date: Date) => MonthlySummary;
  // The still-unpaid "owed to me" entries + the total owed (integer cents).
  outstandingReceivables: () => Receivable[];
  totalOwedCents: () => number;
  // Per-category budget spend vs limit for the month containing `date`.
  budgetProgressForMonth: (date: Date) => BudgetProgress[];
  // Runway (savings / avg monthly burn) as of `date`, or null when not
  // depleting savings / no data.
  runwayFor: (date: Date) => Runway | null;
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
  bills: [],
  budgets: [],
  receivables: [],
  household: [],
  settings: null,
  isLoading: false,
  isCreating: false,
  pendingIds: new Set(),
  error: null,

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      // Best-effort: a generation failure shouldn't blank the ledger (it also
      // regenerates from the dashboard). Mirrors useTaskStore.fetchTasks.
      await FinanceRepository.regenerateMonthlyBillInstances().catch((error) =>
        console.error(error),
      );
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

  payBill: async (transactionId) => {
    const previous = get().transactions;
    const now = new Date().toISOString();
    set({
      transactions: previous.map((transaction) =>
        transaction.id === transactionId
          ? { ...transaction, paidAt: now }
          : transaction,
      ),
      pendingIds: withId(get().pendingIds, transactionId),
      error: null,
    });
    try {
      const updated = await FinanceRepository.payBillInstance(transactionId);
      set({
        transactions: get().transactions.map((transaction) =>
          transaction.id === transactionId ? updated : transaction,
        ),
        pendingIds: withoutId(get().pendingIds, transactionId),
      });
    } catch (error) {
      set({
        transactions: previous,
        pendingIds: withoutId(get().pendingIds, transactionId),
        error: toUserMessage(error),
      });
    }
  },

  fetchBills: async () => {
    try {
      const bills = await FinanceRepository.getBills();
      set({ bills });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  createBill: async (input) => {
    try {
      const created = await FinanceRepository.createBill(input);
      set({ bills: [...get().bills, created] });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  updateBill: async (id, input) => {
    const previous = get().bills;
    try {
      const updated = await FinanceRepository.updateBill(id, input);
      set({
        bills: get().bills.map((bill) => (bill.id === id ? updated : bill)),
      });
    } catch (error) {
      set({ bills: previous, error: toUserMessage(error) });
    }
  },

  deleteBill: async (id) => {
    const previous = get().bills;
    set({ bills: previous.filter((bill) => bill.id !== id), error: null });
    try {
      await FinanceRepository.deleteBill(id);
    } catch (error) {
      set({ bills: previous, error: toUserMessage(error) });
    }
  },

  fetchBudgets: async () => {
    try {
      const budgets = await FinanceRepository.getBudgets();
      set({ budgets });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  upsertBudget: async (category, amountCents) => {
    try {
      const saved = await FinanceRepository.upsertBudget(category, amountCents);
      const others = get().budgets.filter(
        (budget) => budget.category !== category,
      );
      set({ budgets: [...others, saved] });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  deleteBudget: async (id) => {
    const previous = get().budgets;
    set({
      budgets: previous.filter((budget) => budget.id !== id),
      error: null,
    });
    try {
      await FinanceRepository.deleteBudget(id);
    } catch (error) {
      set({ budgets: previous, error: toUserMessage(error) });
    }
  },

  fetchSettings: async () => {
    try {
      const settings = await FinanceRepository.getSettings();
      set({ settings });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  updateSavings: async (currentSavingsCents) => {
    const previous = get().settings;
    set({ settings: { currentSavingsCents }, error: null });
    try {
      const settings =
        await FinanceRepository.updateSavings(currentSavingsCents);
      set({ settings });
    } catch (error) {
      set({ settings: previous, error: toUserMessage(error) });
    }
  },

  fetchReceivables: async () => {
    try {
      const receivables = await FinanceRepository.getReceivables();
      set({ receivables });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  createReceivable: async (input) => {
    try {
      const created = await FinanceRepository.createReceivable(input);
      set({ receivables: [created, ...get().receivables] });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  splitIntoReceivables: async ({ totalCents, participants, reason, dueOn }) => {
    const result = planSplit(totalCents, participants);
    if (!result.ok) return result.error;
    try {
      const created = await FinanceRepository.createReceivables(
        result.plan.shares.map((share) => ({
          person: share.name,
          amountCents: share.amountCents,
          reason: reason ?? null,
          dueOn: dueOn ?? null,
          status: "not_requested",
        })),
      );
      set({ receivables: [...created, ...get().receivables] });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
    return null;
  },

  fetchHousehold: async () => {
    try {
      const household = await FinanceRepository.getHouseholdMembers();
      set({ household });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  createHouseholdMember: async (input) => {
    try {
      const created = await FinanceRepository.createHouseholdMember(input);
      set({ household: [...get().household, created] });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  updateHouseholdMember: async (id, input) => {
    const previous = get().household;
    try {
      const updated = await FinanceRepository.updateHouseholdMember(id, input);
      set({
        household: get().household.map((member) =>
          member.id === id ? updated : member,
        ),
      });
    } catch (error) {
      set({ household: previous, error: toUserMessage(error) });
    }
  },

  deleteHouseholdMember: async (id) => {
    const previous = get().household;
    set({ household: previous.filter((member) => member.id !== id) });
    try {
      await FinanceRepository.deleteHouseholdMember(id);
    } catch (error) {
      set({ household: previous, error: toUserMessage(error) });
    }
  },

  setHouseholdMe: async (id) => {
    const previous = get().household;
    set({
      household: previous.map((member) => ({
        ...member,
        isMe: member.id === id,
      })),
    });
    try {
      await FinanceRepository.setHouseholdMe(id);
    } catch (error) {
      set({ household: previous, error: toUserMessage(error) });
    }
  },

  splitRent: async ({ title, utilities, dueOn }) => {
    const result = planRentSplit(get().household, utilities);
    if (!result.ok) return result.error;
    try {
      const created = await FinanceRepository.createReceivables(
        result.shares
          .filter((share) => !share.isMe && share.totalCents > 0)
          .map((share) => ({
            person: share.name,
            amountCents: share.totalCents,
            reason: rentShareReason(title.trim(), share, utilities),
            dueOn: dueOn ?? null,
            status: "not_requested",
          })),
      );
      set({ receivables: [...created, ...get().receivables] });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
    return null;
  },

  updateReceivable: async (id, input) => {
    const previous = get().receivables;
    try {
      const updated = await FinanceRepository.updateReceivable(id, input);
      set({
        receivables: get().receivables.map((receivable) =>
          receivable.id === id ? updated : receivable,
        ),
      });
    } catch (error) {
      set({ receivables: previous, error: toUserMessage(error) });
    }
  },

  deleteReceivable: async (id) => {
    const previous = get().receivables;
    set({
      receivables: previous.filter((receivable) => receivable.id !== id),
      error: null,
    });
    try {
      await FinanceRepository.deleteReceivable(id);
    } catch (error) {
      set({ receivables: previous, error: toUserMessage(error) });
    }
  },

  markReceivablePaid: async (id) => {
    try {
      const { receivable, transaction } =
        await FinanceRepository.markReceivablePaid(id);
      set({
        receivables: get().receivables.map((existing) =>
          existing.id === id ? receivable : existing,
        ),
        // The new income transaction lands in the ledger; dedupe in case a
        // fetch already picked it up.
        transactions: [
          transaction,
          ...get().transactions.filter((t) => t.id !== transaction.id),
        ],
      });
    } catch (error) {
      set({ error: toUserMessage(error) });
    }
  },

  summaryForMonth: (date) => monthlySummary(get().transactions, date),
  budgetProgressForMonth: (date) =>
    budgetProgressForMonth(get().transactions, get().budgets, date),
  runwayFor: (date) =>
    computeRunway(
      get().transactions,
      get().settings?.currentSavingsCents ?? 0,
      date,
    ),
  outstandingReceivables: () => outstandingReceivables(get().receivables),
  totalOwedCents: () => totalOwedCents(get().receivables),
}));
