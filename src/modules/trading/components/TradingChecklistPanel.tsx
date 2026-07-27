"use client";

import { format } from "date-fns";
import { BookOpenCheck, CheckCircle2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { hueFor } from "@/src/components/moduleHues";
import { Badge } from "@/src/components/ui/Badge";
import { Panel } from "@/src/components/ui/Panel";
import { ProgressBar } from "@/src/components/ui/ProgressBar";
import {
  checklistCompletion,
  IRON_RULES,
  isChecklistComplete,
  PRE_TRADE_CHECKLIST,
  SYSTEM_RULES,
  type TradingRule,
} from "@/src/modules/trading/tradingRulesCatalog";
import { useTradingStore } from "@/src/modules/trading/useTradingStore";

const inputClass =
  "h-10 rounded-md border border-input bg-surface px-3 text-sm text-foreground outline-none focus:border-accent";

function RulesReference({
  description,
  icon: Icon,
  rules,
  title,
}: {
  description: string;
  icon: typeof BookOpenCheck;
  rules: readonly TradingRule[];
  title: string;
}) {
  return (
    <Panel description={description} title={title}>
      <ol className="grid gap-3">
        {rules.map((rule) => (
          <li
            className="rounded-md border border-border bg-surface-subtle px-3 py-3"
            key={rule.key}
          >
            <div className="flex items-start gap-2">
              <Icon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted"
              />
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {rule.key.startsWith("R") ? `${rule.key} · ` : ""}
                  {rule.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {rule.detail}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function TradingChecklistPanel() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const { checklistRunFor, fetchChecklistRuns, toggleChecklistItem } =
    useTradingStore();

  useEffect(() => {
    void fetchChecklistRuns();
  }, [fetchChecklistRuns]);

  const run = checklistRunFor(date);
  const checkedKeys = run?.checkedKeys ?? [];
  const completion = checklistCompletion(checkedKeys) ?? 0;
  const completedCount = Math.round(completion * PRE_TRADE_CHECKLIST.length);
  const ready = isChecklistComplete(checkedKeys);

  return (
    <div className="grid min-w-0 gap-6">
      <Panel
        aside={
          <Badge tone={ready ? "success" : "neutral"}>
            {ready ? "Ready to trade" : run ? "Not ready" : "Not started"}
          </Badge>
        }
        description="Run the ritual before placing an order. Every date keeps its own persisted checklist."
        title="Daily pre-trade checklist"
      >
        <div className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-end">
            <label className="grid gap-1.5 text-sm font-medium text-body">
              Checklist date
              <input
                className={inputClass}
                onChange={(event) => setDate(event.target.value)}
                type="date"
                value={date}
              />
            </label>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-body">Completion</p>
                <p className="text-sm font-semibold tabular-nums text-foreground">
                  {completedCount}/{PRE_TRADE_CHECKLIST.length}
                </p>
              </div>
              <ProgressBar hue={hueFor("/trading")} progress={completion} />
            </div>
          </div>

          <ul className="grid gap-3">
            {PRE_TRADE_CHECKLIST.map((rule) => {
              const checked = checkedKeys.includes(rule.key);
              return (
                <li
                  className={`rounded-md border px-4 py-3 transition-colors ${
                    checked
                      ? "border-success-border bg-success-surface"
                      : "border-border bg-surface-subtle"
                  }`}
                  key={rule.key}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      checked={checked}
                      className="mt-1 size-4 shrink-0 accent-accent"
                      onChange={() => void toggleChecklistItem(date, rule.key)}
                      type="checkbox"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        {checked ? (
                          <CheckCircle2
                            aria-hidden="true"
                            className="size-4 shrink-0 text-success"
                          />
                        ) : null}
                        {rule.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">
                        {rule.detail}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        <RulesReference
          description="The mechanical R1–R8 system. Reference only."
          icon={BookOpenCheck}
          rules={SYSTEM_RULES}
          title="System rules"
        />
        <RulesReference
          description="Non-negotiable guardrails. Breaches belong in the journal, not in checkboxes here."
          icon={ShieldCheck}
          rules={IRON_RULES}
          title="Iron rules"
        />
      </div>
    </div>
  );
}
