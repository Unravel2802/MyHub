import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/src/components/ui/Markdown";
import { CALLOUT_KINDS, hastText } from "./callout";
import { parseChartBlock } from "./chartBlock";
import { widgetRegistry } from "./widgets/registry";

const ROOT = join(process.cwd(), "content", "curriculum");
export const EXERCISE_TRACKS: string[] = ["systems-design.estimation"];
function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory()
      ? markdownFiles(path)
      : entry.endsWith(".md")
        ? [path]
        : [];
  });
}

function firstSectionLine(source: string): number {
  const lines = source.split(/\r?\n/);
  let start = 0;
  if (lines[0]?.trim() === "---") {
    const closing = lines.findIndex(
      (line, index) => index > 0 && line.trim() === "---",
    );
    if (closing >= 0) start = closing + 1;
  }
  let fence: string | null = null;
  for (let index = start; index < lines.length; index += 1) {
    const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[index])?.[1];
    if (marker) {
      fence = fence === null ? marker[0] : fence === marker[0] ? null : fence;
      continue;
    }
    if (fence === null && /^##\s+/.test(lines[index])) return index + 1;
  }
  return Number.POSITIVE_INFINITY;
}

function violations(source: string, requireOpeners = false) {
  const openerMarkers: { kind: "WHY" | "GOALS"; line: number }[] = [];
  const errors = {
    charts: [] as string[],
    widgets: [] as string[],
    checks: [] as string[],
    kinds: [] as string[],
    openers: [] as string[],
    goals: [] as string[],
  };
  // Use the production Markdown parser: fences containing > [!KIND] are code,
  // and an answer paragraph has exactly the same meaning here as in the reader.
  renderToStaticMarkup(
    <Markdown
      components={{
        pre: ({ node }) => {
          const code = node?.children.find((child) => child.type === "element");
          const classes =
            code?.type === "element" ? code.properties.className : [];
          const raw = hastText(node ?? {}).trim();
          const line = node?.position?.start.line;
          if (Array.isArray(classes) && classes.includes("language-chart")) {
            const result = parseChartBlock(raw);
            if (!result.ok) errors.charts.push(`${line}: ${result.error}`);
          }
          if (
            Array.isArray(classes) &&
            classes.includes("language-widget") &&
            !Object.hasOwn(widgetRegistry, raw)
          )
            errors.widgets.push(`${line}: ${raw}`);
          return null;
        },
        blockquote: ({ node, children }) => {
          const elements =
            node?.children.filter((child) => child.type === "element") ?? [];
          const first = elements[0];
          if (first?.type !== "element" || first.tagName !== "p")
            return <>{children}</>;
          const text = hastText(first);
          const marker = /^\[!([^\]]+)\]/.exec(text);
          if (!marker) return <>{children}</>;
          const line = node?.position?.start.line;
          if (marker[1] === "WHY" || marker[1] === "GOALS") {
            openerMarkers.push({ kind: marker[1], line: line ?? 0 });
            if (marker[1] === "GOALS") {
              const sourceLines = source.split(/\r?\n/);
              const blankQuoteLine = sourceLines[line ?? 0] ?? "";
              const firstGoalLine = sourceLines[(line ?? 0) + 1] ?? "";
              const content = elements.slice(1);
              const lists = content.filter(
                (element) =>
                  element.type === "element" && element.tagName === "ul",
              );
              const items =
                lists[0]?.type === "element"
                  ? lists[0].children.filter(
                      (child) =>
                        child.type === "element" && child.tagName === "li",
                    )
                  : [];
              const countLists = (element: (typeof elements)[number]): number =>
                (element.type === "element" &&
                (element.tagName === "ul" || element.tagName === "ol")
                  ? 1
                  : 0) +
                (element.children
                  ?.filter((child) => child.type === "element")
                  .reduce((count, child) => count + countLists(child), 0) ?? 0);
              const listCount =
                lists[0]?.type === "element" ? countLists(lists[0]) : 0;
              if (
                !/^>\s*$/.test(blankQuoteLine) ||
                !/^>\s*[-*+]\s+/.test(firstGoalLine) ||
                text.slice(marker[0].length).trim() ||
                lists.length !== 1 ||
                listCount !== 1 ||
                content.length !== 1 ||
                items.length < 3 ||
                items.length > 4
              )
                errors.goals.push(`${line}: expected one list with 3–4 goals`);
            }
          }
          if (!(CALLOUT_KINDS as readonly string[]).includes(marker[1]))
            errors.kinds.push(`${line}: ${marker[1]}`);
          if (
            marker[1] === "CHECK" &&
            (!text.slice(marker[0].length).trim() ||
              !elements
                .slice(1)
                .some(
                  (element) =>
                    element.type === "element" &&
                    element.tagName === "p" &&
                    hastText(element).trim(),
                ))
          )
            errors.checks.push(`${line}: missing question or answer paragraph`);
          return <>{children}</>;
        },
      }}
    >
      {source}
    </Markdown>,
  );
  const firstHeadingLine = firstSectionLine(source);
  for (const kind of ["WHY", "GOALS"] as const) {
    const matches = openerMarkers.filter((marker) => marker.kind === kind);
    if (matches.length > 1) errors.openers.push(`duplicate ${kind}`);
    if (matches.some((marker) => marker.line >= firstHeadingLine))
      errors.openers.push(`${kind} must precede the first section`);
  }
  const why = openerMarkers.find((marker) => marker.kind === "WHY");
  const goals = openerMarkers.find((marker) => marker.kind === "GOALS");
  if (why && goals && why.line >= goals.line)
    errors.openers.push("WHY must precede GOALS");
  if (requireOpeners) {
    if (!why) errors.openers.push("missing WHY");
    if (!goals) errors.openers.push("missing GOALS");
  }
  return errors;
}

