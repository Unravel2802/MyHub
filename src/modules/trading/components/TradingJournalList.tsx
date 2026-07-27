import { BookOpenText } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import { formatCents } from "@/src/lib/money";
import type { TradingEntry, TradingSignal } from "@/src/modules/trading/types";

const signalTone: Record<TradingSignal, "neutral" | "success" | "danger"> = {
  buy: "success",
  sell: "danger",
  hold: "neutral",
};

function ruleBadge(entry: TradingEntry) {
  if (entry.rulesFollowed === true) {
    return <Badge tone="success">Rules followed</Badge>;
  }
  if (entry.rulesFollowed === false) {
    return <Badge tone="danger">Rule broken</Badge>;
  }
  return <Badge tone="neutral">Not judged</Badge>;
}

export function TradingJournalList({ entries }: { entries: TradingEntry[] }) {
  const newestFirst = [...entries].sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.createdAt.localeCompare(left.createdAt),
  );

  return (
    <Panel
      aside={<Badge tone="neutral">{entries.length}</Badge>}
      title="Journal"
    >
      {newestFirst.length === 0 ? (
        <EmptyState
          description="Log a signal, observation, or deliberate hold to start the journal."
          icon={BookOpenText}
          title="No journal entries yet"
        />
      ) : (
        <ul className="grid max-h-[36rem] gap-3 overflow-y-auto overscroll-contain pr-1">
          {newestFirst.map((entry) => (
            <li
              className="rounded-md border border-border bg-surface-subtle p-4"
              key={entry.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {entry.ticker}
                    </span>
                    <Badge tone={signalTone[entry.signal]}>
                      {entry.signal.toUpperCase()}
                    </Badge>
                    {ruleBadge(entry)}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {entry.date}
                    {entry.priceCents === null
                      ? ""
                      : ` · ${formatCents(entry.priceCents)}`}
                    {entry.emotion === null
                      ? ""
                      : ` · ${entry.emotion.replace("_", " ")}`}
                  </p>
                </div>
                {entry.tradeId ? (
                  <Link
                    className="text-sm font-medium text-accent-strong hover:text-foreground"
                    href={`#trade-${entry.tradeId}`}
                  >
                    View trade
                  </Link>
                ) : null}
              </div>
              {entry.ruleBreak ? (
                <p className="mt-2 text-sm text-danger">
                  Rule break: {entry.ruleBreak}
                </p>
              ) : null}
              {entry.notes ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-body">
                  {entry.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
