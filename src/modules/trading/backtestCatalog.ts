// The backtest strategy registry, mirroring strategies.py's STRATEGIES dict in
// ~/Documents/Trading. Static classification lives in CODE, not a table — the
// same pattern as financeCategories.ts / achievementCatalog.ts / tradingRules.
//
// This exists because the two CSVs each carry only half the identity:
// backtest_comparison.csv knows the LABEL, and the per-strategy trade files
// know only their FILENAME. Neither carries the registry key the app routes on,
// so the mapping has to live somewhere — here, where it can be reviewed, rather
// than as string munging inside the seed script.
//
// `label` must match backtest_comparison.csv byte-for-byte, human noise
// included ("(original)"), because that string is the only join key between the
// two files.

export interface BacktestStrategyDefinition {
  // Stable handle from strategies.py. Routing and the seed's upsert target.
  key: string;
  // Exactly as backtest_comparison.csv writes it.
  label: string;
  // backtest_trades_<file>.csv
  file: string;
  // Whether the engine trails the stop, which materially changes how the exit
  // reasons read: a 'stop' on a trailing strategy is often a profitable exit,
  // not a loss.
  trailingStop: boolean;
}

export const BACKTEST_STRATEGIES: readonly BacktestStrategyDefinition[] = [
  {
    key: "sma_golden_cross",
    label: "SMA 50/200 Golden Cross",
    file: "backtest_trades_sma_golden_cross.csv",
    trailingStop: false,
  },
  {
    key: "donchian_breakout",
    label: "Donchian 20/10 Breakout",
    file: "backtest_trades_donchian_breakout.csv",
    trailingStop: true,
  },
  {
    key: "rsi_mean_reversion",
    label: "RSI(14) Mean-Reversion",
    file: "backtest_trades_rsi_mean_reversion.csv",
    trailingStop: false,
  },
  {
    key: "macd_momentum",
    // Quoted in the CSV because of the embedded commas — the exact case
    // parseCsvLine exists to handle.
    label: "MACD(12,26,9) Momentum",
    file: "backtest_trades_macd_momentum.csv",
    trailingStop: false,
  },
  {
    key: "ema_pullback_filtered",
    // The live/original system. "(original)" is in the artifact, so it is here.
    label: "EMA9/21 Pullback + Filters (original)",
    file: "backtest_trades_ema_pullback_filtered.csv",
    trailingStop: false,
  },
];

const BY_LABEL = new Map(
  BACKTEST_STRATEGIES.map((strategy) => [strategy.label, strategy]),
);

// Resolves a comparison-CSV label to its registry entry. Undefined means the
// lab produced a strategy this catalog doesn't know about — the seed treats
// that as a hard error rather than importing a keyless row.
export function strategyByLabel(
  label: string,
): BacktestStrategyDefinition | undefined {
  return BY_LABEL.get(label.trim());
}
