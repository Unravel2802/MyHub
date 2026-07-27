import { create } from "zustand";
import type {
  CloseTradeInput,
  CreateEntryInput,
  CreateTradeInput,
} from "@/src/modules/trading/TradingRepository";
import type { TradingEntry, TradingTrade } from "@/src/modules/trading/types";
import { equityCurve as equityCurveFor } from "@/src/modules/trading/equityCurve";
import { tradingStats as tradingStatsFor } from "@/src/modules/trading/tradingStats";

// Published store contract for the Trading Journal. One store per module — this
// must never reach into useFinanceStore or vice versa, even though both live in
// the "money" mini-app; sharing a nav group is not sharing state.
//
// NO Event Bus emission, deliberately (see migration 0038's header). Momentum
// must not learn that a trade happened: the career streak stays a career streak.
//
// CONTRACT ONLY: the async action bodies are Codex's to implement against
// TradingRepository.ts (already published and tested) — Supabase round-trips and
// optimistic-set-then-rollback plumbing, mirroring usePrepStore.ts exactly
// (optimistic update, roll back `previousX` and set `error` via toUserMessage()
// on failure, track in-flight ids in `pendingIds`). The SHAPE below is not
// Codex's to change — if the UI needs something this doesn't expose, flag it
// rather than widening a type or bypassing the store.

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
}

// Add these back when wiring the action bodies — every other module's store has
// the identical pair (usePrepStore.ts, useLeetCodeStore.ts):
//
// const FAILURE_MESSAGE = "Something went wrong, please try again later.";
// function toUserMessage(error: unknown): string {
//   console.error(error);
//   return FAILURE_MESSAGE;
// }

const NOT_IMPLEMENTED = "Not implemented — see useTradingStore.ts contract.";

export const useTradingStore = create<TradingStore>((_set, get) => ({
  trades: [],
  entries: [],
  isLoading: false,
  error: null,
  isCreating: false,
  pendingIds: [],

  fetchTrades: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  createTrade: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  updateTrade: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  closeTrade: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  reopenTrade: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  deleteTrade: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },

  fetchEntries: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  createEntry: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  updateEntry: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },
  deleteEntry: async () => {
    throw new Error(NOT_IMPLEMENTED);
  },

  stats: () => tradingStatsFor(get().trades, get().entries),
  equityCurve: () => equityCurveFor(get().trades),
  entriesForTrade: (tradeId) =>
    get().entries.filter((entry) => entry.tradeId === tradeId),
}));
