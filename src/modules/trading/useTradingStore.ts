import { create } from "zustand";
import { format } from "date-fns";
import * as TradingRepository from "@/src/modules/trading/TradingRepository";
import type {
  CloseTradeInput,
  CreateEntryInput,
  CreateTradeInput,
} from "@/src/modules/trading/TradingRepository";
import type {
  BacktestStrategy,
  BacktestTrade,
  TradingEntry,
  TradingTrade,
} from "@/src/modules/trading/types";
import { equityCurve as equityCurveFor } from "@/src/modules/trading/equityCurve";
import { tradingStats as tradingStatsFor } from "@/src/modules/trading/tradingStats";

// Published store contract for the Trading Journal. One store per module — this
// must never reach into useFinanceStore or vice versa, even though both live in
// the "money" mini-app; sharing a nav group is not sharing state.
//
// NO Event Bus emission, deliberately (see migration 0038's header). Momentum
// must not learn that a trade happened: the career streak stays a career streak.
//
// The journal actions follow usePrepStore.ts exactly: optimistic update, roll
// back `previousX` and set `error` via toUserMessage() on failure, track
// in-flight ids in `pendingIds`.
//
// The backtest actions deliberately do NOT, because they are reads — there is
// nothing to roll back, so a failure leaves the previous data in place and sets
// `error`.
//
// The SHAPE here is the published contract. If the UI needs something it does
// not expose, extend it here rather than widening a type at the call site or
// reaching past the store into the repository.

export interface TradingStore {
  trades: TradingTrade[];
  entries: TradingEntry[];
  isLoading: boolean;
  error: string | null;
  isCreating: boolean;
  // In-flight ids so the UI can disable per-row controls rather than freezing
  // the whole panel — mirrors usePrepStore / useLeetCodeStore.
  pendingIds: string[];

  fetchTrades: () => Promise<void>;
  // Returns the created trade directly: the log form needs its id synchronously
  // to write onto the BUY entry's `tradeId` in the same submit, rather than
  // re-deriving it from a list re-render.
  createTrade: (input: CreateTradeInput) => Promise<TradingTrade>;
  updateTrade: (
    id: string,
    updates: Partial<CreateTradeInput>,
  ) => Promise<void>;
  // Sets all four exit fields together — the DB's close-is-atomic CHECK rejects
  // any subset, so there is no "partially closed" action by design.
  closeTrade: (id: string, input: CloseTradeInput) => Promise<void>;
  reopenTrade: (id: string) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;

  fetchEntries: () => Promise<void>;
  createEntry: (input: CreateEntryInput) => Promise<void>;
  updateEntry: (
    id: string,
    updates: Partial<CreateEntryInput>,
  ) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;

  // Derived, not stored — see tradingStats.ts / equityCurve.ts, both already
  // implemented and unit-tested, and NOT Codex's to touch. Stats are computed
  // over trades, which is what keeps P&L counted once.
  stats: () => ReturnType<typeof tradingStatsFor>;
  equityCurve: () => ReturnType<typeof equityCurveFor>;
  entriesForTrade: (tradeId: string) => TradingEntry[];

  // --- Backtests (migration 0040) -----------------------------------------
  //
  // READ ONLY. These rows are an imported artifact owned by
  // scripts/seedBacktests.ts; there is deliberately no create/update/delete
  // here, matching the repository. Lives in this store rather than a second one
  // because the rule is one store per MODULE, and backtests are part of Trading.

  backtestStrategies: BacktestStrategy[];
  // Cached per strategy rather than a flat list. macd_momentum alone is 1,576
  // trades, and the browser shows one strategy at a time — refetching that on
  // every tab switch would be pointless traffic. A missing key means "not
  // fetched yet", which is distinct from an empty array meaning "none".
  backtestTradesByStrategy: Record<string, BacktestTrade[]>;
  isLoadingBacktests: boolean;

  fetchBacktestStrategies: () => Promise<void>;
  // Populates backtestTradesByStrategy[strategyId]. Safe to call repeatedly —
  // implementations should skip the round-trip when the key is already present.
  fetchBacktestTrades: (strategyId: string) => Promise<void>;
}

const FAILURE_MESSAGE = "Something went wrong, please try again later.";

function toUserMessage(error: unknown): string {
  console.error(error);
  return FAILURE_MESSAGE;
}

