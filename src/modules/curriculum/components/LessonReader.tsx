"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
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
  splitExercises,
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
  let exerciseNumber = 0;
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
    blockquote: ({ children, node }) => {
      const marker = calloutMarker(node);
      if (marker?.kind === "EXERCISE") {
        exerciseNumber += 1;
        let remaining = marker.prefix.length;
        const stripPrefix = (child: ReactNode): ReactNode => {
          if (!remaining) return child;
          if (typeof child === "string") {
            const value = child.slice(remaining);
            remaining = Math.max(0, remaining - child.length);
            return value;
          }
          if (isValidElement<{ children?: ReactNode }>(child))
            return cloneElement(
              child,
              {},
              Children.map(child.props.children, stripPrefix),
            );
          return child;
        };
        const blocks = Children.toArray(children).filter(
          (child) => typeof child !== "string" || child.trim(),
        );
        const hastBlocks =
          node?.children.filter((child) => child.type === "element") ?? [];
        const labelIndex = (label: "Hint:" | "Solution:") =>
          hastBlocks.findIndex(
            (block, index) =>
              index > 0 &&
              block.type === "element" &&
              block.tagName === "p" &&
              block.children[0]?.type === "element" &&
              block.children[0].tagName === "strong" &&
              hastText(block.children[0]).trim() === label,
          );
        const hintAt = labelIndex("Hint:");
        const solutionAt = labelIndex("Solution:");
        const promptEnd =
          hintAt >= 0 ? hintAt : solutionAt >= 0 ? solutionAt : blocks.length;
        const prompt: ReactNode[] = blocks.slice(0, promptEnd);
        if (prompt.length) prompt[0] = stripPrefix(prompt[0] ?? null);
        const stripLabel = (child: ReactNode) => {
          if (!isValidElement<{ children?: ReactNode }>(child)) return child;
          const parts = Children.toArray(child.props.children);
          const first = parts[0];
          if (!isValidElement<{ children?: ReactNode }>(first)) return child;
          return cloneElement(
            child,
            {},
            <>
              {cloneElement(
                first,
                {},
                Children.toArray(first.props.children).slice(1),
              )}
              {parts.slice(1)}
            </>,
          );
        };
        const level = marker.level;
        const tone =
          level === "apply"
            ? "bg-[var(--hue-amber-surface)] text-[var(--hue-amber)]"
            : level === "stretch"
              ? "bg-[var(--hue-violet-surface)] text-[var(--hue-violet)]"
              : "bg-[var(--track-surface)] text-[var(--track)]";
        const label = level
          ? `${level[0].toUpperCase()}${level.slice(1)}`
          : "Unknown";
        return (
          <section
            className="my-5 rounded-[14px] border border-border bg-surface p-5"
            data-exercise-card
          >
            <header className="mb-3 flex items-center justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                Exercise {exerciseNumber}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide ${tone}`}
              >
                {label}
              </span>
            </header>
            <div>{prompt}</div>
            {hintAt >= 0 && blocks[hintAt] && (
              <details className="mt-4 border-t border-border pt-3">
                <summary className="cursor-pointer font-mono text-xs text-muted">
                  Hint
                </summary>
                <div className="mt-3">{stripLabel(blocks[hintAt])}</div>
              </details>
            )}
            {solutionAt >= 0 && blocks[solutionAt] && (
              <details className="mt-3 border-t border-border pt-3">
                <summary className="cursor-pointer font-mono text-xs text-muted">
                  Show solution
                </summary>
                <div className="mt-3">{stripLabel(blocks[solutionAt])}</div>
              </details>
            )}
          </section>
        );
      }
      return (
        <CurriculumQuote marker={marker} keyRule={isKeyRule(node)}>
          {children}
        </CurriculumQuote>
      );
    },
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
  const { main: withoutExercises, exercises } = splitExercises(lesson.body);
  const { main, takeaways } = splitTakeaways(withoutExercises);
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
  const exercisesOutline = useMemo(
    () =>
      exercises === null
        ? []
        : [
            {
              id: slugifyHeading(
                "Exercises",
                new Set([...outline, ...recapOutline].map((entry) => entry.id)),
              ),
              text: "Exercises",
              number: outline.length + recapOutline.length + 1,
              line: 1,
            },
          ],
    [exercises, outline, recapOutline],
  );
  const tocOutline = useMemo(
    () => [...outline, ...recapOutline, ...exercisesOutline],
    [outline, recapOutline, exercisesOutline],
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
          {exercises !== null ? (
            <section className="curriculum-exercises mt-10">
              <Markdown
                components={curriculumComponents(exercisesOutline)}
                className="!text-[18px] [&_p]:leading-[1.65] [&_li]:leading-[1.65]"
              >{`## Exercises\n\n${exercises}`}</Markdown>
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
