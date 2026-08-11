import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActivityHeatmap } from "@/src/components/ui/ActivityHeatmap";
import type { ActivityGrid } from "@/src/modules/momentum/activityGrid";

const grid: ActivityGrid = {
  activeDays: 1,
  total: 1,
  weeks: [
    [
      { count: 1, future: false, key: "2026-07-27", level: 1 },
      { count: 0, future: false, key: "2026-07-28", level: 0 },
      { count: 0, future: false, key: "2026-07-29", level: 0 },
      { count: 0, future: false, key: "2026-07-30", level: 0 },
      { count: 0, future: true, key: "2026-07-31", level: 0 },
      { count: 0, future: true, key: "2026-08-01", level: 0 },
      { count: 0, future: true, key: "2026-08-02", level: 0 },
    ],
  ],
};

describe("ActivityHeatmap", () => {
  it("centers a short grid within the available panel width", () => {
    const html = renderToStaticMarkup(<ActivityHeatmap grid={grid} />);

    expect(html).toContain(
      'class="mx-auto flex w-max min-w-full justify-center gap-1"',
    );
  });
});
