"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Copy, Star } from "lucide-react";
import {
  hueBorderVar,
  hueSurfaceVar,
  hueVar,
} from "@/src/components/moduleHues";
import { Markdown } from "@/src/components/ui/Markdown";
import {
  chapterOutline,
  slugifyHeading,
  splitTakeaways,
} from "@/src/modules/curriculum/chapterStructure";
import { parseFigure } from "@/src/modules/curriculum/figureLines";
import {
  topicNeighbours,
  trackById,
} from "@/src/modules/curriculum/curriculumCatalog";
import { lessonKey } from "@/src/modules/curriculum/types";
import { trackState } from "@/src/modules/curriculum/curriculumProgress";
import { useCurriculumStore } from "@/src/modules/curriculum/useCurriculumStore";
import type { Components } from "react-markdown";
import type {
  CurriculumIndex,
  Lesson,
  LessonMeta,
  Topic,
} from "@/src/modules/curriculum/types";

interface LessonReaderProps {
  topic: Topic;
  lesson: Lesson;
  previous: LessonMeta | null;
  next: LessonMeta | null;
  index: CurriculumIndex;
}

function Figure({ raw, caption }: { raw: string; caption: string }) {
  const parsed = parseFigure(raw);
  const [copied, setCopied] = useState(false);
  return (
    <figure
      className="my-6 min-w-0 overflow-hidden rounded-xl border border-border"
      style={
        {
          "--grid": "color-mix(in oklab, var(--border) 55%, transparent)",
        } as React.CSSProperties
      }
    >
      <figcaption className="flex items-center gap-3 border-b border-border px-4 py-2 font-mono text-[11px] uppercase tracking-wider">
        <span className="font-semibold text-[var(--track)]">FIG</span>
        <span className="min-w-0 flex-1 truncate text-muted">
          {parsed.title ?? caption}
        </span>
        <button
          className="inline-flex items-center gap-1 text-muted hover:text-foreground"
          onClick={() => {
            void navigator.clipboard.writeText(raw);
            setCopied(true);
          }}
          type="button"
        >
          <Copy aria-hidden className="size-3" />
          {copied ? "Copied" : "Copy"}
        </button>
      </figcaption>
      <div className="overflow-x-auto bg-[linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] bg-[size:22px_22px] p-4 font-mono text-[13.5px] leading-[1.7]">
        {parsed.lines.map((line, i) => (
          <div className="whitespace-pre" key={i}>
            {line.map((segment, j) => (
              <span
                className={
                  {
                    text: "text-body",
                    label: "font-semibold text-[var(--track)]",
                    dim: "text-muted",
                    arrow: "font-medium text-[var(--track)]",
                    flag: "rounded bg-[var(--hue-amber-surface)] px-1 text-[var(--hue-amber)]",
                    cross: "text-danger",
                    box: "text-[var(--track)]",
                  }[segment.kind] ?? "text-body"
                }
                key={j}
              >
                {segment.text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </figure>
  );
}

function curriculumComponents(
  outline: ReturnType<typeof chapterOutline>,
): Components {
  const taken = new Set<string>();
  return {
    h2: ({ children, node, ...props }) => {
      const line = node?.position?.start?.line;
      const entry = outline.find((item) => item.line === line);
      const id = entry?.id ?? slugifyHeading(String(children), taken);
      return (
        <div className="group relative mt-12 scroll-mt-24 first:mt-0">
          <span
            aria-hidden
            className="absolute -left-8 top-1 hidden font-mono text-xs font-semibold text-[var(--track)] sm:block"
          >
            {String(entry?.number ?? 1).padStart(2, "0")}
          </span>
          <h2 id={id} {...props}>
            {children}
          </h2>
          <a
            aria-label={`Link to ${String(children)}`}
            className="ml-2 text-[var(--track)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            href={`#${id}`}
          >
            #
          </a>
        </div>
      );
    },
    pre: ({ children }) => {
      const code = children as React.ReactElement<{
        className?: string;
        children?: string;
      }>;
      const raw = String(code?.props?.children ?? "").replace(/\n$/, "");
      const language = code?.props?.className?.match(/language-(\w+)/)?.[1];
      return language === "text" ? (
        <Figure raw={raw} caption={outline.at(-1)?.text ?? "Figure"} />
      ) : (
        <pre className="mt-5 overflow-x-auto rounded-lg border border-border border-l-4 border-l-[var(--track)] bg-surface-subtle p-4 font-mono text-sm leading-relaxed">
          {children}
        </pre>
      );
    },
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="my-5 border-l-2 border-[var(--track-border)] pl-5 font-serif italic text-body"
        {...props}
      >
        {children}
      </blockquote>
    ),
    table: ({ children, ...props }) => (
      <div className="my-5 overflow-x-auto">
        <table className="min-w-full border-collapse tabular-nums" {...props}>
          {children}
        </table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th
        className="border-b border-border bg-surface px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wide text-muted"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="border-b border-border px-3 py-2 text-body" {...props}>
        {children}
      </td>
    ),
  };
}

export function LessonReader({
  topic,
  lesson,
  previous,
  next,
  index,
}: LessonReaderProps) {
  const key = lessonKey(topic.id, lesson.meta.id);
  const completed = useCurriculumStore((store) => store.completed);
  const starred = useCurriculumStore((store) => store.starred);
  const pendingKeys = useCurriculumStore((store) => store.pendingKeys);
  const fetchProgress = useCurriculumStore((store) => store.fetchProgress);
  const setCompleted = useCurriculumStore((store) => store.setCompleted);
  const setStarred = useCurriculumStore((store) => store.setStarred);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);
  useEffect(() => {
    const onScroll = () => {
      const article = document.querySelector("[data-curriculum-reader]");
      if (!article) return;
      const max = article.scrollHeight - window.innerHeight;
      setProgress(
        max <= 0
          ? 1
          : Math.min(
              1,
              Math.max(
                0,
                (window.scrollY - article.getBoundingClientRect().top) / max,
              ),
            ),
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const done = completed[key] !== undefined;
  const track = trackById(topic.trackId);
  const neighbours = topicNeighbours(topic.id);
  const { main, takeaways } = splitTakeaways(lesson.body);
  const outline = useMemo(() => chapterOutline(main), [main]);
  const components = useMemo(() => curriculumComponents(outline), [outline]);
  const state = trackState(
    topic.trackId,
    index,
    new Set(Object.keys(completed)),
  );
  const minutesLeft =
    lesson.meta.minutes == null
      ? null
      : Math.round(lesson.meta.minutes * (1 - progress));
  const cssVars = {
    "--track": hueVar(track?.hue ?? "accent"),
    "--track-surface": hueSurfaceVar(track?.hue ?? "accent"),
    "--track-border": hueBorderVar(track?.hue ?? "accent"),
  } as React.CSSProperties;
  const finishedTopics = state.topics.filter(
    (entry) => entry.status === "done",
  ).length;
  const materialTopics = state.topics.filter(
    (entry) => entry.totalCount > 0,
  ).length;
  return (
    <article
      className="mx-auto grid w-full min-w-0 max-w-[1060px] gap-10 lg:grid-cols-[minmax(0,740px)_220px]"
      data-curriculum-reader
      style={cssVars}
    >
      <div
        className="fixed inset-x-0 top-0 z-20 h-[3px] origin-left bg-[var(--track)] motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted"
        >
          <Link href="/curriculum">Curriculum</Link>
          <span aria-hidden>/</span>
          <span>{track?.label}</span>
          <span aria-hidden>/</span>
          <Link href="/curriculum">{topic.label}</Link>
        </nav>
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted">
            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--track-surface)] px-2 py-1 text-[var(--track)]">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-[var(--track)]"
              />
              {track?.label}
            </span>
            <span>
              Topic {neighbours.position.index} of {neighbours.position.total}
            </span>
            <span>{topic.tier}</span>
            {lesson.meta.minutes ? (
              <span>{lesson.meta.minutes} min</span>
            ) : null}
          </div>
          <h2 className="mt-5 text-[clamp(34px,5.4vw,52px)] font-semibold leading-[1.05] tracking-tight text-balance text-foreground">
            {lesson.meta.title}
          </h2>
          {lesson.meta.summary ? (
            <p className="mt-5 max-w-[68ch] [font-family:var(--font-reading),Georgia,serif] text-[21px] leading-relaxed text-body">
              {lesson.meta.summary}
            </p>
          ) : null}
          {neighbours.buildsOn.length || neighbours.unlocks.length ? (
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Builds on", neighbours.buildsOn],
                  ["Unlocks", neighbours.unlocks],
                ] as const
              ).map(([label, entries]) =>
                entries.length ? (
                  <div
                    className="rounded-xl border border-border bg-surface p-4"
                    key={label}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
                      {label}
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {entries.map((entry) => (
                        <li key={entry.id}>
                          <span className="text-foreground">{entry.label}</span>
                          {entry.trackId !== topic.trackId ? (
                            <span className="ml-1 text-xs text-muted">
                              ({trackById(entry.trackId)?.label})
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          ) : null}
        </header>
        <div className="[font-family:var(--font-reading),Georgia,serif] text-[18px] leading-[1.65] text-body [&_h2]:font-sans [&_h2]:text-[27px] [&_h2]:font-semibold [&_h2]:leading-tight [&_h2]:text-foreground [&_p:first-child]:text-[19px] [&_p:first-child]:first-letter:float-left [&_p:first-child]:first-letter:mr-2 [&_p:first-child]:first-letter:text-[3.4em] [&_p:first-child]:first-letter:font-sans [&_p:first-child]:first-letter:font-semibold [&_p:first-child]:first-letter:text-[var(--track)]">
          <Markdown components={components}>{main}</Markdown>
          {takeaways ? (
            <section className="mt-10 rounded-xl border border-border bg-surface p-6">
              <h2 className="!mt-0 text-[27px] font-semibold text-foreground">
                What to take away
              </h2>
              <Markdown>{takeaways}</Markdown>
            </section>
          ) : null}
        </div>
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
              className="inline-flex items-center gap-2 rounded-md bg-[var(--track)] px-4 py-2 text-sm font-medium text-white"
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
        <nav
          aria-label="Chapter"
          className="mt-8 flex items-stretch justify-between gap-4 border-t border-border pt-5"
        >
          {previous ? (
            <Link
              className="group flex max-w-[48%] flex-col rounded-md border border-border p-3"
              href={`/curriculum/${topic.id}/${previous.id}`}
            >
              <span className="flex items-center gap-1 text-xs text-muted">
                <ArrowLeft aria-hidden className="size-3" />
                Previous
              </span>
              <span className="truncate text-sm text-foreground">
                {previous.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              className="group flex max-w-[48%] flex-col rounded-md border border-border p-3 text-right"
              href={`/curriculum/${topic.id}/${next.id}`}
            >
              <span className="flex items-center justify-end gap-1 text-xs text-muted">
                Next
                <ArrowRight aria-hidden className="size-3" />
              </span>
              <span className="truncate text-sm text-foreground">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </div>
      <aside className="hidden min-w-0 lg:block">
        <div className="sticky top-8">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            In this chapter
          </p>
          <nav className="mt-3 border-l border-border">
            {outline.map((entry) => (
              <a
                className="block border-l-2 border-transparent py-1 pl-3 text-sm text-muted hover:border-[var(--track)] hover:text-[var(--track)]"
                href={`#${entry.id}`}
                key={entry.id}
              >
                {entry.text}
              </a>
            ))}
          </nav>
          {minutesLeft !== null ? (
            <p className="mt-6 font-mono text-xs text-muted">
              {minutesLeft === 0
                ? "You're at the end"
                : `${minutesLeft} min left`}
            </p>
          ) : null}
        </div>
      </aside>
    </article>
  );
}
