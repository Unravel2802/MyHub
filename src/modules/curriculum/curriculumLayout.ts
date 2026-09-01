import type { Topic, TopicId } from "@/src/modules/curriculum/types";

// Turning a track's prerequisite DAG into coordinates — a layered ("Sugiyama-
// lite") layout: assign every topic to a row by how deep it sits in the
// prerequisite chain, then spread each row horizontally and centre it.
//
// Hand-placed coordinates were the obvious alternative and were rejected: with
// 163 topics across 13 tracks, every catalog edit would have become a
// coordinate edit too, and the first one anybody forgot would leave a node
// sitting on top of another with nothing to catch it. Layout that FALLS OUT of
// the prereqs also means the picture cannot disagree with the data.
//
// Only SAME-TRACK prereqs take part. Cross-track ones are real, but drawing
// them would collapse thirteen readable graphs into one; the topic page lists
// them as text instead (see types.ts).

export const NODE_HEIGHT = 52;
export const ROW_GAP = 58;
export const COLUMN_GAP = 28;
const CHAR_WIDTH = 7.4;
const NODE_PADDING = 34;
const MIN_NODE_WIDTH = 132;
const MAX_NODE_WIDTH = 232;
// Breathing room around the whole graph so the outermost nodes' focus rings and
// hover lift aren't clipped by the scroll container.
const MARGIN = 24;

export interface LaidOutNode {
  topic: Topic;
  x: number;
  y: number;
  width: number;
  height: number;
  layer: number;
}

export interface LaidOutEdge {
  from: TopicId;
  to: TopicId;
  // An SVG cubic path, ready for a <path d={...}>.
  path: string;
}

export interface TrackLayout {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
}

// Labels are measured, not guessed at a fixed width, because "Git & Version
// Control" and "TDD & Test Doubles" want visibly different boxes and a single
// width sized for the longest makes the short ones look like empty plates.
// An average-character-width estimate is enough: the node's own CSS lets text
// centre inside whatever this returns, so being a few pixels out is invisible,
// and measuring for real would mean a DOM round-trip inside a layout that has
// to be a pure function to be testable.
export function nodeWidth(label: string): number {
  const estimate = Math.round(label.length * CHAR_WIDTH) + NODE_PADDING;
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, estimate));
}

// Longest-path layering: a topic sits one row below its deepest prerequisite,
// so an edge always points downward and never skips sideways.
//
// Kahn's algorithm rather than recursion with a visited set, for one reason: a
// cycle in the catalog (A requires B requires A) would make the recursive
// version either stack-overflow or silently return a wrong depth. Here a cycle
// simply leaves nodes unlayered, and the leftovers are placed in a final row —
// the graph still renders, the mistake is visible, and `catalogCycles` below
// turns it into a test failure rather than a thing you notice in a screenshot.
export function assignLayers(topics: readonly Topic[]): Map<TopicId, number> {
  const ids = new Set(topics.map((topic) => topic.id));
  // Only in-track prereqs count, and only ones that exist — a prereq pointing
  // at another track (or at a typo) must not hold a node down forever.
  const parents = new Map<TopicId, TopicId[]>(
    topics.map((topic) => [
      topic.id,
      topic.prereqs.filter((prereq) => ids.has(prereq)),
    ]),
  );

  const remaining = new Map<TopicId, number>(
    topics.map((topic) => [topic.id, parents.get(topic.id)!.length]),
  );
  const children = new Map<TopicId, TopicId[]>(
    topics.map((topic) => [topic.id, []]),
  );
  for (const topic of topics) {
    for (const prereq of parents.get(topic.id)!) {
      children.get(prereq)!.push(topic.id);
    }
  }

  const layers = new Map<TopicId, number>();
  const queue = topics
    .filter((topic) => remaining.get(topic.id) === 0)
    .map((topic) => topic.id);
  for (const id of queue) layers.set(id, 0);

  for (let head = 0; head < queue.length; head += 1) {
    const id = queue[head];
    for (const child of children.get(id)!) {
      // max, not min: a topic is only reachable once its LAST prerequisite is,
      // which is what "longest path" means here.
      layers.set(child, Math.max(layers.get(child) ?? 0, layers.get(id)! + 1));
      const left = remaining.get(child)! - 1;
      remaining.set(child, left);
      if (left === 0) queue.push(child);
    }
  }

  // Anything a cycle stranded. Placed below everything else rather than
  // dropped: a topic missing from the page is far harder to notice than one in
  // an odd row.
  const stranded = topics.filter((topic) => !layers.has(topic.id));
  if (stranded.length > 0) {
    const bottom = Math.max(-1, ...layers.values()) + 1;
    for (const topic of stranded) layers.set(topic.id, bottom);
  }

  return layers;
}

