import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/src/components/ui/Markdown";
import { CALLOUT_KINDS, hastText } from "./callout";
import { parseChartBlock } from "./chartBlock";
import { widgetRegistry } from "./widgets/registry";

const ROOT = join(process.cwd(), "content", "curriculum");
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

function violations(source: string) {
  const errors = {
    charts: [] as string[],
    widgets: [] as string[],
    checks: [] as string[],
    kinds: [] as string[],
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
      1, 1, 1, 1,
    ]);
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
  it.each(["charts", "widgets", "checks", "kinds"] as const)(
    "has no invalid %s blocks",
    (kind) => {
      expect(
        results.flatMap((result) =>
          result.errors[kind].map((error) => `${result.file}:${error}`),
        ),
      ).toEqual([]);
    },
  );
});
