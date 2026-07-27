"use client";

import { CandlestickChart, RefreshCw } from "lucide-react";
import { useEffect, useMemo } from "react";
import { hueFor } from "@/src/components/moduleHues";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { Panel } from "@/src/components/ui/Panel";
import { TradingEntryForm } from "@/src/modules/trading/components/TradingEntryForm";
import { TradingEquityCurve } from "@/src/modules/trading/components/TradingEquityCurve";
import { TradingJournalList } from "@/src/modules/trading/components/TradingJournalList";
import { TradingPositionsPanel } from "@/src/modules/trading/components/TradingPositionsPanel";
import { TradingStatsGrid } from "@/src/modules/trading/components/TradingStatsGrid";
import { useTradingStore } from "@/src/modules/trading/useTradingStore";

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
  } = useTradingStore();
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);
  const openTrades = trades.filter((trade) => trade.exitDate === null);

  useEffect(() => {
    void Promise.all([fetchTrades(), fetchEntries()]);
  }, [fetchEntries, fetchTrades]);

  function refresh() {
    void Promise.all([fetchTrades(), fetchEntries()]);
  }

  return (
    <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <PageHeader
          actions={
            <button
              aria-label="Refresh trading journal"
              className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-surface text-body hover:border-input-hover disabled:opacity-60"
              disabled={isLoading}
              onClick={refresh}
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={`size-4 ${isLoading ? "animate-spin" : ""}`}
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
      </div>
    </div>
  );
}
