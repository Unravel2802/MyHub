"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Star } from "lucide-react";
import { Badge } from "@/src/components/ui/Badge";
import { Markdown } from "@/src/components/ui/Markdown";
import { Panel } from "@/src/components/ui/Panel";
import { trackById } from "@/src/modules/curriculum/curriculumCatalog";
import { lessonKey } from "@/src/modules/curriculum/types";
import { useCurriculumStore } from "@/src/modules/curriculum/useCurriculumStore";
import type { Lesson, LessonMeta, Topic } from "@/src/modules/curriculum/types";

// One chapter. The BODY arrives as a prop from the server component that read
// the file (content.ts) — this half is client-side only because marking a
// chapter read is a Supabase write.

interface LessonReaderProps {
  topic: Topic;
  lesson: Lesson;
  previous: LessonMeta | null;
  next: LessonMeta | null;
}

export function LessonReader({
  topic,
  lesson,
  previous,
  next,
}: LessonReaderProps) {
  const key = lessonKey(topic.id, lesson.meta.id);
  const completed = useCurriculumStore((store) => store.completed);
  const starred = useCurriculumStore((store) => store.starred);
  const pendingKeys = useCurriculumStore((store) => store.pendingKeys);
  const fetchProgress = useCurriculumStore((store) => store.fetchProgress);
  const setCompleted = useCurriculumStore((store) => store.setCompleted);
  const setStarred = useCurriculumStore((store) => store.setStarred);

  // The reader is reachable by a direct link, so it can be the first page of
  // the session — it can't assume the map already loaded the progress.
  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);

  const isDone = completed[key] !== undefined;
  const isStarred = starred[key] === true;
  const isPending = pendingKeys.includes(key);

  return (
    <article className="mx-auto w-full min-w-0 max-w-3xl">
      <nav
        aria-label="Breadcrumb"
        className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted"
      >
        <Link className="hover:text-accent-strong" href="/curriculum">
          Curriculum
        </Link>
        <span aria-hidden>/</span>
        <span>{trackById(topic.trackId)?.label}</span>
        <span aria-hidden>/</span>
        <Link className="hover:text-accent-strong" href="/curriculum">
          {topic.label}
        </Link>
      </nav>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* h2, not h1: AppShell renders the page's single h1 (the rail
              title), exactly as PageHeader does on every other page. */}
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {lesson.meta.title}
          </h2>
          {lesson.meta.minutes ? (
            <Badge>{lesson.meta.minutes} min read</Badge>
          ) : null}
        </div>
        {lesson.meta.summary ? (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {lesson.meta.summary}
          </p>
        ) : null}
      </header>

      <Panel>
        <Markdown className="text-[15px] leading-relaxed">
          {lesson.body}
        </Markdown>
      </Panel>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          aria-pressed={isDone}
          className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            isDone
              ? "border-success-border bg-success-surface text-success"
              : "border-accent-border bg-accent-surface text-accent-strong hover:bg-accent-surface/70"
          } ${isPending ? "opacity-60" : ""}`}
          disabled={isPending}
          onClick={() => void setCompleted(key, !isDone)}
          type="button"
        >
          <Check aria-hidden className="size-4" />
          {isDone ? "Read" : "Mark as read"}
        </button>

        <button
          aria-pressed={isStarred}
          className={`inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors ${
            isStarred ? "text-hue-amber" : "text-muted hover:text-foreground"
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
          {isStarred ? "Flagged to revisit" : "Revisit later"}
        </button>
      </div>

      {/* Reading order matters in a textbook, so the footer offers the next
          chapter rather than making you go back to the map for it. */}
      <nav
        aria-label="Chapter"
        className="mt-8 flex items-stretch justify-between gap-4 border-t border-border pt-5"
      >
        {previous ? (
          <Link
            className="group flex max-w-[48%] flex-col rounded-md border border-border p-3 text-left hover:border-accent-border"
            href={`/curriculum/${topic.id}/${previous.id}`}
          >
            <span className="flex items-center gap-1 text-xs text-subtle">
              <ArrowLeft aria-hidden className="size-3" /> Previous
            </span>
            <span className="mt-0.5 truncate text-sm text-foreground group-hover:text-accent-strong">
              {previous.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            className="group flex max-w-[48%] flex-col rounded-md border border-border p-3 text-right hover:border-accent-border"
            href={`/curriculum/${topic.id}/${next.id}`}
          >
            <span className="flex items-center justify-end gap-1 text-xs text-subtle">
              Next <ArrowRight aria-hidden className="size-3" />
            </span>
            <span className="mt-0.5 truncate text-sm text-foreground group-hover:text-accent-strong">
              {next.title}
            </span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
