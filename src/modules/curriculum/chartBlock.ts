export interface ChartRow {
  label: string;
  low: number;
  high: number;
}

export interface ChartSpec {
  type: "bar";
  scale: "linear" | "log";
  unit: string | null;
  title: string | null;
  caption: string | null;
  highlight: string | null;
  rows: ChartRow[];
}

export function parseChartBlock(
  src: string,
): { ok: true; spec: ChartSpec } | { ok: false; error: string } {
  const lines = src.split(/\r?\n/);
  const divider = lines.indexOf("---");
  const fail = (error: string) => ({ ok: false as const, error });
  if (divider < 0) return fail('Missing "---" between header and rows.');
  const header: Record<string, string> = {};
  const keys = new Set([
    "type",
    "scale",
    "unit",
    "title",
    "caption",
    "highlight",
  ]);
  for (const line of lines.slice(0, divider).filter((line) => line.trim())) {
    const colon = line.indexOf(":");
    if (colon < 1) return fail(`Invalid header: ${line}`);
    const key = line.slice(0, colon).trim();
    if (!keys.has(key) || Object.hasOwn(header, key))
      return fail(`Unknown or duplicate header: ${key}`);
    header[key] = line.slice(colon + 1).trim();
  }
  if (header.type !== "bar") return fail('Chart type must be "bar".');
  if (header.scale !== undefined && !["linear", "log"].includes(header.scale))
    return fail('Scale must be "linear" or "log".');
  const data = lines.slice(divider + 1).filter((line) => line.trim());
  if (data.length < 1 || data.length > 12)
    return fail("A chart must have 1–12 rows.");
  const number = "-?\\d+(?:\\.\\d+)?(?:e\\d+)?";
  const values = new RegExp(`^(${number})(?:-(${number}))?$`);
  const rows: ChartRow[] = [];
  for (const line of data) {
    const colon = line.lastIndexOf(": ");
    const label = line.slice(0, colon).trim();
    const match = colon > 0 ? values.exec(line.slice(colon + 2).trim()) : null;
    if (!match || !label) return fail(`Invalid chart row: ${line}`);
    const low = Number(match[1]);
    const high = match[2] === undefined ? low : Number(match[2]);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low > high)
      return fail(`Invalid range: ${line}`);
    if (header.scale === "log" && low <= 0)
      return fail("Log charts require values greater than zero.");
    rows.push({ label, low, high });
  }
  return {
    ok: true,
    spec: {
      type: "bar",
      scale: header.scale === "log" ? "log" : "linear",
      unit: header.unit || null,
      title: header.title || null,
      caption: header.caption || null,
      highlight: header.highlight || null,
      rows,
    },
  };
}

function rounded(value: number): string {
  return String(Number(value.toPrecision(3)));
}

function compact(value: number): string {
  const scales: [number, string][] = [
    [1e15, "P"],
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "k"],
  ];
  const scale = scales.find(([size]) => Math.abs(value) >= size);
  return scale ? `${rounded(value / scale[0])}${scale[1]}` : rounded(value);
}

export function formatChartValue(v: number, unit: string | null): string {
  const magnitude = Math.abs(v);
  if (unit === "ns") {
    // Express half a millisecond and above in ms, including the chapter's RTT.
    const [size, suffix]: [number, string] =
      magnitude >= 1e9
        ? [1e9, "s"]
        : magnitude >= 5e5
          ? [1e6, "ms"]
          : magnitude >= 1e3
            ? [1e3, "µs"]
            : [1, "ns"];
    return `${rounded(v / size)} ${suffix}`;
  }
  if (unit === "B") {
    const sizes: [number, string][] = [
      [1e15, "PB"],
      [1e12, "TB"],
      [1e9, "GB"],
      [1e6, "MB"],
      [1e3, "KB"],
      [1, "B"],
    ];
    const [size, suffix] = sizes.find(([size]) => magnitude >= size) ?? [
      1,
      "B",
    ];
    return `${rounded(v / size)} ${suffix}`;
  }
  if (unit?.startsWith("$")) return `$${compact(v)}`;
  return `${compact(v)}${unit ? ` ${unit}` : ""}`;
}

// A range is display logic over the published single-value formatter. Share
// suffixes only when both endpoints have the same scale (never $10k–20M).
export function formatChartRange(
  low: number,
  high: number,
  unit: string | null,
): string {
  const left = formatChartValue(low, unit);
  if (low === high) return left;
  const right = formatChartValue(high, unit);
  const pieces = /^(\$?)(-?[\d.]+)(.*)$/;
  const a = pieces.exec(left);
  const b = pieces.exec(right);
  if (a && b && a[1] === b[1] && a[3] === b[3])
    return `${a[1]}${a[2]}–${b[2]}${b[3]}`;
  return `${left}–${right}`;
}
