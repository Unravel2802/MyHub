export type SegmentKind =
  "text" | "label" | "dim" | "arrow" | "flag" | "cross" | "box";
export interface Segment {
  kind: SegmentKind;
  text: string;
}
export interface ParsedFigure {
  title: string | null;
  lines: Segment[][];
}

export function parseFigure(raw: string): ParsedFigure {
  const source = raw.replace(/\s+$/, "");
  const input = source.split(/\r?\n/);
  const nonBlank = input
    .filter((line) => line.trim())
    .map((line) => line.search(/\S|$/));
  const indent = nonBlank.length ? Math.min(...nonBlank) : 0;
  let lines = input.map((line) => line.slice(indent));
  let title: string | null = null;
  if (
    /^[a-z]/.test(lines[0] ?? "") &&
    !/ {3,}/.test(lines[0] ?? "") &&
    lines[1] === ""
  ) {
    title = lines[0].replace(/:$/, "");
    lines = lines.slice(2);
  }
  return { title, lines: lines.map(parseLine) };
}

function parseLine(line: string): Segment[] {
  const label =
    /^(\s*)(\d+\.\s+)?([A-Z][A-Z0-9-]{2,}(?: [A-Z0-9-]{2,})*)(\s*\(.*\))?\s*$/.exec(
      line,
    );
  if (label)
    return [
      ...(label[1] ? [{ kind: "text" as const, text: label[1] }] : []),
      ...(label[2] ? [{ kind: "dim" as const, text: label[2] }] : []),
      { kind: "label", text: label[3] },
      ...(label[4] ? [{ kind: "dim" as const, text: label[4] }] : []),
    ];
  const leading = /^(\s*)([✗□✓])/.exec(line);
  if (leading)
    return [
      ...(leading[1] ? [{ kind: "text" as const, text: leading[1] }] : []),
      { kind: leading[2] === "✗" ? "cross" : "box", text: leading[2] },
      { kind: "text", text: line.slice(leading[0].length) },
    ];
  const flag = line.indexOf("←");
  const arrow = line.indexOf("→");
  const marker = flag >= 0 ? flag : arrow >= 0 ? arrow : -1;
  if (marker >= 0)
    return [
      { kind: "text", text: line.slice(0, marker) },
      { kind: flag >= 0 ? "flag" : "arrow", text: line.slice(marker) },
    ];
  return [{ kind: "text", text: line }];
}
