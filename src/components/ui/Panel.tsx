import type { ReactNode } from "react";

interface PanelProps {
  title?: ReactNode;
  // The uppercase, wide-tracked overline above the title. The workhorse for
  // breaking up dense data panels.
  overline?: ReactNode;
  description?: ReactNode;
  // Rendered top-right, level with the title: a filter, a count, an action.
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

// The standard section container. Every page was hand-rolling
// `rounded-lg border border-border bg-surface p-5`, which is how spacing drifted
// (p-4 / p-5 / px-3 py-1.5 with no system).
//
// Depth is a border plus a background STEP, not a shadow — see the visual spec's
// "glass and border". Shadows are reserved for things that genuinely float.
export function Panel({
  title,
  overline,
  description,
  aside,
  children,
  className = "",
}: PanelProps) {
  return (
    <section
      className={`rounded-lg border border-border bg-surface p-5 ${className}`}
    >
      {title || overline || description || aside ? (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {overline ? (
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                {overline}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {aside ? <div className="shrink-0">{aside}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
