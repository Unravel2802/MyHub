import { describe, expect, it } from "vitest";
import { topicNeighbours } from "@/src/modules/curriculum/curriculumCatalog";

describe("topicNeighbours", () => {
  it("orders the estimation topic within Systems Design", () => {
    const result = topicNeighbours("systems-design.estimation");
    expect(result.position).toEqual({ index: 2, total: 18 });
    expect(result.buildsOn.map((topic) => topic.id)).toEqual([
      "systems-design.method",
    ]);
    expect(result.unlocks[0]?.id).toBe("systems-design.storage-choice");
  });
});
