import type { Page } from "@playwright/test";

export type TradingTradeRow = {
  id: string;
  ticker: string;
  entry_date: string;
  entry_price_cents: number;
  stop_price_cents: number | null;
  shares: number;
  exit_date: string | null;
  exit_price_cents: number | null;
  exit_reason:
    "ema_crossover_bearish" | "rsi_overbought" | "stop_loss" | "manual" | null;
  pnl_cents: number | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TradingEntryRow = {
  id: string;
  date: string;
  ticker: string;
  signal: "buy" | "sell" | "hold";
  price_cents: number | null;
  ema_fast_cents: number | null;
  ema_slow_cents: number | null;
  rsi: number | null;
  emotion:
    | "neutral"
    | "anxious"
    | "frustrated"
    | "excited"
    | "confident"
    | "uncertain"
    | "fomo"
    | null;
  rules_followed: boolean | null;
  rule_break: string | null;
  notes: string | null;
  trade_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BacktestStrategyRow = {
  id: string;
  key: string;
  label: string;
  trades: number;
  win_rate_pct: number;
  avg_r: number;
  profit_factor: number;
  sharpe: number;
  sharpe_before_costs: number;
  cagr_pct: number;
  max_dd_pct: number;
  end_value: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BacktestTradeRow = {
  id: string;
  strategy_id: string;
  ticker: string;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  stop_price: number;
  exit_price: number;
  shares: number;
  exit_reason: "stop" | "signal" | "end_of_data";
  commission: number;
  pnl_dollars: number;
  r_multiple: number;
  holding_days: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type TableName =
  | "trading_trades"
  | "trading_entries"
  | "trading_backtest_strategies"
  | "trading_backtest_trades";

const STAMP = "2026-07-27T00:00:00.000Z";

export function tradingTradeRow(
  overrides: Partial<TradingTradeRow> & Pick<TradingTradeRow, "id" | "ticker">,
): TradingTradeRow {
  return {
    entry_date: "2026-07-27",
    entry_price_cents: 12000,
    stop_price_cents: 11500,
    shares: 2,
    exit_date: null,
    exit_price_cents: null,
    exit_reason: null,
    pnl_cents: null,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function tradingEntryRow(
  overrides: Partial<TradingEntryRow> &
    Pick<TradingEntryRow, "id" | "ticker" | "signal">,
): TradingEntryRow {
  return {
    date: "2026-07-27",
    price_cents: null,
    ema_fast_cents: null,
    ema_slow_cents: null,
    rsi: null,
    emotion: null,
    rules_followed: null,
    rule_break: null,
    notes: null,
    trade_id: null,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function backtestStrategyRow(
  overrides: Partial<BacktestStrategyRow> &
    Pick<BacktestStrategyRow, "id" | "key" | "label">,
): BacktestStrategyRow {
  return {
    trades: 100,
    win_rate_pct: 44.88,
    avg_r: 0.5,
    profit_factor: 1.4,
    sharpe: 0.8,
    sharpe_before_costs: 1,
    cagr_pct: 8.25,
    max_dd_pct: -12.5,
    end_value: 12500,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export function backtestTradeRow(
  overrides: Partial<BacktestTradeRow> &
    Pick<BacktestTradeRow, "id" | "strategy_id" | "ticker">,
): BacktestTradeRow {
  return {
    entry_date: "2025-01-02",
    exit_date: "2025-01-10",
    entry_price: 100,
    stop_price: 95,
    exit_price: 110,
    shares: 10,
    exit_reason: "signal",
    commission: 2,
    pnl_dollars: 98,
    r_multiple: 1.96,
    holding_days: 8,
    deleted_at: null,
    created_at: STAMP,
    updated_at: STAMP,
    ...overrides,
  };
}

export class FakeTradingDb {
  trades: TradingTradeRow[];
  entries: TradingEntryRow[];
  backtestStrategies: BacktestStrategyRow[];
  backtestTrades: BacktestTradeRow[];
  private failures: { table: TableName; method: string }[] = [];

  constructor(
    trades: TradingTradeRow[] = [],
    entries: TradingEntryRow[] = [],
    backtestStrategies: BacktestStrategyRow[] = [],
    backtestTrades: BacktestTradeRow[] = [],
  ) {
    this.trades = trades;
    this.entries = entries;
    this.backtestStrategies = backtestStrategies;
    this.backtestTrades = backtestTrades;
  }

  failNext(table: TableName, method: "POST" | "PATCH") {
    this.failures.push({ table, method });
  }

  takeFailure(table: TableName, method: string) {
    const index = this.failures.findIndex(
      (failure) => failure.table === table && failure.method === method,
    );
    if (index === -1) return false;
    this.failures.splice(index, 1);
    return true;
  }
}

const RESERVED_PARAMS = new Set(["select", "order", "limit", "offset"]);

function matches(value: unknown, expression: string) {
  if (expression === "is.null") return value === null;
  if (expression.startsWith("eq.")) {
    return String(value) === expression.slice(3);
  }
  return true;
}

function filteredRows<T extends Record<string, unknown>>(rows: T[], url: URL) {
  const filters = [...url.searchParams.entries()].filter(
    ([key]) => !RESERVED_PARAMS.has(key),
  );
  return rows.filter((row) =>
    filters.every(([column, expression]) => matches(row[column], expression)),
  );
}

export async function mockSupabaseTrading(page: Page, db: FakeTradingDb) {
  await page.route(
    "**/rest/v1/{trading_trades,trading_entries,trading_backtest_strategies,trading_backtest_trades}*",
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const table: TableName = url.pathname.includes(
        "trading_backtest_strategies",
      )
        ? "trading_backtest_strategies"
        : url.pathname.includes("trading_backtest_trades")
          ? "trading_backtest_trades"
          : url.pathname.includes("trading_entries")
            ? "trading_entries"
            : "trading_trades";
      const method = request.method();

      if (db.takeFailure(table, method)) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Simulated database failure" }),
        });
        return;
      }

      const wantsObject = (request.headers()["accept"] ?? "").includes(
        "vnd.pgrst.object+json",
      );
      const respond = async (rows: Record<string, unknown>[]) => {
        await route.fulfill({
          status: method === "POST" ? 201 : 200,
          contentType: "application/json",
          body: JSON.stringify(wantsObject ? (rows[0] ?? null) : rows),
        });
      };
      const rows = (
        table === "trading_trades"
          ? db.trades
          : table === "trading_entries"
            ? db.entries
            : table === "trading_backtest_strategies"
              ? db.backtestStrategies
              : db.backtestTrades
      ) as Record<string, unknown>[];

      if (method === "GET") {
        let matched = filteredRows(rows, url);
        if (table === "trading_backtest_strategies") {
          matched.sort((left, right) =>
            String(left.label).localeCompare(String(right.label)),
          );
        } else {
          const dateKey =
            table === "trading_entries"
              ? "date"
              : table === "trading_backtest_trades"
                ? "exit_date"
                : "entry_date";
          matched.sort(
            (left, right) =>
              String(right[dateKey]).localeCompare(String(left[dateKey])) ||
              String(left.id).localeCompare(String(right.id)),
          );
        }
        const range = request.headers().range;
        if (range) {
          const [from, to] = range.split("-").map(Number);
          matched = matched.slice(from, to + 1);
        }
        await respond(matched);
        return;
      }

      if (method === "POST") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const defaults =
          table === "trading_trades"
            ? {
                stop_price_cents: null,
                exit_date: null,
                exit_price_cents: null,
                exit_reason: null,
                pnl_cents: null,
              }
            : {
                price_cents: null,
                ema_fast_cents: null,
                ema_slow_cents: null,
                rsi: null,
                emotion: null,
                rules_followed: null,
                rule_break: null,
                notes: null,
                trade_id: null,
              };
        const created = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: STAMP,
          updated_at: STAMP,
          ...defaults,
          ...payload,
        };
        rows.push(created);
        await respond([created]);
        return;
      }

      if (method === "PATCH") {
        const payload = request.postDataJSON() as Record<string, unknown>;
        const targets = filteredRows(rows, url);
        for (const target of targets) {
          Object.assign(target, payload, { updated_at: STAMP });
        }
        if (!url.searchParams.has("select")) {
          await route.fulfill({ status: 204, body: "" });
          return;
        }
        await respond(targets);
        return;
      }

      await route.fulfill({ status: 405, body: "" });
    },
  );
}
