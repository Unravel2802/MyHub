import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { LeetCodeDayGroup } from "@/src/modules/leetcode/leetcodeBoard";
import { LeetCodeDayHeader } from "@/src/modules/leetcode/components/LeetCodeDayHeader";

const group: LeetCodeDayGroup = {
  date: "2026-10-07",
  label: "Today",
  problems: [
    {
      id: "one",
      title: "One",
      questionNumber: 1,
      difficulty: "medium",
      tags: [],
      notes: null,
      status: "solved",
      deletedAt: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    },
  ],
  byDifficulty: { easy: 0, medium: 1, hard: 0 },
  byStatus: { to_review: 0, in_progress: 0, solved: 1, needs_revisit: 0 },
  timeMin: 130,
};

describe("LeetCodeDayHeader", () => {
  it("renders the day summary, difficulty mix, and formatted time", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <LeetCodeDayHeader
            collapsed={false}
            group={group}
            isToday
            moduleHue="cyan"
            onToggle={vi.fn()}
            showFullDate
          />
        </tbody>
      </table>,
    );

    expect(html).toContain('colSpan="6"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Today");
    expect(html).toContain("Wed, Oct 7");
    expect(html).toContain("1 Medium");
    expect(html).toContain("Problems");
    expect(html).toContain("Solved");
    expect(html).toContain("2h 10m");
    expect(html).toContain("border-l-hue-cyan-border");
  });

  it("omits time for never-attempted rows and uses a plain border", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <LeetCodeDayHeader
            collapsed
            group={{
              ...group,
              date: null,
              label: "Not attempted",
              timeMin: 0,
            }}
            isToday={false}
            moduleHue="cyan"
            onToggle={vi.fn()}
            showFullDate={false}
          />
        </tbody>
      </table>,
    );

    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("Not attempted");
    expect(html).not.toContain(">Time<");
    expect(html).toContain("border-l-border");
  });

  it("shows an older day date only in its label", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <LeetCodeDayHeader
            collapsed={false}
            group={{ ...group, label: "Fri, Jul 24", date: "2026-07-24" }}
            isToday={false}
            moduleHue="cyan"
            onToggle={vi.fn()}
            showFullDate={false}
          />
        </tbody>
      </table>,
    );

    expect(html.match(/Fri, Jul 24/g)).toHaveLength(1);
  });
});
