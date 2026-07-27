"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, FlaskConical } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { strategyByKey } from "@/src/modules/trading/backtestCatalog";
import type {
  BacktestExitReason,
  BacktestStrategy,
  BacktestTrade,
} from "@/src/modules/trading/types";
import { useTradingStore } from "@/src/modules/trading/useTradingStore";

type SortKey =
  | "label"
  | "trades"
  | "winRatePct"
  | "avgR"
  | "profitFactor"
  | "sharpe"
  | "cagrPct"
  | "maxDdPct"
  | "endValue";

type SortDirection = "ascending" | "descending";

const PAGE_SIZE = 50;
const inputClass =
  "h-9 w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent";

const exitReasonLabels: Record<BacktestExitReason, string> = {
  stop: "Stop",
  signal: "Signal",
  end_of_data: "End of data",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function decimal(value: number, digits = 2): string {
  return value.toFixed(digits);
}

function percent(value: number): string {
  return `${decimal(value)}%`;
}

function profitClass(value: number, threshold = 0): string {
  if (value > threshold) return "font-medium text-success";
  if (value < threshold) return "font-medium text-danger";
  return "text-body";
}

function compareStrategies(
  left: BacktestStrategy,
  right: BacktestStrategy,
  key: SortKey,
): number {
  if (key === "label") return left.label.localeCompare(right.label);
  return left[key] - right[key];
}

interface StrategyComparisonProps {
  onSelect: (strategy: BacktestStrategy) => void;
  selectedId: string | null;
  strategies: BacktestStrategy[];
}

function StrategyComparison({
  onSelect,
  selectedId,
  strategies,
}: StrategyComparisonProps) {
  const [sortKey, setSortKey] = useState<SortKey>("avgR");
  const [direction, setDirection] = useState<SortDirection>("descending");
  const sorted = useMemo(
    () =>
      [...strategies].sort((left, right) => {
        const result = compareStrategies(left, right, sortKey);
        return direction === "ascending" ? result : -result;
      }),
    [direction, sortKey, strategies],
  );

  function sortBy(key: SortKey) {
    if (sortKey === key) {
      setDirection((current) =>
        current === "ascending" ? "descending" : "ascending",
      );
      return;
    }
    setSortKey(key);
    setDirection(key === "label" ? "ascending" : "descending");
  }

  function sortButton(label: string, key: SortKey) {
    const active = sortKey === key;
    const Icon = active
      ? direction === "ascending"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;
    return (
      <button
        className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wider ${
          active ? "text-foreground" : "text-muted hover:text-foreground"
        }`}
        onClick={() => sortBy(key)}
        type="button"
      >
        {label}
        <Icon aria-hidden="true" className="size-3.5" />
      </button>
    );
  }

  return (
    <Panel
      description="Average R is the default ranking; win rate stays visible without standing in for profitability."
      title="Strategy comparison"
    >
      {strategies.length === 0 ? (
        <EmptyState
          compact
          description="The imported strategy summaries will appear after they load."
          icon={FlaskConical}
          title="No backtest strategies"
        />
      ) : (
        <div className="max-w-full overflow-x-auto rounded-md border border-border">
          <table className="min-w-[1120px] w-full border-collapse text-sm">
            <thead className="bg-surface-subtle">
              <tr>
                {(
                  [
                    ["Strategy", "label"],
                    ["Trades", "trades"],
                    ["Win rate", "winRatePct"],
                    ["Avg R", "avgR"],
                    ["Profit factor", "profitFactor"],
                    ["Sharpe", "sharpe"],
                    ["CAGR", "cagrPct"],
                    ["Max drawdown", "maxDdPct"],
                    ["End value", "endValue"],
                  ] as const
                ).map(([label, key]) => (
                  <th
                    aria-sort={sortKey === key ? direction : "none"}
                    className="border-b border-border px-3 py-2.5 text-left"
                    key={key}
                    scope="col"
                  >
                    {sortButton(label, key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((strategy) => (
                <tr
                  className={
                    selectedId === strategy.id
                      ? "bg-accent-surface"
                      : "bg-surface hover:bg-surface-subtle"
                  }
                  key={strategy.id}
                >
                  <td className="border-b border-border px-3 py-3">
                    <button
                      className="text-left font-medium text-accent-strong hover:text-foreground"
                      onClick={() => onSelect(strategy)}
                      type="button"
                    >
                      {strategy.label}
                    </button>
                  </td>
                  <td className="border-b border-border px-3 py-3 tabular-nums text-body">
                    {strategy.trades.toLocaleString("en-US")}
                  </td>
                  <td className="border-b border-border px-3 py-3 tabular-nums text-muted">
                    {percent(strategy.winRatePct)}
                  </td>
                  <td
                    className={`border-b border-border px-3 py-3 tabular-nums ${profitClass(strategy.avgR)}`}
                  >
                    {decimal(strategy.avgR)}
                  </td>
                  <td
                    className={`border-b border-border px-3 py-3 tabular-nums ${profitClass(strategy.profitFactor, 1)}`}
                  >
                    {decimal(strategy.profitFactor)}
                  </td>
                  <td
                    className={`border-b border-border px-3 py-3 tabular-nums ${profitClass(strategy.sharpe)}`}
                  >
                    {decimal(strategy.sharpe)}
                  </td>
                  <td
                    className={`border-b border-border px-3 py-3 tabular-nums ${profitClass(strategy.cagrPct)}`}
                  >
                    {percent(strategy.cagrPct)}
                  </td>
                  <td className="border-b border-border px-3 py-3 tabular-nums font-medium text-danger">
                    {percent(strategy.maxDdPct)}
                  </td>
                  <td className="border-b border-border px-3 py-3 tabular-nums text-body">
                    {currency.format(strategy.endValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

interface TradeBrowserProps {
  isLoading: boolean;
  strategy: BacktestStrategy | null;
  trades: BacktestTrade[] | undefined;
}

function TradeBrowser({ isLoading, strategy, trades }: TradeBrowserProps) {
  const [ticker, setTicker] = useState("");
  const [exitReason, setExitReason] = useState<BacktestExitReason | "all">(
    "all",
  );
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const query = ticker.trim().toUpperCase();
    return (trades ?? []).filter(
      (trade) =>
        (!query || trade.ticker.toUpperCase().includes(query)) &&
        (exitReason === "all" || trade.exitReason === exitReason),
    );
  }, [exitReason, ticker, trades]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const definition = strategy ? strategyByKey(strategy.key) : undefined;

  function updateTicker(value: string) {
    setTicker(value);
    setPage(1);
  }

  function updateExitReason(value: string) {
    setExitReason(value as BacktestExitReason | "all");
    setPage(1);
  }

  return (
    <Panel
      aside={
        strategy && trades ? (
          <Badge tone="neutral">
            {filtered.length.toLocaleString("en-US")}
          </Badge>
        ) : undefined
      }
      description={
        strategy
          ? `${strategy.label} · ${strategy.trades.toLocaleString("en-US")} imported trades`
          : "Choose a strategy above to inspect its simulated trades."
      }
      title="Strategy trades"
    >
      {!strategy ? (
        <EmptyState
          compact
          description="Select a strategy from the comparison table."
          icon={FlaskConical}
          title="No strategy selected"
        />
      ) : isLoading && trades === undefined ? (
        <p className="py-8 text-center text-sm text-muted">Loading trades…</p>
      ) : (
        <div className="grid gap-4">
          {definition?.trailingStop ? (
            <p className="rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-muted">
              This strategy trails its stop. A stop exit can lock in a profit
              and does not necessarily represent a losing trade.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-body">
              Filter ticker
              <input
                className={inputClass}
                onChange={(event) => updateTicker(event.target.value)}
                placeholder="AAPL"
                value={ticker}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-body">
              Exit reason
              <Select onValueChange={updateExitReason} value={exitReason}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All exits</SelectItem>
                  <SelectItem value="stop">Stop</SelectItem>
                  <SelectItem value="signal">Signal</SelectItem>
                  <SelectItem value="end_of_data">End of data</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              compact
              description="Adjust the ticker or exit-reason filters."
              title="No matching trades"
            />
          ) : (
            <div className="max-h-[36rem] max-w-full overflow-auto rounded-md border border-border">
              <table className="min-w-[1180px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-subtle">
                  <tr>
                    {[
                      "Ticker",
                      "Entry date",
                      "Exit date",
                      "Entry price",
                      "Exit price",
                      "Shares",
                      "Exit reason",
                      "P&L",
                      "R-multiple",
                      "Holding days",
                    ].map((label) => (
                      <th
                        className="border-b border-border px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted"
                        key={label}
                        scope="col"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((trade) => (
                    <tr className="bg-surface" key={trade.id}>
                      <td className="border-b border-border px-3 py-3 font-medium text-foreground">
                        {trade.ticker}
                      </td>
                      <td className="border-b border-border px-3 py-3 text-body">
                        {trade.entryDate}
                      </td>
                      <td className="border-b border-border px-3 py-3 text-body">
                        {trade.exitDate}
                      </td>
                      <td className="border-b border-border px-3 py-3 tabular-nums text-body">
                        {currency.format(trade.entryPrice)}
                      </td>
                      <td className="border-b border-border px-3 py-3 tabular-nums text-body">
                        {currency.format(trade.exitPrice)}
                      </td>
                      <td className="border-b border-border px-3 py-3 tabular-nums text-body">
                        {decimal(trade.shares, 4)}
                      </td>
                      <td className="border-b border-border px-3 py-3">
                        <Badge tone="neutral">
                          {exitReasonLabels[trade.exitReason]}
                        </Badge>
                      </td>
                      <td
                        className={`border-b border-border px-3 py-3 tabular-nums ${profitClass(trade.pnlDollars)}`}
                      >
                        {currency.format(trade.pnlDollars)}
                      </td>
                      <td
                        className={`border-b border-border px-3 py-3 tabular-nums ${profitClass(trade.rMultiple)}`}
                      >
                        {decimal(trade.rMultiple)}R
                      </td>
                      <td className="border-b border-border px-3 py-3 tabular-nums text-body">
                        {trade.holdingDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > PAGE_SIZE ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted">
                Page {safePage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-md border border-input px-3 text-sm font-medium text-body hover:border-input-hover disabled:opacity-50"
                  disabled={safePage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="h-9 rounded-md border border-input px-3 text-sm font-medium text-body hover:border-input-hover disabled:opacity-50"
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setPage((current) => Math.min(totalPages, current + 1))
                  }
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}

export function TradingBacktestViewer() {
  const {
    backtestStrategies,
    backtestTradesByStrategy,
    isLoadingBacktests,
    fetchBacktestStrategies,
    fetchBacktestTrades,
  } = useTradingStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    backtestStrategies.find((strategy) => strategy.id === selectedId) ?? null;

  useEffect(() => {
    void fetchBacktestStrategies();
  }, [fetchBacktestStrategies]);

  function selectStrategy(strategy: BacktestStrategy) {
    setSelectedId(strategy.id);
    void fetchBacktestTrades(strategy.id);
  }

  return (
    <section aria-label="Backtest viewer" className="grid min-w-0 gap-6">
      <StrategyComparison
        onSelect={selectStrategy}
        selectedId={selectedId}
        strategies={backtestStrategies}
      />
      <TradeBrowser
        isLoading={isLoadingBacktests}
        key={selected?.id ?? "no-strategy"}
        strategy={selected}
        trades={selected ? backtestTradesByStrategy[selected.id] : undefined}
      />
    </section>
  );
}
