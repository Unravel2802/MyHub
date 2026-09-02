import { describe, expect, it } from "vitest";
import {
  assignLayers,
  catalogCycles,
  danglingPrereqs,
  layoutTrack,
  nodeWidth,
  NODE_HEIGHT,
  ROW_GAP,
} from "@/src/modules/curriculum/curriculumLayout";
import {
  TOPICS,
  TRACKS,
  topicsInTrack,
} from "@/src/modules/curriculum/curriculumCatalog";
import type { Tier, Topic } from "@/src/modules/curriculum/types";

function topic(id: string, prereqs: string[] = [], label = id): Topic {
  return {
    id,
    trackId: id.split(".")[0],
    label,
    summary: "",
    tier: "core" as Tier,
    prereqs,
  };
}

describe("assignLayers", () => {
  it("puts a topic one row below its only prerequisite", () => {
    const layers = assignLayers([topic("t.a"), topic("t.b", ["t.a"])]);
    expect(layers.get("t.a")).toBe(0);
    expect(layers.get("t.b")).toBe(1);
  });

  it("uses the LONGEST path, not the shortest", () => {
    // d requires both a (depth 0) and c (depth 2). Taking the shortest path
    // would draw d above c and point an edge upward.
    const layers = assignLayers([
      topic("t.a"),
      topic("t.b", ["t.a"]),
      topic("t.c", ["t.b"]),
      topic("t.d", ["t.a", "t.c"]),
    ]);
    expect(layers.get("t.d")).toBe(3);
  });

  it("ignores prerequisites from another track", () => {
    // The cross-track prereq has no node in this layout; if it counted toward
    // the in-degree, `t.b` would never be released from the queue at all.
    const layers = assignLayers([topic("t.b", ["other.x"])]);
    expect(layers.get("t.b")).toBe(0);
  });

  it("still places every topic when a cycle is present", () => {
    const layers = assignLayers([
      topic("t.a", ["t.b"]),
      topic("t.b", ["t.a"]),
      topic("t.c"),
    ]);
    expect(layers.size).toBe(3);
    expect(layers.get("t.c")).toBe(0);
    // The cycle members land below the healthy rows rather than vanishing.
    expect(layers.get("t.a")).toBe(1);
    expect(layers.get("t.b")).toBe(1);
  });
});

describe("layoutTrack", () => {
  it("centres a narrow row against the widest one", () => {
    const layout = layoutTrack([
      topic("t.a", [], "AAAA"),
      topic("t.b", [], "BBBB"),
      topic("t.c", ["t.a", "t.b"], "C"),
    ]);
    const [a, b, c] = ["t.a", "t.b", "t.c"].map((id) =>
      layout.nodes.find((node) => node.topic.id === id)!,
    );
    const rowCentre = (a.x + (b.x + b.width)) / 2;
    expect(c.x + c.width / 2).toBeCloseTo(rowCentre, 1);
  });

  it("spaces rows by NODE_HEIGHT + ROW_GAP", () => {
    const layout = layoutTrack([topic("t.a"), topic("t.b", ["t.a"])]);
    const a = layout.nodes.find((node) => node.topic.id === "t.a")!;
    const b = layout.nodes.find((node) => node.topic.id === "t.b")!;
    expect(b.y - a.y).toBe(NODE_HEIGHT + ROW_GAP);
  });

  it("never overlaps two nodes in the same row", () => {
    const layout = layoutTrack(topicsInTrack("backend"));
    const byLayer = new Map<number, typeof layout.nodes>();
    for (const node of layout.nodes) {
      byLayer.set(node.layer, [...(byLayer.get(node.layer) ?? []), node]);
    }
    for (const row of byLayer.values()) {
      const sorted = [...row].sort((left, right) => left.x - right.x);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i].x).toBeGreaterThanOrEqual(
          sorted[i - 1].x + sorted[i - 1].width,
        );
      }
    }
  });

  it("draws an edge only for same-track prerequisites", () => {
    const layout = layoutTrack([
      topic("t.a"),
      topic("t.b", ["t.a", "other.x"]),
    ]);
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({ from: "t.a", to: "t.b" });
  });

  it("draws every edge downward", () => {
    for (const track of TRACKS) {
      const layout = layoutTrack(topicsInTrack(track.id));
      const layerOf = new Map(
        layout.nodes.map((node) => [node.topic.id, node.layer]),
      );
      for (const edge of layout.edges) {
        expect(layerOf.get(edge.from)!).toBeLessThan(layerOf.get(edge.to)!);
      }
    }
  });

  it("keeps every node inside the reported canvas", () => {
    const layout = layoutTrack(topicsInTrack("ml-systems"));
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });

  it("handles an empty track without dividing by zero", () => {
    expect(layoutTrack([])).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
    });
  });
});

describe("nodeWidth", () => {
  it("grows with the label but stays within bounds", () => {
    expect(nodeWidth("A")).toBeLessThan(nodeWidth("A much longer label here"));
    expect(nodeWidth("A")).toBeGreaterThanOrEqual(132);
    expect(nodeWidth("x".repeat(200))).toBeLessThanOrEqual(232);
  });
});

// The catalog is hand-maintained data, so these are the guards that make a typo
// in it a failing test rather than a silently missing edge on the page.
describe("the catalog itself", () => {
  it("has no duplicate topic ids", () => {
    const ids = TOPICS.map((entry) => entry.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it("has no prerequisite pointing at a topic that doesn't exist", () => {
    expect(danglingPrereqs(TOPICS)).toEqual([]);
  });

  it("has no prerequisite cycles", () => {
    expect(catalogCycles(TOPICS)).toEqual([]);
  });

  it("puts every topic in a declared track", () => {
    const trackIds = new Set(TRACKS.map((track) => track.id));
    for (const entry of TOPICS) {
      expect(trackIds.has(entry.trackId)).toBe(true);
    }
  });

  it("gives every track at least one topic and one entry point", () => {
    for (const track of TRACKS) {
      const inTrack = topicsInTrack(track.id);
      expect(inTrack.length).toBeGreaterThan(0);
      // A track whose every topic has an in-track prereq is a track you cannot
      // start, which means the graph has a cycle or a missing root.
      const roots = inTrack.filter((entry) =>
        entry.prereqs.every(
          (prereq) => !inTrack.some((other) => other.id === prereq),
        ),
      );
      expect(roots.length).toBeGreaterThan(0);
    }
  });

  it("gives every topic a summary", () => {
    for (const entry of TOPICS) {
      expect(entry.summary.length).toBeGreaterThan(20);
    }
  });
});
