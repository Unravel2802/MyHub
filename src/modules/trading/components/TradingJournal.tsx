"use client";

import {
  CandlestickChart,
  ClipboardCheck,
  Library,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { Panel } from "@/src/components/ui/Panel";
import { TradingChecklistPanel } from "@/src/modules/trading/components/TradingChecklistPanel";
import { TradingEntryForm } from "@/src/modules/trading/components/TradingEntryForm";
import { TradingEquityCurve } from "@/src/modules/trading/components/TradingEquityCurve";
import { TradingJournalList } from "@/src/modules/trading/components/TradingJournalList";
import { TradingPositionsPanel } from "@/src/modules/trading/components/TradingPositionsPanel";
import { TradingStatsGrid } from "@/src/modules/trading/components/TradingStatsGrid";
import { useTradingStore } from "@/src/modules/trading/useTradingStore";

type TradingTab = "journal" | "checklist" | "references";

const tabs: {
  id: TradingTab;
  label: string;
  icon: typeof ScrollText;
}[] = [
  { id: "journal", label: "Journal", icon: ScrollText },
  { id: "checklist", label: "Pre-trade", icon: ClipboardCheck },
  { id: "references", label: "References", icon: Library },
];

interface TradingJournalProps {
  referenceContent: ReactNode;
}

export function TradingJournal({ referenceContent }: TradingJournalProps) {
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
    fetchChecklistRuns,
  } = useTradingStore();
  const [activeTab, setActiveTab] = useState<TradingTab>("journal");
  const tabId = useId();
  const tabRefs = useRef<Partial<Record<TradingTab, HTMLButtonElement>>>({});
  const pending = useMemo(() => new Set(pendingIds), [pendingIds]);
  const openTrades = trades.filter((trade) => trade.exitDate === null);

  useEffect(() => {
    void Promise.all([fetchTrades(), fetchEntries()]);
  }, [fetchEntries, fetchTrades]);

  function refresh() {
    if (activeTab === "references") return;
    if (activeTab === "checklist") {
      void fetchChecklistRuns();
      return;
    }
    void Promise.all([fetchTrades(), fetchEntries()]);
  }

  function selectTab(tab: TradingTab) {
    setActiveTab(tab);
    tabRefs.current[tab]?.focus();
  }

  function handleTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: TradingTab,
  ) {
    const currentIndex = tabs.findIndex((tab) => tab.id === currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    selectTab(tabs[nextIndex].id);
  }

  return (
    <PageTemplate
      actions={
        activeTab === "references" ? null : (
          <button
            aria-label={`Refresh ${
              activeTab === "checklist"
                ? "pre-trade checklist"
                : "trading journal"
            }`}
            className="inline-flex size-10 items-center justify-center rounded-md border border-input bg-surface text-body hover:border-input-hover disabled:opacity-60"
            disabled={activeTab === "journal" && isLoading}
            onClick={refresh}
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-4 ${
                activeTab === "journal" && isLoading ? "animate-spin" : ""
              }`}
            />
          </button>
        )
      }
      compose={
        activeTab === "journal" ? (
          <div className="mx-auto w-full max-w-7xl">
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
          </div>
        ) : null
      }
      description="Keep daily decisions separate from realised trade outcomes."
      error={error}
      eyebrow="Money"
      hero={null}
      href="/trading"
      icon={CandlestickChart}
      title="Trading Journal"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <div
          aria-label="Trading views"
          className="flex items-end gap-1 border-b border-border"
          role="tablist"
        >
          {tabs.map((tab) => {
            const selected = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                aria-controls={`${tabId}-${tab.id}-panel`}
                aria-selected={selected}
                className={`-mb-px flex items-center gap-1.5 rounded-t-md border-x border-t px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${
                  selected
                    ? "border-border bg-surface text-accent-strong"
                    : "border-transparent text-muted hover:bg-surface/60 hover:text-body"
                }`}
                id={`${tabId}-${tab.id}-tab`}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                ref={(node) => {
                  tabRefs.current[tab.id] = node ?? undefined;
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`${tabId}-${activeTab}-tab`}
          id={`${tabId}-${activeTab}-panel`}
          role="tabpanel"
          tabIndex={0}
        >
          {activeTab === "journal" ? (
            <div className="grid min-w-0 gap-6">
              <TradingStatsGrid stats={stats()} />

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
          ) : activeTab === "checklist" ? (
            <TradingChecklistPanel />
          ) : (
            referenceContent
          )}
        </div>
      </div>
    </PageTemplate>
  );
}
