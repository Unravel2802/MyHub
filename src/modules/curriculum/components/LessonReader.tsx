"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { ChapterHeader } from "./ChapterHeader";
import { FinishCard } from "./FinishCard";
import { calloutMarker, hastText, isKeyRule } from "../callout";
import { MermaidDiagram } from "./MermaidDiagram";
import { ChartBlock } from "./ChartBlock";
import { WidgetBlock } from "./WidgetBlock";
import { CurriculumQuote } from "./CurriculumQuote";
import { CodeBlock } from "./CodeBlock";
import { ReadingProgress } from "./ReadingProgress";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  hueBorderVar,
  hueSurfaceVar,
  hueVar,
} from "@/src/components/moduleHues";
import { Markdown } from "@/src/components/ui/Markdown";
import {
  chapterOutline,
  enclosingSection,
  slugifyHeading,
  splitTakeaways,
} from "@/src/modules/curriculum/chapterStructure";
import { Figure } from "./Figure";
import { trackById } from "@/src/modules/curriculum/curriculumCatalog";
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

function curriculumComponents(
  outline: ReturnType<typeof chapterOutline>,
): Components {
  return {
    h2: ({ children, node, ...props }) => {
      const line = node?.position?.start?.line;
      const entry = outline.find((item) => item.line === line);
      const id = entry?.id ?? "section";
      return (
        <div className="group relative mt-12 first:mt-0 [&>h2]:inline">
          <span
            aria-hidden
            className="mr-2 inline-block align-baseline font-mono text-base font-semibold tabular-nums text-[var(--track)]"
          >
            {String(entry?.number ?? 1).padStart(2, "0")}
          </span>
          <h2
            id={id}
            className="scroll-mt-[140px] font-sans text-[27px] font-[650] leading-tight text-foreground"
            {...props}
          >
            {children}
          </h2>
          <a
            aria-label={`Link to ${entry?.text ?? id}`}
            className="ml-2 text-[var(--track)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            href={`#${id}`}
          >
            #
          </a>
        </div>
      );
    },
    pre: ({ children, node }) => {
      const code = children as React.ReactElement<{
        className?: string;
        children?: string;
      }>;
      const raw = hastText(node ?? {}).replace(/\n$/, "");
      const language = code?.props?.className?.match(/language-([^\s]+)/)?.[1];
      const caption =
        enclosingSection(outline, node?.position?.start.line ?? 0)?.text ??
        "Figure";
      if (language === "text") return <Figure raw={raw} caption={caption} />;
      if (language === "chart")
        return <ChartBlock raw={raw} caption={caption} />;
      if (language === "mermaid")
        return <MermaidDiagram raw={raw} caption={caption} />;
      if (language === "widget") return <WidgetBlock raw={raw} />;
      return (
        <CodeBlock raw={raw} language={language ?? "code"}>
          {children}
        </CodeBlock>
      );
    },
    blockquote: ({ children, node }) => (
      <CurriculumQuote marker={calloutMarker(node)} keyRule={isKeyRule(node)}>
        {children}
      </CurriculumQuote>
    ),
    table: ({ children, ...props }) => (
      <div className="my-5 overflow-x-auto">
        <table
          className="min-w-full border-collapse bg-surface tabular-nums"
          {...props}
        >
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
  const completed = useCurriculumStore((store) => store.completed);
  const fetchProgress = useCurriculumStore((store) => store.fetchProgress);
  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress]);
  const track = trackById(topic.trackId);
  const { main, takeaways } = splitTakeaways(lesson.body);
  const outline = useMemo(() => chapterOutline(main), [main]);
  const recapOutline = useMemo(
    () =>
      takeaways === null
        ? []
        : [
            {
              id: slugifyHeading(
                "What to take away",
                new Set(outline.map((entry) => entry.id)),
              ),
              text: "What to take away",
              number: outline.length + 1,
              line: 1,
            },
          ],
    [outline, takeaways],
  );
  const tocOutline = useMemo(
    () => [...outline, ...recapOutline],
    [outline, recapOutline],
  );
  const components = useMemo(() => curriculumComponents(outline), [outline]);
  const recapComponents = useMemo(
    () => curriculumComponents(recapOutline),
    [recapOutline],
  );
  const cssVars = {
    "--track": hueVar(track?.hue ?? "accent"),
    "--track-surface": hueSurfaceVar(track?.hue ?? "accent"),
    "--track-border": hueBorderVar(track?.hue ?? "accent"),
  } as React.CSSProperties;
  return (
    <article
      className="mx-auto grid w-full min-w-0 max-w-[1060px] gap-10 min-[1060px]:grid-cols-[minmax(0,740px)_220px] [counter-reset:fig]"
      data-curriculum-reader
      style={cssVars}
    >
      <ChapterHeader
        topic={topic}
        lesson={lesson}
        index={index}
        completedKeys={new Set(Object.keys(completed))}
      />
      <div className="row-start-3 min-w-0 min-[1060px]:col-start-1 min-[1060px]:row-start-2">
        <div className="max-w-[68ch] [font-family:var(--font-reading),Georgia,serif] text-[18px] leading-[1.65] text-body [&_h2]:font-sans [&_h2]:text-[27px] [&_h2]:font-[650] [&_h2]:leading-tight [&_h2]:text-foreground [&>.curriculum-main>p:first-child]:text-[19px]">
          <Markdown
            className="curriculum-main !text-[18px] [&_p]:leading-[1.65] [&_li]:leading-[1.65]"
            components={components}
          >
            {main}
          </Markdown>
          {takeaways ? (
            <section
              data-chapter-recap
              className="curriculum-recap mt-10 rounded-[14px] border border-border bg-surface p-6"
            >
              <Markdown
                components={recapComponents}
                className="!text-[18px] [&_p]:leading-[1.65] [&_li]:leading-[1.65]"
              >{`## What to take away\n\n${takeaways}`}</Markdown>
            </section>
          ) : null}
        </div>
        <FinishCard topic={topic} lesson={lesson} index={index} />
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
      <ReadingProgress outline={tocOutline} minutes={lesson.meta.minutes} />
    </article>
  );
}
