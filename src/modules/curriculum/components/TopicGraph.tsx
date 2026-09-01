"use client";

import { useMemo } from "react";
import { hueVar, type HueName } from "@/src/components/moduleHues";
import { layoutTrack } from "@/src/modules/curriculum/curriculumLayout";
import type { Topic, TopicState } from "@/src/modules/curriculum/types";

// The roadmap picture: one track's prerequisite DAG, laid out by
// curriculumLayout.ts and painted here.
//
// Edges are an SVG layer; NODES ARE HTML BUTTONS on top of it, not <text> in
// the same SVG. Text in SVG doesn't wrap, can't use the app's font utilities,
// and gives a keyboard user nothing to tab to — three problems that all
// disappear by letting the browser lay out the label as HTML inside an
// absolutely-positioned button at the coordinates the layout computed.

interface TopicGraphProps {
  states: TopicState[];
  hue: HueName;
  selectedId: string | null;
  onSelect: (topic: Topic) => void;
}

export function TopicGraph({
  states,
  hue,
  selectedId,
  onSelect,
}: TopicGraphProps) {
  const topics = useMemo(() => states.map((state) => state.topic), [states]);
  const layout = useMemo(() => layoutTrack(topics), [topics]);
  const stateById = useMemo(
    () => new Map(states.map((state) => [state.topic.id, state])),
    [states],
  );

  if (layout.nodes.length === 0) return null;

  return (
    // Horizontal scroll on the graph itself, so a wide track scrolls inside its
    // panel instead of making the whole page scroll sideways.
    <div className="curriculum-graph min-w-0 overflow-x-auto rounded-lg border border-border bg-canvas p-2">
      <div
        className="relative mx-auto"
        style={{
          height: layout.height,
          width: layout.width,
          ["--hue" as string]: hueVar(hue),
        }}
      >
        <svg
          aria-hidden
          className="absolute inset-0"
          height={layout.height}
          width={layout.width}
        >
          {layout.edges.map((edge) => {
            // An edge lights up once its parent is finished: the picture then
            // shows the frontier of what you've opened up, which is the one
            // thing a prerequisite graph knows that a checklist doesn't.
            const cleared = stateById.get(edge.from)?.status === "done";
            return (
              <path
                className={
                  cleared
                    ? "stroke-[color:var(--hue)] opacity-70"
                    : "stroke-border"
                }
                d={edge.path}
                fill="none"
                key={`${edge.from}->${edge.to}`}
                strokeWidth={cleared ? 2 : 1.5}
              />
            );
          })}
        </svg>

        {layout.nodes.map((node) => {
          const state = stateById.get(node.topic.id)!;
          const selected = node.topic.id === selectedId;
          const percent = Math.round(state.progress * 100);

          return (
            <button
              aria-current={selected ? "true" : undefined}
              className={nodeClasses(state, selected)}
              key={node.topic.id}
              onClick={() => onSelect(node.topic)}
              style={{
                height: node.height,
                left: node.x,
                top: node.y,
                width: node.width,
              }}
              title={`${node.topic.label} — ${state.totalCount === 0 ? "no material yet" : `${state.doneCount} of ${state.totalCount} chapters read`}`}
              type="button"
            >
              <span className="line-clamp-2 px-2 text-center text-[13px] font-medium leading-tight">
                {node.topic.label}
              </span>

              {/* The underline bar, NeetCode's tell for "how far into this
                  topic am I". Rendered for every node including empty ones —
                  an absent bar would read as a broken node rather than as an
                  unwritten topic, which is what the muted track says. */}
              <span
                aria-hidden
                className="absolute inset-x-3 bottom-1.5 h-1 overflow-hidden rounded-full bg-surface-subtle"
              >
                {percent > 0 ? (
                  <span
                    className="hue-progress block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                    style={{ width: `${percent}%` }}
                  />
                ) : null}
              </span>

              <span className="sr-only">
                {state.totalCount === 0
                  ? "No material yet"
                  : `${state.doneCount} of ${state.totalCount} chapters read`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Four states, four treatments — and the difference between them has to survive
// being read at a glance from across the graph, which is why they differ in
// FILL, not just in border.
function nodeClasses(state: TopicState, selected: boolean): string {
  const base =
    "absolute flex flex-col items-center justify-center rounded-md border text-foreground transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--hue)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

  const tone =
    state.status === "done"
      ? "border-[color:var(--hue)] bg-[color-mix(in_srgb,var(--hue)_18%,var(--color-surface))]"
      : state.status === "in_progress"
        ? "border-[color:var(--hue)] bg-surface-raised"
        : state.status === "empty"
          ? // Dashed, and dimmed: the topic is real and on the map, but there
            // is nothing to read yet. Saying so in the picture is what turns
            // the graph into a to-write list as well as a to-read one.
            "border-dashed border-border bg-surface text-muted"
          : "border-border bg-surface-raised";

  const ring = selected
    ? "ring-2 ring-[color:var(--hue)] ring-offset-2 ring-offset-canvas"
    : "";
  const next =
    state.available && state.status === "not_started" && state.totalCount > 0
      ? "border-[color:var(--hue)]/60"
      : "";

  return `${base} ${tone} ${next} ${ring}`;
}