describe("curriculum visual content gates", () => {
  const files = markdownFiles(ROOT);
  it("finds real chapters", () => expect(files.length).toBeGreaterThan(300));
  it("rejects malformed blocks without mistaking fenced examples for callouts", () => {
    const errors = violations(
      "```chart\nbad\n```\n\n```widget\nunknown\n```\n\n> [!CHECK] Missing answer?\n\n> [!UNKNOWN] no\n\n```text\n> [!IGNORE] just code\n```",
    );
    expect(Object.values(errors).map((entries) => entries.length)).toEqual([
      1, 1, 1, 1, 0, 0,
    ]);
  });
  it("rejects misplaced, repeated and reversed chapter openers", () => {
    expect(
      violations(
        "> [!GOALS]\n>\n> - A\n> - B\n> - C\n\n> [!WHY] Why\n\n## Section",
      ).openers,
    ).not.toHaveLength(0);
    expect(violations("## Section\n\n> [!WHY] Why").openers).toContain(
      "WHY must precede the first section",
    );
    expect(
      violations("> [!WHY] One\n\n> [!WHY] Two\n\n## Section").openers,
    ).toContain("duplicate WHY");
    expect(
      violations("> [!GOALS]\n>\n> - A\n> - B\n> - C\n\n## Section").goals,
    ).toHaveLength(0);
    expect(
      violations("> [!GOALS]\n>\n> - A\n> - B\n\n## Section").goals,
    ).toHaveLength(1);
    expect(
      violations("> [!GOALS]\n> - A\n> - B\n> - C\n\n## Section").goals,
    ).toHaveLength(1);
  });
  it("checks nested quotes and fences inside a quote too", () => {
    const errors = violations(
      "> [!KEY] Outer quote.\n>\n> > [!UNKNOWN] Nested.\n>\n> ```chart\n> invalid chart\n> ```",
    );
    expect(errors.kinds).toHaveLength(1);
    expect(errors.charts).toHaveLength(1);
  });
  const results = files.map((file) => ({
    file: relative(ROOT, file),
    errors: violations(readFileSync(file, "utf8")),
  }));
  it.each([
    "charts",
    "widgets",
    "checks",
    "kinds",
    "openers",
    "goals",
  ] as const)("has no invalid %s blocks", (kind) => {
    expect(
      results.flatMap((result) =>
        result.errors[kind].map((error) => `${result.file}:${error}`),
      ),
    ).toEqual([]);
  });
  it("requires both openers for every chapter in the opener batches", () => {
    const covered = files.filter((file) =>
      EXERCISE_TRACKS.some((prefix) => relative(ROOT, file).startsWith(prefix)),
    );
    expect(covered.length).toBeGreaterThan(0);
    expect(
      covered.flatMap((file) => {
        const source = readFileSync(file, "utf8");
        const result = violations(source, true);
        return [
          ...result.openers.map((error) => `${relative(ROOT, file)}:${error}`),
          ...result.goals.map((error) => `${relative(ROOT, file)}:${error}`),
        ];
      }),
    ).toEqual([]);
  });
});
