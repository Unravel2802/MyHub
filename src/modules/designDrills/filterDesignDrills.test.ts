import { describe, expect, it } from "vitest";
import { filterDesignDrills } from "@/src/modules/designDrills/filterDesignDrills";
import type { DesignDrill } from "@/src/modules/designDrills/types";

function drill(
  overrides: Partial<DesignDrill> & Pick<DesignDrill, "id" | "title">,
): DesignDrill {
  const timestamp = "2026-07-21T00:00:00.000Z";
  return {
    slug: overrides.id,
    category: "system_design",
    difficulty: "warmup",
    prompt: "Design a distributed service.",
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

describe("filterDesignDrills", () => {
  const drills = [
    drill({ id: "cache", title: "Distributed Cache", tags: ["caching"] }),
    drill({
      id: "ranking",
      title: "Search Ranking",
      category: "ml_system_design",
      difficulty: "core",
      prompt: "Rank candidates from click logs.",
      tags: ["ranking", "learning-to-rank"],
    }),
  ];

  it("combines text, tag, and bookmark filters", () => {
    expect(
      filterDesignDrills(
        drills,
        {
          bookmarkedOnly: true,
          category: "ml_system_design",
          difficulty: "core",
          query: "CLICK LOGS",
          tag: "ranking",
        },
        (id) => id === "ranking",
      ).map((item) => item.id),
    ).toEqual(["ranking"]);
  });

  it("matches search against tags case-insensitively", () => {
    expect(
      filterDesignDrills(
        drills,
        {
          bookmarkedOnly: false,
          category: "all",
          difficulty: "all",
          query: "CACHING",
          tag: null,
        },
        () => false,
      ).map((item) => item.id),
    ).toEqual(["cache"]);
  });
});
