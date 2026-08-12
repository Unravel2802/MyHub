import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { StatTile } from "@/src/components/ui/StatTile";
import { TaskCard } from "@/src/components/ui/TaskCard";

describe("dashboard shared patterns", () => {
  it("renders the section overline anatomy", () => {
    const html = renderToStaticMarkup(<SectionHeader>Today</SectionHeader>);

    expect(html).toContain("text-[11px]");
    expect(html).toContain("tracking-[0.08em]");
    expect(html).toContain("Today");
  });

  it("renders a mono stat with a three-pixel progress bar", () => {
    const html = renderToStaticMarkup(
      <StatTile label="Applications" progress={0.5} suffix="/ 10" value={5} />,
    );

    expect(html).toContain("font-mono");
    expect(html).toContain("h-[3px]");
    expect(html).toContain('value="50"');
  });

  it("renders an actionable task card", () => {
    const html = renderToStaticMarkup(
      <TaskCard label="Ship dashboard" meta="Today" />,
    );

    expect(html).toContain("Mark complete");
    expect(html).toContain("Ship dashboard");
    expect(html).toContain("Today");
  });
});
