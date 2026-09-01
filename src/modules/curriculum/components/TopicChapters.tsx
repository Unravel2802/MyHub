"use client";

import Link from "next/link";
import { Check, Circle, Star } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Panel } from "@/src/components/ui/Panel";
import {
  topicById,
  trackById,
} from "@/src/modules/curriculum/curriculumCatalog";
import { lessonKey, type TopicState } from "@/src/modules/curriculum/types";
import { useCurriculumStore } from "@/src/modules/curriculum/useCurriculumStore";
import type { HueName } from "@/src/components/moduleHues";

// The chapter list for whichever node is selected — NeetCode's problem table,
// one level down.

interface TopicChaptersProps {
  state: TopicState;
  hue: HueName;
}

const TIER_LABEL = {
  foundational: "Foundational",
  core: "Core",
  advanced: "Advanced",
} as const;

export function TopicChapters({ state, hue }: TopicChaptersProps) {
  const completed = useCurriculumStore((store) => store.completed);
  const starred = useCurriculumStore((store) => store.starred);
  const pendingKeys = useCurriculumStore((store) => store.pendingKeys);
  const setCompleted = useCurriculumStore((store) => store.setCompleted);
  const setStarred = useCurriculumStore((store) => store.setStarred);

  const { topic, lessons } = state;

  // Prereqs in ANOTHER track have no edge in the graph (see curriculumLayout.ts)
  // — this list is where that information lives instead, so it isn't simply
  // lost.
  const crossTrack = topic.prereqs
    .map((id) => topicById(id))
    .filter(
      (prereq) => prereq !== undefined && prereq.trackId !== topic.trackId,
    );

  return (
    <Panel
      // `min-w-0` for the same reason as the graph panel: these two are
      // siblings in one grid column, so a wide item here stretches BOTH.
      className="min-w-0"
      aside={<Badge hue={hue}>{TIER_LABEL[topic.tier]}</Badge>}
      description={topic.summary}
      overline={trackById(topic.trackId)?.label}
      title={topic.label}
    >
      {crossTrack.length > 0 ? (
        <p className="mb-4 text-sm text-muted">
          Also assumes:{" "}
          {crossTrack.map((prereq, at) => (
            <span key={prereq!.id}>
              {at > 0 ? ", " : ""}
              <span className="text-foreground">{prereq!.label}</span>
              <span className="text-subtle">
                {" "}
                ({trackById(prereq!.trackId)?.label})
              </span>
            </span>
          ))}
        </p>
      ) : null}

      {lessons.length === 0 ? (
        <EmptyState
          description={
            <>
              No chapters written for this topic yet. Generate them with the
              prompt in{" "}
              <code className="break-all">
                docs/curriculum-authoring-prompt.md
              </code>
              , then drop the files into{" "}
              <code className="break-all">{`content/curriculum/${topic.id}/`}</code>
              .
            </>
          }
          title="Nothing to read here yet"
        />
      ) : (
        <ul className="divide-y divide-border">
          {lessons.map((lesson) => {
            const key = lessonKey(topic.id, lesson.id);
            const isDone = completed[key] !== undefined;
            const isStarred = starred[key] === true;
            const isPending = pendingKeys.includes(key);

            return (
              <li
                className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                key={lesson.id}
              >
                <button
                  aria-label={
                    isDone
                      ? `Mark ${lesson.title} unread`
                      : `Mark ${lesson.title} read`
                  }
                  aria-pressed={isDone}
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    isDone
                      ? "border-success-border bg-success-surface text-success"
                      : "border-border text-subtle hover:border-accent-border hover:text-accent"
                  } ${isPending ? "opacity-50" : ""}`}
                  disabled={isPending}
                  onClick={() => void setCompleted(key, !isDone)}
                  type="button"
                >
                  {isDone ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : (
                    <Circle aria-hidden className="size-2.5" />
                  )}
                </button>

                <Link
                  className="min-w-0 flex-1 hover:text-accent-strong"
                  href={`/curriculum/${topic.id}/${lesson.id}`}
                >
                  <span
                    className={`block truncate text-sm ${isDone ? "text-muted" : "text-foreground"}`}
                  >
                    {lesson.title}
                  </span>
                  {lesson.summary ? (
                    <span className="block truncate text-xs text-subtle">
                      {lesson.summary}
                    </span>
                  ) : null}
                </Link>

                {lesson.minutes ? (
                  <span className="shrink-0 text-xs tabular-nums text-subtle">
                    {lesson.minutes} min
                  </span>
                ) : null}

                <button
                  aria-label={
                    isStarred
                      ? `Remove ${lesson.title} from revisit`
                      : `Flag ${lesson.title} to revisit`
                  }
                  aria-pressed={isStarred}
                  className={`shrink-0 rounded p-1 transition-colors ${
                    isStarred
                      ? "text-hue-amber"
                      : "text-subtle hover:text-foreground"
                  }`}
                  disabled={isPending}
                  onClick={() => void setStarred(key, !isStarred)}
                  type="button"
                >
                  <Star
                    aria-hidden
                    className="size-4"
                    fill={isStarred ? "currentColor" : "none"}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
