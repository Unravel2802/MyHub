import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DrillList } from "@/src/modules/designDrills/components/DrillList";
import { DrillProgressOverview } from "@/src/modules/designDrills/components/DrillProgressOverview";
import { SolutionEditorial } from "@/src/modules/designDrills/components/SolutionEditorial";
import { filterDesignDrills } from "@/src/modules/designDrills/filterDesignDrills";
import type {
  DesignDrill,
  DrillSolution,
} from "@/src/modules/designDrills/types";

const timestamp = "2026-10-15T00:00:00.000Z";

function drill(
  overrides: Partial<DesignDrill> & Pick<DesignDrill, "id" | "title">,
): DesignDrill {
  return {
    slug: overrides.id,
    category: "system_design",
    difficulty: "warmup",
    prompt: "Design a service.",
    rubric: [],
    solution: "",
    solutionDetail: null,
    estimatedMinutes: 30,
    tags: [],
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

const drills = [
  drill({ id: "cache", title: "Distributed Cache" }),
  drill({
    id: "ranking",
    title: "Search Ranking",
    category: "ml_system_design",
  }),
  drill({
    id: "lru-cache",
    title: "Design LRU Cache",
    category: "coding_design",
  }),
];

const solution: DrillSolution = {
  summary: "Use a map and linked structure together.",
  sections: [],
  estimates: [
    {
      label: "get",
      value: "O(1) time",
      note: "Hash lookup and pointer update",
    },
  ],
};

describe("Design Drills coding-design UI", () => {
  it("lists every category in order and filters to coding-design drills", () => {
    const html = renderToStaticMarkup(
      <DrillList
        attempts={[]}
        drills={drills}
        isBookmarked={() => false}
        isStarting={false}
        onStart={vi.fn()}
        onToggleBookmark={vi.fn()}
        pendingIds={[]}
        startingDrillId={null}
      />,
    );

    const options = Array.from(
      html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]+)<\/option>/g),
      (match) => [match[1], match[2]],
    );
    expect(options.slice(0, 4)).toEqual([
      ["all", "All categories"],
      ["system_design", "System design"],
      ["ml_system_design", "ML system design"],
      ["coding_design", "Coding design"],
    ]);

    const filtered = filterDesignDrills(
      drills,
      {
        bookmarkedOnly: false,
        category: "coding_design",
        difficulty: "all",
        query: "",
        tag: null,
      },
      () => false,
    );
    expect(filtered.map((item) => item.title)).toEqual(["Design LRU Cache"]);
  });

  it("renders coding design in category coverage", () => {
    const html = renderToStaticMarkup(
      <DrillProgressOverview attempts={[]} drills={drills} />,
    );

    expect(html).toContain("Coding design");
  });

  it("uses complexity copy for coding-design estimates", () => {
    const html = renderToStaticMarkup(
      <SolutionEditorial category="coding_design" solution={solution} />,
    );

    expect(html).toContain("Complexity");
    expect(html).toContain("Time and space per operation.");
    expect(html).not.toContain("Scale, latency &amp; cost");
  });

  it("keeps scale, latency, and cost copy for system-design estimates", () => {
    const html = renderToStaticMarkup(
      <SolutionEditorial category="system_design" solution={solution} />,
    );

    expect(html).toContain("Scale, latency &amp; cost");
    expect(html).toContain(
      "Back-of-the-envelope figures that shape the architecture.",
    );
    expect(html).not.toContain("Complexity");
  });
});
