import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Budget,
  FinanceSettings,
  FinanceTransaction,
  RecurringBill,
} from "@/src/modules/finance/types";

vi.mock("@/src/modules/finance/FinanceRepository", () => ({
  getTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  payBillInstance: vi.fn(),
  regenerateMonthlyBillInstances: vi.fn(),
  getBills: vi.fn(),
  createBill: vi.fn(),
  updateBill: vi.fn(),
  deleteBill: vi.fn(),
  getBudgets: vi.fn(),
  upsertBudget: vi.fn(),
  deleteBudget: vi.fn(),
  getSettings: vi.fn(),
  updateSavings: vi.fn(),
}));

import * as FinanceRepository from "@/src/modules/finance/FinanceRepository";
import { useFinanceStore } from "@/src/modules/finance/useFinanceStore";

const repository = vi.mocked(FinanceRepository);

function transaction(
  overrides: Partial<FinanceTransaction> & { id: string },
): FinanceTransaction {
  return {
    id: overrides.id,
    kind: overrides.kind ?? "expense",
    amountCents: overrides.amountCents ?? 1250,
    category: overrides.category ?? "groceries",
    occurredOn: overrides.occurredOn ?? "2026-07-19",
    note: overrides.note ?? null,
    billId: overrides.billId ?? null,
    paidAt: overrides.paidAt ?? "2026-07-19T00:00:00.000Z",
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-19T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-19T00:00:00.000Z",
  };
}

function bill(
  overrides: Partial<RecurringBill> & { id: string },
): RecurringBill {
  return {
    id: overrides.id,
    name: overrides.name ?? "Rent",
    amountCents: overrides.amountCents ?? 120000,
    category: overrides.category ?? "rent",
    dayOfMonth: overrides.dayOfMonth ?? 1,
    active: overrides.active ?? true,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-19T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-19T00:00:00.000Z",
  };
}

function budget(overrides: Partial<Budget> & { id: string }): Budget {
  return {
    id: overrides.id,
    category: overrides.category ?? "groceries",
    amountCents: overrides.amountCents ?? 50000,
    deletedAt: overrides.deletedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-07-19T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-07-19T00:00:00.000Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  repository.regenerateMonthlyBillInstances.mockResolvedValue([]);
  useFinanceStore.setState({
    transactions: [],
    bills: [],
    budgets: [],
    settings: null,
    isLoading: false,
    isCreating: false,
    pendingIds: new Set(),
    error: null,
  });
});