export function layoutTrack(topics: readonly Topic[]): TrackLayout {
  if (topics.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  const layers = assignLayers(topics);

  // Catalog order within a row. Deliberately stable rather than sorted by
  // anything clever: the catalog lists topics in the order a reader should meet
  // them, and reordering rows by, say, edge count would scramble that for a
  // marginal gain in crossings.
  const rows: Topic[][] = [];
  for (const topic of topics) {
    const layer = layers.get(topic.id)!;
    (rows[layer] ??= []).push(topic);
  }

  const widths = new Map<TopicId, number>(
    topics.map((topic) => [topic.id, nodeWidth(topic.label)]),
  );

  const rowWidths = rows.map(
    (row) =>
      row.reduce((total, topic) => total + widths.get(topic.id)!, 0) +
      COLUMN_GAP * Math.max(0, row.length - 1),
  );
  const widest = Math.max(...rowWidths);

  const nodes: LaidOutNode[] = [];
  rows.forEach((row, layer) => {
    // Centre each row against the widest one, so the graph reads as a spine
    // rather than a left-aligned staircase — the NeetCode look.
    let x = MARGIN + (widest - rowWidths[layer]) / 2;
    for (const topic of row) {
      const width = widths.get(topic.id)!;
      nodes.push({
        topic,
        x,
        y: MARGIN + layer * (NODE_HEIGHT + ROW_GAP),
        width,
        height: NODE_HEIGHT,
        layer,
      });
      x += width + COLUMN_GAP;
    }
  });

  const byId = new Map(nodes.map((node) => [node.topic.id, node]));
  const edges: LaidOutEdge[] = [];
  for (const node of nodes) {
    for (const prereq of node.topic.prereqs) {
      const parent = byId.get(prereq);
      // Skips cross-track prereqs, which have no node here.
      if (!parent) continue;
      edges.push({
        from: prereq,
        to: node.topic.id,
        path: edgePath(parent, node),
      });
    }
  }

  return {
    nodes,
    edges,
    width: widest + MARGIN * 2,
    height:
      rows.length * NODE_HEIGHT + (rows.length - 1) * ROW_GAP + MARGIN * 2,
  };
}

// Bottom-centre of the parent to top-centre of the child, as a cubic whose
// control points sit halfway down the gap. Vertical tangents at both ends mean
// the curve leaves and enters its boxes square-on, which is what stops a
// diagonal run from looking like it's aimed at the node beside its target.
function edgePath(parent: LaidOutNode, child: LaidOutNode): string {
  const x1 = round(parent.x + parent.width / 2);
  const y1 = round(parent.y + parent.height);
  const x2 = round(child.x + child.width / 2);
  const y2 = round(child.y);
  const bend = round((y2 - y1) / 2);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

// Prereqs that name a topic which doesn't exist. A typo here is otherwise
// invisible: the layout quietly skips the edge and the graph looks fine.
export function danglingPrereqs(
  topics: readonly Topic[],
): { topic: TopicId; prereq: TopicId }[] {
  const ids = new Set(topics.map((topic) => topic.id));
  return topics.flatMap((topic) =>
    topic.prereqs
      .filter((prereq) => !ids.has(prereq))
      .map((prereq) => ({ topic: topic.id, prereq })),
  );
}

// Topic ids caught in a prerequisite cycle, across the WHOLE catalog rather
// than per track — a cross-track cycle is just as wrong and wouldn't show up in
// any single track's layering.
export function catalogCycles(topics: readonly Topic[]): TopicId[] {
  const ids = new Set(topics.map((topic) => topic.id));
  // Kahn's again, but WITHOUT assignLayers' "strand the leftovers into a final
  // row" fallback — the leftovers are exactly the answer here.
  const remaining = new Map<TopicId, number>(
    topics.map((topic) => [
      topic.id,
      topic.prereqs.filter((prereq) => ids.has(prereq)).length,
    ]),
  );
  const children = new Map<TopicId, TopicId[]>(
    topics.map((topic) => [topic.id, []]),
  );
  for (const topic of topics) {
    for (const prereq of topic.prereqs) {
      if (ids.has(prereq)) children.get(prereq)!.push(topic.id);
    }
  }
  const queue = topics
    .filter((topic) => remaining.get(topic.id) === 0)
    .map((topic) => topic.id);
  for (let head = 0; head < queue.length; head += 1) {
    for (const child of children.get(queue[head])!) {
      const left = remaining.get(child)! - 1;
      remaining.set(child, left);
      if (left === 0) queue.push(child);
    }
  }
  return topics.map((topic) => topic.id).filter((id) => remaining.get(id)! > 0);
}
