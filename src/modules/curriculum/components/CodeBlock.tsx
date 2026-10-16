"use client";
import { useRef, type ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export function CodeBlock({
  raw,
  language,
  children,
}: {
  raw: string;
  language: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLPreElement>(null);
  return (
    <div className="my-5 min-w-0 overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="font-mono text-[11px] uppercase text-muted">
          {language}
        </span>
        <CopyButton raw={raw} contentRef={contentRef} />
      </div>
      <pre
        ref={contentRef}
        className="overflow-x-auto p-4 font-mono text-sm leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
}
