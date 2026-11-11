import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Markdown } from "@/src/components/ui/Markdown";
import { calloutMarker, isKeyRule } from "../callout";
import { CurriculumQuote } from "./CurriculumQuote";

function render(source: string) {
  return renderToStaticMarkup(
    <Markdown
      components={{
        blockquote: ({ children, node }) => (
          <CurriculumQuote
            marker={calloutMarker(node)}
            keyRule={isKeyRule(node)}
          >
            {children}
          </CurriculumQuote>
        ),
      }}
    >
      {source}
    </Markdown>,
  );
}
it("strips only the marker and preserves inline formatting", () => {
  const html = render(
    "> [!KEY] **A rule.** Use `code`, and [a link](#rule).\n>\n> A second paragraph.",
  );
  expect(html).toContain('aria-label="Key point"');
  expect(html).not.toContain("[!KEY]");
  expect(html).toMatch(/<strong[^>]*>A rule\.<\/strong>/);
  expect(html).toContain("A second paragraph.");
});
it("renders an unknown marker as a plain quotation", () => {
  const html = render("> [!UNKNOWN] **Still a quote.**");
  expect(html).toContain("<blockquote");
  expect(html).toContain("[!UNKNOWN]");
  expect(html).not.toContain("Key rule");
  expect(html).not.toContain("<aside");
  expect(render("> **[!UNKNOWN] Still a quote.**")).not.toContain("Key rule");
});
it("keeps entirely bold unmarked blockquotes as Key rule boxes", () => {
  expect(render("> **Always preserve the invariant.**")).toContain("Key rule");
});
it("places the first paragraph in a native summary and the answer after it", () => {
  const html = render(
    "> [!CHECK]\n> Why **replicate**?\n>\n> For **availability**.",
  );
  expect(html).toContain("<details");
  expect(html).toContain("Check yourself");
  expect(html).toMatch(/<summary[^>]*><span class="inline /);
  expect(html).not.toContain("[!CHECK]");
  expect(html.indexOf("replicate")).toBeLessThan(html.indexOf("</summary>"));
  expect(html.indexOf("availability")).toBeGreaterThan(
    html.indexOf("</summary>"),
  );
});

it("renders WHY as the prominent track callout and strips its marker", () => {
  const html = render(
    "> [!WHY] A concrete moment decides the outcome.\n> Another sentence.",
  );
  expect(html).toContain('aria-label="Why this matters"');
  expect(html).toContain("Why this matters");
  expect(html).toContain("text-base leading-relaxed");
  expect(html).not.toContain("[!WHY]");
  expect(html).toContain("A concrete moment decides the outcome.");
});

it("renders GOALS as a target-marked list without bullets or state", () => {
  const html = render(
    "> [!GOALS]\n>\n> - Compute a value\n> - Explain a trade-off\n> - Choose an option",
  );
  expect(html).toContain('aria-label="By the end you&#x27;ll be able to"');
  expect(html).toContain("By the end you&#x27;ll be able to");
  expect(html.match(/<svg/g) ?? []).toHaveLength(3);
  expect(html).toContain("list-none");
  expect(html).not.toContain("[!GOALS]");
  expect(html).not.toContain("<input");
});
