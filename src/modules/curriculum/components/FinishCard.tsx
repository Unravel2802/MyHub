"use client";
import { Check, Star } from "lucide-react";
import { useCurriculumStore } from "../useCurriculumStore";
import {
  lessonKey,
  type Topic,
  type Lesson,
  type CurriculumIndex,
} from "../types";
import { trackById } from "../curriculumCatalog";
import { trackState } from "../curriculumProgress";

export function FinishCard({
  topic,
  lesson,
  index,
}: {
  topic: Topic;
  lesson: Lesson;
  index: CurriculumIndex;
}) {
  const key = lessonKey(topic.id, lesson.meta.id);
  const completed = useCurriculumStore((store) => store.completed);
  const starred = useCurriculumStore((store) => store.starred);
  const pendingKeys = useCurriculumStore((store) => store.pendingKeys);
  const setCompleted = useCurriculumStore((store) => store.setCompleted);
  const setStarred = useCurriculumStore((store) => store.setStarred);
  const done = completed[key] !== undefined;
  const track = trackById(topic.trackId);
  const state = trackState(
    topic.trackId,
    index,
    new Set(Object.keys(completed)),
  );
  const finishedTopics = state.topics.filter(
    (entry) => entry.status === "done",
  ).length;
  const materialTopics = state.topics.filter(
    (entry) => entry.totalCount > 0,
  ).length;
  return (
    <section
      className={`mt-10 rounded-xl border p-6 ${done ? "border-success-border bg-success-surface" : "border-[var(--track-border)] bg-[var(--track-surface)]"}`}
    >
      <h2 className="text-xl font-semibold text-foreground">
        {done ? "Chapter complete" : "Finished this chapter?"}
      </h2>
      <p className="mt-2 text-sm text-body">
        {done
          ? `${track?.label}: ${finishedTopics} of ${materialTopics} topics read`
          : `Mark it read to fill in its node on the ${track?.label} map.`}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          aria-pressed={done}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--track)] px-4 py-2 text-sm font-medium text-canvas"
          disabled={pendingKeys.includes(key)}
          onClick={() => void setCompleted(key, !done)}
          type="button"
        >
          <Check aria-hidden className="size-4" />
          {done ? "Read" : "Mark as read"}
        </button>
        <button
          aria-pressed={starred[key] === true}
          className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          disabled={pendingKeys.includes(key)}
          onClick={() => void setStarred(key, starred[key] !== true)}
          type="button"
        >
          <Star
            aria-hidden
            className="size-4"
            fill={starred[key] ? "currentColor" : "none"}
          />
          {starred[key] ? "Flagged to revisit" : "Revisit later"}
        </button>
      </div>
    </section>
  );
}
