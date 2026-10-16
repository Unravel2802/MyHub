"use client";

import { useRef } from "react";
import { parseFigure } from "../figureLines";
import { CopyButton } from "./CopyButton";

export function Figure({ raw, caption }: { raw: string; caption: string }) {
  const parsed = parseFigure(raw);
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <figure
      className="my-6 [counter-increment:fig] min-w-0 overflow-hidden rounded-xl border border-border"
      style={
        {
          "--grid": "color-mix(in oklab, var(--border) 55%, transparent)",
        } as React.CSSProperties
      }
    >
      <figcaption className="flex items-center gap-3 border-b border-border px-4 py-2 font-mono text-[11px] uppercase tracking-wider">
        <span className="font-semibold text-[var(--track)] after:content-[counter(fig)]">
          FIG{" "}
        </span>
        <span className="min-w-0 flex-1 truncate text-muted">
          {parsed.title ?? caption}
        </span>
        <CopyButton raw={raw} contentRef={contentRef} />
      </figcaption>
      <div
        ref={contentRef}
        className="overflow-x-auto bg-[linear-gradient(var(--grid)_1px,transparent_1px),linear-gradient(90deg,var(--grid)_1px,transparent_1px)] bg-[size:22px_22px] p-4 font-mono text-[13.5px] leading-[1.7]"
      >
        {parsed.lines.map((line, i) => (
          <div className="whitespace-pre" key={i}>
            {line.every((segment) => !segment.text) ? "\u00a0" : null}
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
