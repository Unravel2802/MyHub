"use client";

import { useEffect, useRef, useState } from "react";
import { ChapterToc } from "./ChapterToc";
import type { OutlineEntry } from "../chapterStructure";

// Scroll updates stay in this small subtree; the article and Markdown are siblings.
export function ReadingProgress({
  outline,
  minutes,
}: {
  outline: OutlineEntry[];
  minutes: number | null;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const article = root.current?.closest("article");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const headings = outline
        .map((entry) =>
          article.querySelector<HTMLElement>(`[id="${entry.id}"]`),
        )
        .filter((heading) => heading !== null);
      setActiveId(
        headings
          .filter((heading) => heading.getBoundingClientRect().top <= 141)
          .at(-1)?.id ?? null,
      );
      const distance = rect.height - window.innerHeight;
      setProgress(
        distance <= 0 ? 1 : Math.min(1, Math.max(0, -rect.top / distance)),
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    if (root.current?.closest("article"))
      observer.observe(root.current.closest("article")!);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [outline]);
  const left = minutes === null ? null : Math.round(minutes * (1 - progress));
  return (
    <div ref={root} className="contents">
      <div
        data-reading-progress
        className="fixed inset-x-0 top-0 z-20 h-[3px] origin-left bg-[var(--track)] motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
        aria-hidden
      />
      <details className="-mt-10 min-w-0 rounded-xl border border-border bg-surface p-4 min-[1060px]:hidden">
        <summary className="cursor-pointer font-mono text-xs text-muted">
          In this chapter
        </summary>
        <ChapterToc outline={outline} activeId={activeId} />
        {left !== null && (
          <p className="mt-4 font-mono text-xs text-muted">
            {left === 0 ? "You're at the end" : `${left} min left`}
          </p>
        )}
      </details>
      <aside className="hidden min-w-0 min-[1060px]:col-start-2 min-[1060px]:row-start-1 min-[1060px]:row-span-2 min-[1060px]:block">
        <div className="sticky top-8">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">
            In this chapter
          </p>
          <ChapterToc outline={outline} activeId={activeId} />
          {left !== null && (
            <p className="mt-6 font-mono text-xs text-muted">
              {left === 0 ? "You're at the end" : `${left} min left`}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
