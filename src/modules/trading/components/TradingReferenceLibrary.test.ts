import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TradingReferenceLibrary } from "@/src/modules/trading/components/TradingReferenceLibrary";

const contentDirectory = join(
  process.cwd(),
  "src",
  "modules",
  "trading",
  "content",
);

describe("TradingReferenceLibrary", () => {
  it("renders both static markdown documents and every deep-dive chapter", () => {
    const systematicPlan = readFileSync(
      join(contentDirectory, "systematic-trading-plan.md"),
      "utf8",
    );
    const technicalDeepDive = readFileSync(
      join(contentDirectory, "technical-deep-dive.md"),
      "utf8",
    );

    const html = renderToStaticMarkup(
      createElement(TradingReferenceLibrary, {
        systematicPlan,
        technicalDeepDive,
      }),
    );

    expect(html).toContain("The Scaling Roadmap");
    expect(html).toContain("Position Sizing Math");
    expect(html).toContain("The Full Python Stack");
    expect(html.match(/id=\"technical-\d{2}-/g)).toHaveLength(13);
    expect(html).not.toContain("&lt;div");
  });
});
