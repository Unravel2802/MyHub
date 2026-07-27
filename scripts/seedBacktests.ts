// Loads the Python lab's backtest output into MyHub (migration 0040).
//
// Usage:
//   npm run seed:backtests                       -- reads ~/Documents/Trading
//   npm run seed:backtests -- --dir=/some/path   -- reads elsewhere
//   npm run seed:backtests -- --dry-run          -- parses and reports, writes nothing
//
// RE-RUNNABLE by design, unlike seedWeeklySchedule. The CSVs are gitignored
// regenerable artifacts: re-run the lab, re-run this, and the stored results
// track it. Strategies upsert on their `key` (a PLAIN unique constraint —
// a partial one cannot be an ON CONFLICT target, the 42P10 bug this repo hit
// three times), and each strategy's trades are replaced wholesale.
//
// That replacement is a HARD delete, which the soft-delete rule otherwise
// forbids. The rule protects user data; these rows are imported analysis output
// with an authoritative upstream copy, and accumulating soft-deleted duplicates
// across re-seeds would make the trade browser progressively wrong. Nothing in
// the app writes to these tables — the repository exposes reads only.
//
// process.loadEnvFile must run before the repository/client is imported,
// because src/lib/supabaseClient reads process.env at module-load time. Hence
// the dynamic imports below — a static import would be hoisted above it.
process.loadEnvFile(".env.local");

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_DIR = join(homedir(), "Documents", "Trading");
const COMPARISON_FILE = "backtest_comparison.csv";

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

async function main() {
  const { BACKTEST_STRATEGIES, strategyByLabel } =
    await import("../src/modules/trading/backtestCatalog");
  const { parseComparisonCsv, parseTradesCsv } =
    await import("../src/modules/trading/backtestCsv");
  const { prepareScriptClientAuth } = await import("./supabaseScriptClient");
  prepareScriptClientAuth();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY)
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY;
  const { supabase } = await import("../src/lib/supabaseClient");

  const dir = argValue("dir") ?? DEFAULT_DIR;
  const dryRun = process.argv.includes("--dry-run");

  console.log(
    `Seeding backtests from ${dir}${dryRun ? " (dry run — nothing will be written)" : ""}...`,
  );

  // Parse EVERYTHING before writing anything. A malformed row 1,400 lines into
  // the third file should abort the whole import, not leave two strategies
  // loaded and three missing.
  const comparison = parseComparisonCsv(
    readFileSync(join(dir, COMPARISON_FILE), "utf8"),
  );

  const parsed = comparison.map((summary) => {
    const definition = strategyByLabel(summary.label);
    if (definition === undefined) {
      throw new Error(
        `No catalog entry for strategy label "${summary.label}". ` +
          `Add it to src/modules/trading/backtestCatalog.ts — a keyless ` +
          `strategy cannot be routed to or upserted.`,
      );
    }

    const trades = parseTradesCsv(
      readFileSync(join(dir, definition.file), "utf8"),
    );

    // The comparison file states a trade count; the per-strategy file is the
    // trades themselves. If they disagree, the two artifacts came from
    // different runs and importing them together would produce a summary that
    // contradicts the rows beneath it.
    if (trades.length !== summary.trades) {
      throw new Error(
        `${definition.key}: comparison says ${summary.trades} trades but ` +
          `${definition.file} has ${trades.length}. Re-run the lab so both ` +
          `artifacts come from the same run.`,
      );
    }

    return { definition, summary, trades };
  });

  const missing = BACKTEST_STRATEGIES.filter(
    (definition) =>
      !parsed.some((entry) => entry.definition.key === definition.key),
  );
  if (missing.length > 0) {
    console.warn(
      `  ! ${missing.length} catalog strateg${missing.length === 1 ? "y" : "ies"} absent from the comparison file: ${missing
        .map((definition) => definition.key)
        .join(", ")}`,
    );
  }

  for (const { definition, summary, trades } of parsed) {
    console.log(`  ${definition.key}: ${trades.length} trades`);
    if (dryRun) continue;

    const { data: strategy, error: upsertError } = await supabase
      .from("trading_backtest_strategies")
      .upsert(
        {
          key: definition.key,
          label: definition.label,
          trades: summary.trades,
          win_rate_pct: summary.winRatePct,
          avg_r: summary.avgR,
          profit_factor: summary.profitFactor,
          sharpe: summary.sharpe,
          sharpe_before_costs: summary.sharpeBeforeCosts,
          cagr_pct: summary.cagrPct,
          max_dd_pct: summary.maxDdPct,
          end_value: summary.endValue,
        },
        { onConflict: "key" },
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    // Replace rather than append — see the header note on why this is a hard
    // delete. Ordering matters: clear first, so a failure mid-insert leaves an
    // obviously-empty strategy rather than a silently doubled one.
    const { error: deleteError } = await supabase
      .from("trading_backtest_trades")
      .delete()
      .eq("strategy_id", strategy.id);

    if (deleteError) throw deleteError;

    // Chunked: a single 1,576-row insert is a large request, and PostgREST is
    // happier with batches.
    const CHUNK = 500;
    for (let i = 0; i < trades.length; i += CHUNK) {
      const { error: insertError } = await supabase
        .from("trading_backtest_trades")
        .insert(
          trades.slice(i, i + CHUNK).map((trade) => ({
            strategy_id: strategy.id,
            ticker: trade.ticker,
            entry_date: trade.entryDate,
            exit_date: trade.exitDate,
            entry_price: trade.entryPrice,
            stop_price: trade.stopPrice,
            exit_price: trade.exitPrice,
            shares: trade.shares,
            exit_reason: trade.exitReason,
            commission: trade.commission,
            pnl_dollars: trade.pnlDollars,
            r_multiple: trade.rMultiple,
            holding_days: trade.holdingDays,
          })),
        );

      if (insertError) throw insertError;
    }
  }

  const total = parsed.reduce((sum, entry) => sum + entry.trades.length, 0);
  console.log(
    dryRun
      ? `Dry run OK: ${parsed.length} strategies, ${total} trades parsed.`
      : `Seeded ${parsed.length} strategies and ${total} trades.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
