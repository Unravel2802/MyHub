import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/src/components/ui/Markdown";
import { CALLOUT_KINDS, hastText } from "./callout";
import { parseChartBlock } from "./chartBlock";
import { widgetRegistry } from "./widgets/registry";

const ROOT = join(process.cwd(), "content", "curriculum");
export const EXERCISE_TRACKS: string[] = [
  "systems-design.estimation",
  "systems-design",
  "distributed.fundamentals",
  "distributed.rpc",
  "distributed.time",
  "distributed.replication",
  "distributed.partitioning",
  "distributed.consistency",
  "distributed.consensus",
  "distributed.transactions",
  "distributed.batch-stream",
  "distributed.membership",
  "distributed.crdt",
  "distributed.scheduling",
];
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
    exercises: [] as string[],
  };
  const headings: { text: string; line: number }[] = [];
  const exerciseBlocks: {
    level?: string;
    heading?: string;
    prompt: string;
    solution: string;
  }[] = [];
  const quotes: { heading?: string }[] = [];
  // Use the production Markdown parser: fences containing > [!KIND] are code,
  // and an answer paragraph has exactly the same meaning here as in the reader.
  renderToStaticMarkup(
    <Markdown
      components={{
        h2: ({ node, children }) => {
          headings.push({
            text: hastText(node ?? {}),
            line: node?.position?.start.line ?? 0,
          });
          return <>{children}</>;
        },
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
          const line = node?.position?.start.line;
          const activeHeading = [...headings]
            .reverse()
            .find((heading) => heading.line < (line ?? 0))?.text;
          quotes.push({ heading: activeHeading });
          const elements =
            node?.children.filter((child) => child.type === "element") ?? [];
          const first = elements[0];
          if (first?.type !== "element" || first.tagName !== "p")
            return <>{children}</>;
          const text = hastText(first);
          const marker = /^\[!([^\]]+)\]/.exec(text);
          if (!marker) return <>{children}</>;
          const kind = marker[1].split(/\s/, 1)[0];
          if (kind === "WHY" || kind === "GOALS") {
            openerMarkers.push({ kind, line: line ?? 0 });
            if (kind === "GOALS") {
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
          if (kind === "EXERCISE") {
            const level = /^\[!EXERCISE\s+([^\]\s]+)\]/.exec(text)?.[1];
            const content = elements.slice(1);
            const labelIndex = (label: string) =>
              content.findIndex(
                (element) =>
                  element.type === "element" &&
                  element.tagName === "p" &&
                  element.children[0]?.type === "element" &&
                  element.children[0].tagName === "strong" &&
                  hastText(element.children[0]).trim() === `${label}:`,
              );
            const solutionAt = labelIndex("Solution");
            const hintAt = labelIndex("Hint");
            const promptEnd =
              hintAt >= 0
                ? hintAt
                : solutionAt >= 0
                  ? solutionAt
                  : content.length;
            const prompt =
              `${text.slice(marker[0].length)}${content.slice(0, promptEnd).map(hastText).join("")}`.trim();
            const solution =
              solutionAt < 0
                ? ""
                : content
                    .slice(solutionAt)
                    .map(hastText)
                    .join("")
                    .replace(/^Solution:/, "")
                    .trim();
            exerciseBlocks.push({
              level,
              heading: activeHeading,
              prompt,
              solution,
            });
            if (
              !level ||
              !["recall", "apply", "stretch"].includes(level) ||
              !prompt ||
              !solution
            )
              errors.exercises.push(
                `${line}: invalid level or missing prompt/solution`,
              );
          }
          if (!(CALLOUT_KINDS as readonly string[]).includes(kind))
            errors.kinds.push(`${line}: ${kind}`);
          if (
            kind === "CHECK" &&
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
  const exerciseAt = headings.findIndex(
    (heading) => heading.text.toLowerCase() === "exercises",
  );
  if (exerciseAt >= 0) {
    if (
      exerciseAt !== headings.length - 1 ||
      headings[exerciseAt - 1]?.text.toLowerCase() !== "what to take away"
    )
      errors.exercises.push(
        "## Exercises must be last and follow ## What to take away",
      );
    const inSection = exerciseBlocks.filter(
      (block) => block.heading?.toLowerCase() === "exercises",
    );
    const sectionQuotes = quotes.filter(
      (quote) => quote.heading?.toLowerCase() === "exercises",
    );
    if (
      inSection.length !== 3 ||
      sectionQuotes.length !== 3 ||
      inSection.map((block) => block.level).join(",") !== "recall,apply,stretch"
    )
      errors.exercises.push(
        "## Exercises must contain exactly recall, apply, stretch",
      );
    if (exerciseBlocks.length !== inSection.length)
      errors.exercises.push("EXERCISE callout outside ## Exercises");
    const sourceLines = source.split(/\r?\n/);
    if (
      sourceLines
        .slice(headings[exerciseAt].line)
        .some((line) => line.trim() && !/^\s*>/.test(line))
    )
      errors.exercises.push(
        "## Exercises may contain only blockquotes and blank lines",
      );
  } else if (exerciseBlocks.length)
    errors.exercises.push("EXERCISE callout outside ## Exercises");
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
      1, 1, 1, 1, 0, 0, 0,
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
  it("rejects malformed exercise sections", () => {
    const exercise = (level: string, solution = "**Solution:** Answer") =>
      `> [!EXERCISE ${level}] Prompt\n>\n> ${solution}`;
    const section = (...blocks: string[]) =>
      `## What to take away\nRecap\n\n## Exercises\n\n${blocks.join("\n\n")}`;
    expect(
      violations(
        section(exercise("stretch"), exercise("recall"), exercise("apply")),
      ).exercises,
    ).not.toHaveLength(0);
    expect(
      violations(section(exercise("recall"), exercise("apply"))).exercises,
    ).not.toHaveLength(0);
    expect(
      violations(
        `${exercise("recall")}\n\n${section(exercise("recall"), exercise("apply"), exercise("stretch"))}`,
      ).exercises,
    ).not.toHaveLength(0);
    expect(
      violations(
        section(
          exercise("recall"),
          exercise("apply"),
          exercise("stretch", "No solution label"),
        ),
      ).exercises,
    ).not.toHaveLength(0);
    expect(
      violations(
        `${section(exercise("recall"), exercise("apply"), exercise("stretch"))}\n\n## Later\nMore`,
      ).exercises,
    ).not.toHaveLength(0);
    expect(
      violations(
        `${section(exercise("recall"), exercise("apply"), exercise("stretch"))}\nStray prose`,
      ).exercises,
    ).not.toHaveLength(0);
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
    "exercises",
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
          ...result.exercises.map(
            (error) => `${relative(ROOT, file)}:${error}`,
          ),
        ];
      }),
    ).toEqual([]);
  });

  it("enforces the DS4 visual quotas and source formatting", () => {
    const topics = [
      "distributed.batch-stream",
      "distributed.membership",
      "distributed.crdt",
      "distributed.scheduling",
    ];
    const chapters = files.filter((file) =>
      topics.includes(relative(ROOT, file).split("/")[0]),
    );
    expect(chapters).toHaveLength(18);
    const count = (source: string, pattern: RegExp) =>
      [...source.matchAll(pattern)].length;
    for (const file of chapters) {
      const source = readFileSync(file, "utf8");
      const name = relative(ROOT, file);
      // Count fences in the source, not in fence-stripped prose.
      expect(count(source, /^```mermaid\s*$/gm), name).toBeLessThanOrEqual(2);
      expect(count(source, /^```chart\s*$/gm), name).toBeLessThanOrEqual(1);
      expect(count(source, /^```widget\s*$/gm), name).toBe(0);
      const prose = source.replace(/^```[^\n]*\n[\s\S]*?^```[^\n]*$/gm, "");
      expect(count(prose, /^> \[!KEY\]/gm), name).toBeLessThanOrEqual(2);
      const checks = [...prose.matchAll(/^> \[!CHECK\]/gm)];
      expect(checks, name).toHaveLength(2);
      const recapAt = prose.indexOf("## What to take away");
      expect(
        checks.every((check) => check.index < recapAt),
        name,
      ).toBe(true);
      const why = /^> \[!WHY\] (.+)$/m.exec(prose);
      expect(why?.[1].trim(), name).toBeTruthy();
      expect(prose, name).not.toMatch(/[A-Za-z]-[ \t]*\n/);
      expect(prose, name).not.toMatch(/[A-Za-z]\n-[a-z]/);
      for (const fence of source.matchAll(/^```([^\n]*)\n([\s\S]*?)^```/gm)) {
        for (const line of fence[2].trimEnd().split("\n")) {
          expect(line.length, `${name}: ${line}`).toBeLessThanOrEqual(76);
        }
        if (fence[1].trim() === "mermaid") {
          const diagram = fence[2];
          if (/^flowchart /m.test(diagram)) {
            expect(diagram, name).toMatch(/^flowchart TB$/m);
          }
        }
      }
    }
    for (const topic of topics) {
      const source = chapters
        .filter((file) => relative(ROOT, file).split("/")[0] === topic)
        .map((file) => readFileSync(file, "utf8"))
        .join("\n");
      const pitfalls = count(source, /^> \[!PITFALL\]/gm);
      expect(pitfalls, topic).toBeGreaterThanOrEqual(1);
      expect(pitfalls, topic).toBeLessThanOrEqual(3);
      expect(count(source, /^> \[!INTERVIEW\]/gm), topic).toBe(1);
    }
  });
});
