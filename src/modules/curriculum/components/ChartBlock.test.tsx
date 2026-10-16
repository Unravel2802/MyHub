import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ChartBlock } from "./ChartBlock";

it("renders accessible chart data and focusable rows without incrementing text figures", () => {
  const html = renderToStaticMarkup(
    <ChartBlock
      raw={"type: bar\nunit: $/month\n---\ndirect: 96000\nCDN: 10000-20000"}
      caption="Costs"
    />,
  );
  expect(html).toContain('role="img"');
  expect(html).toContain('aria-label="direct: $96k; CDN: $10–20k"');
  expect(html).toContain('tabindex="0"');
  expect(html).toContain('<table class="sr-only">');
  expect(html).not.toContain("<figure");
});
it("falls back to the source figure with a visible parse error", () => {
  const html = renderToStaticMarkup(
    <ChartBlock raw="not a chart" caption="Fallback" />,
  );
  expect(html).toContain("Chart error:");
  expect(html).toContain("<figure");
  expect(html).toContain("not a chart");
});