describe("useFinanceStore", () => {
  it("adds a created transaction and preserves state on create failure", async () => {
    const existing = transaction({ id: "existing" });
    const created = transaction({ id: "created", amountCents: 5000 });
    useFinanceStore.setState({ transactions: [existing] });
    repository.createTransaction.mockResolvedValueOnce(created);

    await useFinanceStore.getState().createTransaction({
      kind: "expense",
      amountCents: 5000,
      category: "rent",
      occurredOn: "2026-07-19",
      note: null,
    });

    expect(useFinanceStore.getState()).toMatchObject({
      transactions: [created, existing],
      isCreating: false,
      error: null,
    });

    repository.createTransaction.mockRejectedValueOnce(
      new Error("create failed"),
    );
    await useFinanceStore.getState().createTransaction({
      kind: "income",
      amountCents: 1000,
      category: "stipend",
      occurredOn: "2026-07-19",
    });

    expect(useFinanceStore.getState().transactions).toEqual([
      created,
      existing,
    ]);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("exposes the create pending state while the repository is in flight", async () => {
    const pending = deferred<FinanceTransaction>();
    repository.createTransaction.mockReturnValueOnce(pending.promise);

    const request = useFinanceStore.getState().createTransaction({
      kind: "expense",
      amountCents: 2500,
      category: "utilities",
      occurredOn: "2026-07-19",
    });

    expect(useFinanceStore.getState()).toMatchObject({
      transactions: [],
      isCreating: true,
    });

    pending.resolve(transaction({ id: "created", amountCents: 2500 }));
    await request;
    expect(useFinanceStore.getState().isCreating).toBe(false);
  });

  it("optimistically updates and commits the repository result", async () => {
    const original = transaction({ id: "txn", amountCents: 1250 });
    const updated = transaction({ id: "txn", amountCents: 2000 });
    const pending = deferred<FinanceTransaction>();
    useFinanceStore.setState({ transactions: [original] });
    repository.updateTransaction.mockReturnValueOnce(pending.promise);

    const request = useFinanceStore
      .getState()
      .updateTransaction("txn", { amountCents: 2000 });

    expect(useFinanceStore.getState().transactions[0].amountCents).toBe(2000);
    expect(useFinanceStore.getState().pendingIds.has("txn")).toBe(true);

    pending.resolve(updated);
    await request;
    expect(useFinanceStore.getState().transactions).toEqual([updated]);
    expect(useFinanceStore.getState().pendingIds.has("txn")).toBe(false);
  });

  it("rolls an optimistic update back when the repository fails", async () => {
    const original = transaction({ id: "txn", amountCents: 1250 });
    useFinanceStore.setState({ transactions: [original] });
    repository.updateTransaction.mockRejectedValueOnce(
      new Error("update failed"),
    );

    await useFinanceStore
      .getState()
      .updateTransaction("txn", { amountCents: 9999 });

    expect(useFinanceStore.getState().transactions).toEqual([original]);
    expect(useFinanceStore.getState().pendingIds.has("txn")).toBe(false);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("optimistically deletes and restores the row on failure", async () => {
    const original = transaction({ id: "txn" });
    const pending = deferred<void>();
    useFinanceStore.setState({ transactions: [original] });
    repository.deleteTransaction.mockReturnValueOnce(pending.promise);

    const request = useFinanceStore.getState().deleteTransaction("txn");
    expect(useFinanceStore.getState().transactions).toEqual([]);
    expect(useFinanceStore.getState().pendingIds.has("txn")).toBe(true);
    pending.resolve();
    await request;
    expect(useFinanceStore.getState().pendingIds.has("txn")).toBe(false);

    useFinanceStore.setState({ transactions: [original], error: null });
    repository.deleteTransaction.mockRejectedValueOnce(
      new Error("delete failed"),
    );
    await useFinanceStore.getState().deleteTransaction("txn");

    expect(useFinanceStore.getState().transactions).toEqual([original]);
    expect(useFinanceStore.getState().pendingIds.has("txn")).toBe(false);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("fetches, creates, and updates recurring bills", async () => {
    const rent = bill({ id: "rent" });
    const utilities = bill({
      id: "utilities",
      name: "Electricity",
      amountCents: 8500,
      category: "utilities",
      dayOfMonth: 15,
    });
    repository.getBills.mockResolvedValueOnce([rent]);

    await useFinanceStore.getState().fetchBills();
    expect(useFinanceStore.getState().bills).toEqual([rent]);

    repository.createBill.mockResolvedValueOnce(utilities);
    await useFinanceStore.getState().createBill({
      name: "Electricity",
      amountCents: 8500,
      category: "utilities",
      dayOfMonth: 15,
      active: true,
    });
    expect(useFinanceStore.getState().bills).toEqual([rent, utilities]);

    const paused = bill({ ...utilities, active: false });
    repository.updateBill.mockResolvedValueOnce(paused);
    await useFinanceStore
      .getState()
      .updateBill(utilities.id, { active: false });
    expect(useFinanceStore.getState().bills).toEqual([rent, paused]);
  });

  it("optimistically deletes a bill and rolls back on failure", async () => {
    const rent = bill({ id: "rent" });
    const pending = deferred<void>();
    useFinanceStore.setState({ bills: [rent] });
    repository.deleteBill.mockReturnValueOnce(pending.promise);

    const request = useFinanceStore.getState().deleteBill(rent.id);
    expect(useFinanceStore.getState().bills).toEqual([]);
    pending.resolve();
    await request;

    useFinanceStore.setState({ bills: [rent], error: null });
    repository.deleteBill.mockRejectedValueOnce(new Error("delete failed"));
    await useFinanceStore.getState().deleteBill(rent.id);

    expect(useFinanceStore.getState().bills).toEqual([rent]);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("optimistically marks a due bill paid and rolls back on failure", async () => {
    const due = transaction({
      id: "due",
      billId: "rent",
      paidAt: null,
      amountCents: 120000,
    });
    const paid = transaction({
      ...due,
      paidAt: "2026-07-19T12:00:00.000Z",
    });
    const pending = deferred<FinanceTransaction>();
    useFinanceStore.setState({ transactions: [due] });
    repository.payBillInstance.mockReturnValueOnce(pending.promise);

    const request = useFinanceStore.getState().payBill(due.id);
    expect(useFinanceStore.getState().transactions[0].paidAt).not.toBeNull();
    expect(useFinanceStore.getState().pendingIds.has(due.id)).toBe(true);
    pending.resolve(paid);
    await request;
    expect(useFinanceStore.getState().transactions).toEqual([paid]);
    expect(useFinanceStore.getState().pendingIds.has(due.id)).toBe(false);

    useFinanceStore.setState({ transactions: [due], error: null });
    repository.payBillInstance.mockRejectedValueOnce(new Error("pay failed"));
    await useFinanceStore.getState().payBill(due.id);

    expect(useFinanceStore.getState().transactions).toEqual([due]);
    expect(useFinanceStore.getState().pendingIds.has(due.id)).toBe(false);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("fetches and upserts monthly budgets by category", async () => {
    const groceries = budget({ id: "groceries" });
    repository.getBudgets.mockResolvedValueOnce([groceries]);

    await useFinanceStore.getState().fetchBudgets();
    expect(useFinanceStore.getState().budgets).toEqual([groceries]);

    const updated = budget({ id: "groceries", amountCents: 75000 });
    repository.upsertBudget.mockResolvedValueOnce(updated);
    await useFinanceStore.getState().upsertBudget("groceries", 75000);
    expect(useFinanceStore.getState().budgets).toEqual([updated]);

    const rent = budget({
      id: "rent",
      category: "rent",
      amountCents: 120000,
    });
    repository.upsertBudget.mockResolvedValueOnce(rent);
    await useFinanceStore.getState().upsertBudget("rent", 120000);
    expect(useFinanceStore.getState().budgets).toEqual([updated, rent]);
  });

  it("optimistically removes a budget and rolls back on failure", async () => {
    const groceries = budget({ id: "groceries" });
    const pending = deferred<void>();
    useFinanceStore.setState({ budgets: [groceries] });
    repository.deleteBudget.mockReturnValueOnce(pending.promise);

    const request = useFinanceStore.getState().deleteBudget(groceries.id);
    expect(useFinanceStore.getState().budgets).toEqual([]);
    pending.resolve();
    await request;

    useFinanceStore.setState({ budgets: [groceries], error: null });
    repository.deleteBudget.mockRejectedValueOnce(new Error("delete failed"));
    await useFinanceStore.getState().deleteBudget(groceries.id);

    expect(useFinanceStore.getState().budgets).toEqual([groceries]);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });

  it("fetches savings and rolls an optimistic update back on failure", async () => {
    const initial: FinanceSettings = { currentSavingsCents: 100000 };
    repository.getSettings.mockResolvedValueOnce(initial);
    await useFinanceStore.getState().fetchSettings();
    expect(useFinanceStore.getState().settings).toEqual(initial);

    const saved: FinanceSettings = { currentSavingsCents: 250000 };
    const pending = deferred<FinanceSettings>();
    repository.updateSavings.mockReturnValueOnce(pending.promise);
    const request = useFinanceStore.getState().updateSavings(250000);
    expect(useFinanceStore.getState().settings).toEqual({
      currentSavingsCents: 250000,
    });
    pending.resolve(saved);
    await request;
    expect(useFinanceStore.getState().settings).toEqual(saved);

    useFinanceStore.setState({ settings: initial, error: null });
    repository.updateSavings.mockRejectedValueOnce(new Error("save failed"));
    await useFinanceStore.getState().updateSavings(999999);
    expect(useFinanceStore.getState().settings).toEqual(initial);
    expect(useFinanceStore.getState().error).toBe(
      "Something went wrong, please try again later.",
    );
  });
});
