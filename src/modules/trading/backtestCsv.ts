import type {
  BacktestExitReason,
  BacktestStrategySummary,
  BacktestTradeRow,
} from "@/src/modules/trading/types";

// Parsing for the Python lab's CSV output. Pure, and unit-tested, because the
// seed loads ~2,900 rows unattended: a parser that silently shifts a column
// would write plausible-looking nonsense that no later check would catch.
//
// No CSV dependency — none is on the approved list, and the format here is
// narrow enough that a correct reader is ~20 lines. What it MUST get right is
// quoting: backtest_comparison.csv contains `"MACD(12,26,9) Momentum"`, whose
// embedded commas would split into three bogus columns under a naive
// `line.split(",")`.

// Splits one CSV line, honoring double-quoted fields and the "" escape for a
// literal quote inside one. Not a general CSV reader: it assumes a single
// line, which holds because the engine never emits embedded newlines.
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
}

// Splits a whole file into non-empty lines, tolerating CRLF and a trailing
// newline. Header handling is the caller's business.
export function parseCsvLines(contents: string): string[][] {
  return contents
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map(parseCsvLine);
}

const EXIT_REASONS: Record<string, BacktestExitReason> = {
  STOP: "stop",
  SIGNAL: "signal",
  END_OF_DATA: "end_of_data",
};

// The CSV shouts its exit codes; the schema uses lowercase like every other
// enum. Throws rather than defaulting: an unrecognised code means the engine
// changed and the import should stop, not quietly bucket rows as "signal".
export function parseExitReason(raw: string): BacktestExitReason {
  const reason = EXIT_REASONS[raw.trim()];
  if (reason === undefined) {
    throw new Error(`Unrecognised backtest exit_reason: "${raw}"`);
  }
  return reason;
}

// Throws on anything non-numeric. The engine emits full float precision and
// never blanks these columns, so a blank or NaN means a malformed row — which
// must fail loudly rather than land as 0 and skew every aggregate downstream.
function requireNumber(raw: string, column: string): number {
  const value = Number(raw.trim());
  if (raw.trim() === "" || !Number.isFinite(value)) {
    throw new Error(`Expected a number in "${column}", got "${raw}"`);
  }
  return value;
}

// Column order of backtest_trades_*.csv, identical across all five files
// (backtest_engine.simulate writes it). Indexed positionally, but verified
// against the header by assertTradeHeader below.
export const TRADE_COLUMNS = [
  "ticker",
  "entry_date",
  "exit_date",
  "entry_price",
  "stop_price",
  "exit_price",
  "shares",
  "exit_reason",
  "commission",
  "pnl_dollars",
  "r_multiple",
  "holding_days",
] as const;

// Column order of backtest_comparison.csv.
export const COMPARISON_COLUMNS = [
  "strategy",
  "trades",
  "win_rate",
  "avg_r",
  "profit_factor",
  "sharpe",
  "sharpe_before_costs",
  "cagr_pct",
  "max_dd_pct",
  "end_value",
] as const;

// Positional parsing is only safe if the header is what we think it is. If the
// engine ever reorders or renames a column, this fails at row 0 instead of
// importing thousands of rows with shifted values.
function assertHeader(actual: string[], expected: readonly string[]): void {
  const normalised = actual.map((column) => column.trim());
  const matches =
    normalised.length === expected.length &&
    expected.every((column, index) => normalised[index] === column);

  if (!matches) {
    throw new Error(
      `Unexpected CSV header.\n  expected: ${expected.join(",")}\n  actual:   ${normalised.join(",")}`,
    );
  }
}

// One backtest_trades_*.csv into rows. `strategyKey` is carried in from the
// filename — the per-strategy files don't name themselves.
export function parseTradesCsv(
  contents: string,
): Omit<BacktestTradeRow, "strategyKey">[] {
  const [header, ...rows] = parseCsvLines(contents);
  if (header === undefined) return [];
  assertHeader(header, TRADE_COLUMNS);

  return rows.map((fields) => {
    if (fields.length !== TRADE_COLUMNS.length) {
      throw new Error(
        `Expected ${TRADE_COLUMNS.length} columns, got ${fields.length}: ${fields.join(",")}`,
      );
    }

    return {
      ticker: fields[0].trim(),
      entryDate: fields[1].trim(),
      exitDate: fields[2].trim(),
      entryPrice: requireNumber(fields[3], "entry_price"),
      stopPrice: requireNumber(fields[4], "stop_price"),
      exitPrice: requireNumber(fields[5], "exit_price"),
      shares: requireNumber(fields[6], "shares"),
      exitReason: parseExitReason(fields[7]),
      commission: requireNumber(fields[8], "commission"),
      pnlDollars: requireNumber(fields[9], "pnl_dollars"),
      rMultiple: requireNumber(fields[10], "r_multiple"),
      holdingDays: requireNumber(fields[11], "holding_days"),
    };
  });
}

// backtest_comparison.csv into per-strategy summaries, keyed by the LABEL the
// file uses. Resolving label → key is the catalog's job (backtestCatalog.ts),
// because the comparison file never carries the registry key.
export function parseComparisonCsv(
  contents: string,
): (Omit<BacktestStrategySummary, "key"> & { label: string })[] {
  const [header, ...rows] = parseCsvLines(contents);
  if (header === undefined) return [];
  assertHeader(header, COMPARISON_COLUMNS);

  return rows.map((fields) => {
    if (fields.length !== COMPARISON_COLUMNS.length) {
      throw new Error(
        `Expected ${COMPARISON_COLUMNS.length} columns, got ${fields.length}: ${fields.join(",")}`,
      );
    }

    return {
      label: fields[0].trim(),
      trades: requireNumber(fields[1], "trades"),
      // Percent as written (44.88), NOT divided into a fraction here — the
      // column is named _pct all the way to the database for that reason.
      winRatePct: requireNumber(fields[2], "win_rate"),
      avgR: requireNumber(fields[3], "avg_r"),
      profitFactor: requireNumber(fields[4], "profit_factor"),
      sharpe: requireNumber(fields[5], "sharpe"),
      sharpeBeforeCosts: requireNumber(fields[6], "sharpe_before_costs"),
      cagrPct: requireNumber(fields[7], "cagr_pct"),
      maxDdPct: requireNumber(fields[8], "max_dd_pct"),
      endValue: requireNumber(fields[9], "end_value"),
    };
  });
}