function applyTradeUpdates(
  trade: TradingTrade,
  updates: Partial<CreateTradeInput>,
): TradingTrade {
  return {
    ...trade,
    ...(updates.ticker !== undefined && { ticker: updates.ticker }),
    ...(updates.entryDate !== undefined && { entryDate: updates.entryDate }),
    ...(updates.entryPriceCents !== undefined && {
      entryPriceCents: updates.entryPriceCents,
    }),
    ...(updates.stopPriceCents !== undefined && {
      stopPriceCents: updates.stopPriceCents,
    }),
    ...(updates.shares !== undefined && { shares: updates.shares }),
  };
}

function applyEntryUpdates(
  entry: TradingEntry,
  updates: Partial<CreateEntryInput>,
): TradingEntry {
  return {
    ...entry,
    ...(updates.date !== undefined && { date: updates.date }),
    ...(updates.ticker !== undefined && { ticker: updates.ticker }),
    ...(updates.signal !== undefined && { signal: updates.signal }),
    ...(updates.priceCents !== undefined && {
      priceCents: updates.priceCents,
    }),
    ...(updates.emaFastCents !== undefined && {
      emaFastCents: updates.emaFastCents,
    }),
    ...(updates.emaSlowCents !== undefined && {
      emaSlowCents: updates.emaSlowCents,
    }),
    ...(updates.rsi !== undefined && { rsi: updates.rsi }),
    ...(updates.emotion !== undefined && { emotion: updates.emotion }),
    ...(updates.rulesFollowed !== undefined && {
      rulesFollowed: updates.rulesFollowed,
    }),
    ...(updates.ruleBreak !== undefined && {
      ruleBreak: updates.ruleBreak,
    }),
    ...(updates.notes !== undefined && { notes: updates.notes }),
    ...(updates.tradeId !== undefined && { tradeId: updates.tradeId }),
  };
}

