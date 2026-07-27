import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TradingEntry, TradingTrade } from "@/src/modules/trading/types";

vi.mock("@/src/modules/trading/TradingRepository", () => ({
  getTrades: vi.fn(),
  createTrade: vi.fn(),
  updateTrade: vi.fn(),
  closeTrade: vi.fn(),
  reopenTrade: vi.fn(),
  deleteTrade: vi.fn(),
  getEntries: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
}));

import * as TradingRepository from "@/src/modules/trading/TradingRepository";
import { useTradingStore } from "@/src/modules/trading/useTradingStore";

const repository = vi.mocked(TradingRepository);

function trade(
  overrides: Partial<TradingTrade> & { id: string },
): TradingTrade {
  return {
    ticker: "NVDA",
    entryDate: "2026-07-26",
    entryPriceCents: 12000,
    stopPriceCents: 11500,
    shares: 2,
    exitDate: null,
    exitPriceCents: null,
    exitReason: null,
    pnlCents: null,
    deletedAt: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

function entry(
  overrides: Partial<TradingEntry> & { id: string },
): TradingEntry {
  return {
    date: "2026-07-26",
    ticker: "NVDA",
    signal: "buy",
    priceCents: 12000,
    emaFastCents: null,
    emaSlowCents: null,
    rsi: null,
    emotion: "confident",
    rulesFollowed: true,
    ruleBreak: null,
    notes: null,
    tradeId: "trade",
    deletedAt: null,
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    ...overrides,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function reset(trades: TradingTrade[] = [], entries: TradingEntry[] = []) {
  useTradingStore.setState({
    trades,
    entries,
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  reset();
});

describe("useTradingStore trades", () => {
  it("returns the real trade after replacing its optimistic row", async () => {
    const created = trade({ id: "created" });
    repository.createTrade.mockResolvedValue(created);

    const result = await useTradingStore.getState().createTrade({
      ticker: "NVDA",
      entryDate: "2026-07-26",
      entryPriceCents: 12000,
      stopPriceCents: 11500,
      shares: 2,
    });

    expect(result).toEqual(created);
    expect(useTradingStore.getState()).toMatchObject({
      trades: [created],
      isCreating: false,
      error: null,
    });
  });

  it("rolls back a failed trade create and exposes a generic error", async () => {
    const existing = trade({ id: "existing" });
    reset([existing]);
    repository.createTrade.mockRejectedValue(new Error("table detail"));

    await expect(
      useTradingStore.getState().createTrade({
        ticker: "AMD",
        entryPriceCents: 15000,
        shares: 1,
      }),
    ).rejects.toThrow("table detail");

    expect(useTradingStore.getState()).toMatchObject({
      trades: [existing],
      isCreating: false,
      error: "Something went wrong, please try again later.",
    });
  });

  it("atomically closes a trade while tracking its pending id", async () => {
    const open = trade({ id: "trade" });
    reset([open]);
    const pending = deferred<TradingTrade>();
    repository.closeTrade.mockReturnValue(pending.promise);

    const closing = useTradingStore.getState().closeTrade("trade", {
      exitDate: "2026-07-27",
      exitPriceCents: 13000,
      exitReason: "manual",
      pnlCents: 2000,
    });

    expect(useTradingStore.getState().pendingIds).toEqual(["trade"]);
    expect(useTradingStore.getState().trades[0]).toMatchObject({
      exitDate: "2026-07-27",
      exitPriceCents: 13000,
      exitReason: "manual",
      pnlCents: 2000,
    });

    const closed = trade({
      id: "trade",
      exitDate: "2026-07-27",
      exitPriceCents: 13000,
      exitReason: "manual",
      pnlCents: 2000,
    });
    pending.resolve(closed);
    await closing;

    expect(useTradingStore.getState()).toMatchObject({
      trades: [closed],
      pendingIds: [],
      error: null,
    });
  });

  it("rolls back a failed update after exposing the pending id", async () => {
    const existing = trade({ id: "trade", shares: 2 });
    reset([existing]);
    const pending = deferred<TradingTrade>();
    repository.updateTrade.mockReturnValue(pending.promise);

    const updating = useTradingStore
      .getState()
      .updateTrade("trade", { shares: 4 });

    expect(useTradingStore.getState().pendingIds).toEqual(["trade"]);
    expect(useTradingStore.getState().trades[0].shares).toBe(4);

    pending.reject(new Error("update failed"));
    await updating;

    expect(useTradingStore.getState()).toMatchObject({
      trades: [existing],
      pendingIds: [],
      error: "Something went wrong, please try again later.",
    });
  });

  it("clears all exit fields together when reopening", async () => {
    const closed = trade({
      id: "trade",
      exitDate: "2026-07-27",
      exitPriceCents: 13000,
      exitReason: "manual",
      pnlCents: 2000,
    });
    const reopened = trade({ id: "trade" });
    reset([closed]);
    repository.reopenTrade.mockResolvedValue(reopened);

    await useTradingStore.getState().reopenTrade("trade");

    expect(useTradingStore.getState().trades[0]).toEqual(reopened);
    expect(useTradingStore.getState().pendingIds).toEqual([]);
  });
});

describe("useTradingStore entries", () => {
  it("rolls back a failed entry create and sets the generic error", async () => {
    const existing = entry({ id: "existing" });
    reset([], [existing]);
    repository.createEntry.mockRejectedValue(new Error("schema detail"));

    await useTradingStore.getState().createEntry({
      ticker: "NVDA",
      signal: "hold",
    });

    expect(useTradingStore.getState()).toMatchObject({
      entries: [existing],
      isCreating: false,
      error: "Something went wrong, please try again later.",
    });
  });
});
