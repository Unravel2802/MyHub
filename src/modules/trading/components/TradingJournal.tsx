"use client";

import {
  BookOpenText,
  CandlestickChart,
  FlaskConical,
  RefreshCw,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { hueFor } from "@/src/components/moduleHues";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Panel } from "@/src/components/ui/Panel";
import { TradingBacktestViewer } from "@/src/modules/trading/components/TradingBacktestViewer";
import { TradingEntryForm } from "@/src/modules/trading/components/TradingEntryForm";
import { TradingEquityCurve } from "@/src/modules/trading/components/TradingEquityCurve";
import { TradingJournalList } from "@/src/modules/trading/components/TradingJournalList";
import { TradingPositionsPanel } from "@/src/modules/trading/components/TradingPositionsPanel";
import { TradingStatsGrid } from "@/src/modules/trading/components/TradingStatsGrid";
import { useTradingStore } from "@/src/modules/trading/useTradingStore";

type TradingView = "journal" | "backtests";

const views = [
  { id: "journal" as const, label: "Journal", icon: BookOpenText },
  { id: "backtests" as const, label: "Backtests", icon: FlaskConical },
];

export function TradingJournal() {
  const {
    trades,
    entries,
    isLoading,
    error,
    isCreating,
    pendingIds,
    fetchTrades,
    createTrade,
    closeTrade,
    reopenTrade,
    fetchEntries,
    createEntry,
    stats,
    equityCurve,
    isLoadingBacktests,
    fetchBacktestStrategies,
  } = useTradingStore();
  const [view, setView] = useState<TradingView>("journal");
  const tabsId = useId();
  const tabRefs = useRef<Partial<Record<TradingView, HTMLButtonElement>>>({});
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);
  const openTrades = trades.filter((trade) => trade.exitDate === null);

  useEffect(() => {
    void Promise.all([fetchTrades(), fetchEntries()]);
  }, [fetchEntries, fetchTrades]);

  function refresh() {
    if (view === "backtests") {
      void fetchBacktestStrategies();
      return;
    }
    void Promise.all([fetchTrades(), fetchEntries()]);
  }

  function selectView(nextView: TradingView) {
    setView(nextView);
    tabRefs.current[nextView]?.focus();
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentView: TradingView,
  ) {
    const currentIndex = views.findIndex((option) => option.id === currentView);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % views.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + views.length) % views.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = views.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    selectView(views[nextIndex].id);
  }

  return (
    <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <PageHeader
          actions={
            <button
              aria-label={
                view === "backtests"
                  ? "Refresh backtest strategies"
                  : "Refresh trading journal"
              }
              className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-surface text-body hover:border-input-hover disabled:opacity-60"
              disabled={isLoading || isLoadingBacktests}
              onClick={refresh}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${
                  isLoading || isLoadingBacktests ? "animate-spin" : ""
                }`}
              />
            </button>
          }
          bleed
          description="Keep daily decisions separate from realised trade outcomes."
          eyebrow="Money"
          hue={hueFor("/trading")}
          icon={CandlestickChart}
          title="Trading Journal"
        />

        {error ? (
          <p
            aria-live="assertive"
            className="rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div
          aria-label="Trading view"
          className="flex items-end gap-1 border-b border-border"
          role="tablist"
        >
          {views.map((option) => {
            const selected = view === option.id;
            const Icon = option.icon;
            return (
              <button
                aria-controls={`${tabsId}-${option.id}-panel`}
                aria-selected={selected}
                className={`-mb-px flex items-center gap-1.5 rounded-t-md border-x border-t px-4 py-2 text-sm font-medium ${
                  selected
                    ? "border-border bg-surface text-accent-strong"
                    : "border-transparent text-muted hover:bg-surface/60 hover:text-body"
                }`}
                id={`${tabsId}-${option.id}-tab`}
                key={option.id}
                onClick={() => setView(option.id)}
                onKeyDown={(event) => handleTabKeyDown(event, option.id)}
                ref={(node) => {
                  tabRefs.current[option.id] = node ?? undefined;
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {option.label}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`${tabsId}-${view}-tab`}
          className="grid min-w-0 gap-6"
          id={`${tabsId}-${view}-panel`}
          role="tabpanel"
          tabIndex={0}
        >
          {view === "journal" ? (
            <>
              <TradingStatsGrid stats={stats()} />

              <Panel
                description="Capture the signal and the decision. Buy entries can open a position in the same submit."
                title="Log an entry"
              >
                <TradingEntryForm
                  disabled={isCreating}
                  onCreateEntry={createEntry}
                  onCreateTrade={createTrade}
                  openTrades={openTrades}
                />
              </Panel>

              <div className="grid min-w-0 gap-6 xl:grid-cols-2">
                <TradingEquityCurve curve={equityCurve()} />
                <TradingPositionsPanel
                  onCloseTrade={closeTrade}
                  onReopenTrade={reopenTrade}
                  pendingIds={pending}
                  trades={trades}
                />
              </div>

              <TradingJournalList entries={entries} />
            </>
          ) : (
            <TradingBacktestViewer />
          )}
        </div>
      </div>
    </div>
  );
}
