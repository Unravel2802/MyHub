import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FinanceTransaction } from "@/src/modules/finance/types";

vi.mock("@/src/modules/finance/FinanceRepository", () => ({
  getTransactions: vi.fn(),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
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
  useFinanceStore.setState({
    transactions: [],
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
});