export const useTradingStore = create<TradingStore>((set, get) => {
  const addPending = (id: string) =>
    set({ pendingIds: [...get().pendingIds, id] });
  const removePending = (id: string) =>
    set({ pendingIds: get().pendingIds.filter((pending) => pending !== id) });

  return {
    trades: [],
    entries: [],
    isLoading: false,
    error: null,
    isCreating: false,
    pendingIds: [],
    backtestStrategies: [],
    backtestTradesByStrategy: {},
    isLoadingBacktests: false,

    fetchTrades: async () => {
      set({ isLoading: true, error: null });
      try {
        const trades = await TradingRepository.getTrades();
        set({ trades, isLoading: false });
      } catch (error) {
        set({ isLoading: false, error: toUserMessage(error) });
      }
    },

    createTrade: async (input) => {
      const previousTrades = get().trades;
      const now = new Date().toISOString();
      const optimistic: TradingTrade = {
        id: `optimistic-${crypto.randomUUID()}`,
        ticker: input.ticker,
        entryDate: input.entryDate ?? format(new Date(), "yyyy-MM-dd"),
        entryPriceCents: input.entryPriceCents,
        stopPriceCents: input.stopPriceCents ?? null,
        shares: input.shares,
        exitDate: null,
        exitPriceCents: null,
        exitReason: null,
        pnlCents: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        trades: [optimistic, ...previousTrades],
        isCreating: true,
        error: null,
      });

      try {
        const created = await TradingRepository.createTrade(input);
        set({
          trades: get().trades.map((trade) =>
            trade.id === optimistic.id ? created : trade,
          ),
        });
        return created;
      } catch (error) {
        set({ trades: previousTrades, error: toUserMessage(error) });
        throw error;
      } finally {
        set({ isCreating: false });
      }
    },

    updateTrade: async (id, updates) => {
      const previousTrades = get().trades;
      set({
        trades: previousTrades.map((trade) =>
          trade.id === id ? applyTradeUpdates(trade, updates) : trade,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await TradingRepository.updateTrade(id, updates);
        set({
          trades: get().trades.map((trade) =>
            trade.id === id ? updated : trade,
          ),
        });
      } catch (error) {
        set({ trades: previousTrades, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    closeTrade: async (id, input) => {
      const previousTrades = get().trades;
      const exitDate = input.exitDate ?? format(new Date(), "yyyy-MM-dd");
      set({
        trades: previousTrades.map((trade) =>
          trade.id === id
            ? {
                ...trade,
                exitDate,
                exitPriceCents: input.exitPriceCents,
                exitReason: input.exitReason,
                pnlCents: input.pnlCents,
              }
            : trade,
        ),
        error: null,
      });
      addPending(id);

      try {
        const closed = await TradingRepository.closeTrade(id, input);
        set({
          trades: get().trades.map((trade) =>
            trade.id === id ? closed : trade,
          ),
        });
      } catch (error) {
        set({ trades: previousTrades, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    reopenTrade: async (id) => {
      const previousTrades = get().trades;
      set({
        trades: previousTrades.map((trade) =>
          trade.id === id
            ? {
                ...trade,
                exitDate: null,
                exitPriceCents: null,
                exitReason: null,
                pnlCents: null,
              }
            : trade,
        ),
        error: null,
      });
      addPending(id);

      try {
        const reopened = await TradingRepository.reopenTrade(id);
        set({
          trades: get().trades.map((trade) =>
            trade.id === id ? reopened : trade,
          ),
        });
      } catch (error) {
        set({ trades: previousTrades, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteTrade: async (id) => {
      const previousTrades = get().trades;
      set({
        trades: previousTrades.filter((trade) => trade.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await TradingRepository.deleteTrade(id);
      } catch (error) {
        set({ trades: previousTrades, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    fetchEntries: async () => {
      try {
        const entries = await TradingRepository.getEntries();
        set({ entries });
      } catch (error) {
        set({ error: toUserMessage(error) });
      }
    },

    createEntry: async (input) => {
      const previousEntries = get().entries;
      const now = new Date().toISOString();
      const optimistic: TradingEntry = {
        id: `optimistic-${crypto.randomUUID()}`,
        date: input.date ?? format(new Date(), "yyyy-MM-dd"),
        ticker: input.ticker,
        signal: input.signal,
        priceCents: input.priceCents ?? null,
        emaFastCents: input.emaFastCents ?? null,
        emaSlowCents: input.emaSlowCents ?? null,
        rsi: input.rsi ?? null,
        emotion: input.emotion ?? null,
        rulesFollowed: input.rulesFollowed ?? null,
        ruleBreak: input.ruleBreak ?? null,
        notes: input.notes ?? null,
        tradeId: input.tradeId ?? null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      set({
        entries: [optimistic, ...previousEntries],
        isCreating: true,
        error: null,
      });

      try {
        const created = await TradingRepository.createEntry(input);
        set({
          entries: get().entries.map((entry) =>
            entry.id === optimistic.id ? created : entry,
          ),
        });
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        set({ isCreating: false });
      }
    },

    updateEntry: async (id, updates) => {
      const previousEntries = get().entries;
      set({
        entries: previousEntries.map((entry) =>
          entry.id === id ? applyEntryUpdates(entry, updates) : entry,
        ),
        error: null,
      });
      addPending(id);

      try {
        const updated = await TradingRepository.updateEntry(id, updates);
        set({
          entries: get().entries.map((entry) =>
            entry.id === id ? updated : entry,
          ),
        });
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    deleteEntry: async (id) => {
      const previousEntries = get().entries;
      set({
        entries: previousEntries.filter((entry) => entry.id !== id),
        error: null,
      });
      addPending(id);

      try {
        await TradingRepository.deleteEntry(id);
      } catch (error) {
        set({ entries: previousEntries, error: toUserMessage(error) });
      } finally {
        removePending(id);
      }
    },

    // Read-only, so no optimistic-then-rollback plumbing: there is nothing to
    // roll back. On failure the previous data simply stays put and `error` is
    // set, which is the honest outcome for a fetch.
    fetchBacktestStrategies: async () => {
      set({ isLoadingBacktests: true, error: null });
      try {
        const backtestStrategies =
          await TradingRepository.getBacktestStrategies();
        set({ backtestStrategies, isLoadingBacktests: false });
      } catch (error) {
        set({ isLoadingBacktests: false, error: toUserMessage(error) });
      }
    },

    fetchBacktestTrades: async (strategyId) => {
      // Already cached — a strategy's trades never change without a re-seed,
      // and macd_momentum is 1,576 rows.
      if (get().backtestTradesByStrategy[strategyId] !== undefined) return;

      set({ isLoadingBacktests: true, error: null });
      try {
        const trades = await TradingRepository.getBacktestTrades(strategyId);
        set({
          backtestTradesByStrategy: {
            ...get().backtestTradesByStrategy,
            [strategyId]: trades,
          },
          isLoadingBacktests: false,
        });
      } catch (error) {
        set({ isLoadingBacktests: false, error: toUserMessage(error) });
      }
    },

    stats: () => tradingStatsFor(get().trades, get().entries),
    equityCurve: () => equityCurveFor(get().trades),
    entriesForTrade: (tradeId) =>
      get().entries.filter((entry) => entry.tradeId === tradeId),
  };
});
