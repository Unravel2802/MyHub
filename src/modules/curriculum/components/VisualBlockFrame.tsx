import { useRef, type ReactNode } from "react";
import { CopyButton } from "./CopyButton";

// Chart/widget frames deliberately don't increment the text figures' FIG counter.
export function VisualBlockFrame({
  label,
  title,
  caption,
  raw,
  children,
}: {
  label: string;
  title: string;
  caption?: string | null;
  raw?: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <section
      aria-label={title}
      className="my-6 min-w-0 overflow-hidden rounded-xl border border-border bg-surface font-sans"
    >
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 font-mono text-[11px]">
        <span className="font-semibold uppercase tracking-wider text-[var(--track)]">
          {label}
        </span>
        <span className="min-w-0 flex-1 text-body">{title}</span>
        {raw !== undefined && <CopyButton raw={raw} contentRef={contentRef} />}
      </div>
      <div ref={contentRef} className="min-w-0">
        {children}
      </div>
      {caption && (
        <p className="border-t border-border px-4 py-3 text-sm text-muted">
          {caption}
        </p>
      )}
    </section>
  );
}
