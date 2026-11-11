import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { Target } from "lucide-react";
import type { CalloutKind } from "../callout";

// Strip the detected prefix from the rendered first paragraph without flattening
// its strong/code/link children or reparsing the content as Markdown.
function withoutPrefix(children: ReactNode, count: number): ReactNode {
  let remaining = count;
  function visit(child: ReactNode): ReactNode {
    if (remaining === 0) return child;
    if (typeof child === "string") {
      const text = child.slice(remaining);
      remaining = Math.max(0, remaining - child.length);
      return text;
    }
    if (isValidElement<{ children?: ReactNode }>(child))
      return cloneElement(child, {}, Children.map(child.props.children, visit));
    return child;
  }
  return Children.map(children, visit);
}

const labels = {
  KEY: "Key point",
  PITFALL: "Pitfall",
  INTERVIEW: "In the interview",
  CHECK: "Check yourself",
  EXERCISE: "Exercise",
  WHY: "Why this matters",
  GOALS: "By the end you'll be able to",
};
const colors = {
  KEY: "border-[var(--track-border)] bg-[var(--track-surface)]",
  PITFALL: "border-[var(--hue-amber-border)] bg-[var(--hue-amber-surface)]",
  INTERVIEW: "border-[var(--hue-violet-border)] bg-[var(--hue-violet-surface)]",
  CHECK: "border-[var(--track-border)] bg-[var(--track-surface)]",
  EXERCISE: "border-[var(--track-border)] bg-[var(--track-surface)]",
  WHY: "border-[var(--track-border)] bg-[var(--track-surface)]",
  GOALS: "border-[var(--track-border)] bg-[var(--track-surface)]",
};
const labelColors = {
  KEY: "text-[var(--track)]",
  PITFALL: "text-[var(--hue-amber)]",
  INTERVIEW: "text-[var(--hue-violet)]",
  CHECK: "text-[var(--track)]",
  EXERCISE: "text-[var(--track)]",
  WHY: "text-[var(--track)]",
  GOALS: "text-[var(--track)]",
};

function goalList(block: ReactNode): ReactNode {
  if (
    !isValidElement<{
      children?: ReactNode;
      className?: string;
      node?: { tagName?: string };
    }>(block) ||
    block.props.node?.tagName !== "ul"
  )
    return block;
  return cloneElement(
    block,
    { className: "mt-3 list-none space-y-2 pl-0 first:mt-0" },
    Children.map(block.props.children, (item) =>
      isValidElement<{
        children?: ReactNode;
        className?: string;
        node?: { tagName?: string };
      }>(item) && item.props.node?.tagName === "li"
        ? cloneElement(
            item,
            { className: "flex items-start gap-2" },
            <>
              <Target
                aria-hidden
                className="mt-1 size-4 shrink-0 text-[var(--track)]"
              />
              <span>{item.props.children}</span>
            </>,
          )
        : item,
    ),
  );
}

export function CurriculumQuote({
  children,
  marker,
  keyRule,
}: {
  children: ReactNode;
  marker: { kind: CalloutKind; prefix: string } | null;
  keyRule: boolean;
}) {
  if (!marker)
    return keyRule ? (
      <blockquote className="my-5 rounded-xl border border-[var(--track-border)] bg-[var(--track-surface)] p-5 text-body">
        <p className="mb-2 font-mono text-xs uppercase text-[var(--track)]">
          Key rule
        </p>
        {children}
      </blockquote>
    ) : (
      <blockquote className="my-5 border-l-2 border-[var(--track-border)] pl-5 italic text-body">
        {children}
      </blockquote>
    );
  if (marker.kind === "EXERCISE")
    return (
      <blockquote className="my-5 border-l-2 border-[var(--track-border)] pl-5 italic text-body">
        {children}
      </blockquote>
    );
  const blocks = Children.toArray(children).filter(
    (child) => typeof child !== "string" || child.trim(),
  );
  const first = blocks[0];
  const question = isValidElement<{ children?: ReactNode }>(first)
    ? withoutPrefix(first.props.children, marker.prefix.length)
    : withoutPrefix(first, marker.prefix.length);
  const label = (
    <span
      className={`${marker.kind === "CHECK" ? "inline" : "block"} font-mono text-xs uppercase tracking-wider ${labelColors[marker.kind]}`}
    >
      {labels[marker.kind]}
    </span>
  );
  if (marker.kind === "CHECK")
    return (
      <details
        className={`my-5 rounded-xl border p-5 text-body ${colors.CHECK}`}
      >
        <summary className="cursor-pointer marker:text-[var(--track)]">
          {label}
          <span className="mt-2 block">{question}</span>
        </summary>
        <div className="mt-4 border-t border-[var(--track-border)] pt-4">
          {blocks.slice(1)}
        </div>
      </details>
    );
  if (marker.kind === "WHY")
    return (
      <aside
        aria-label={labels.WHY}
        className={`my-5 rounded-xl border p-5 text-body ${colors.WHY}`}
      >
        {label}
        <p className="mt-2 text-base leading-relaxed">{question}</p>
        {blocks.slice(1)}
      </aside>
    );
  if (marker.kind === "GOALS")
    return (
      <aside
        aria-label={labels.GOALS}
        className={`my-5 rounded-xl border p-5 text-body ${colors.GOALS}`}
      >
        {label}
        <div className="mt-2">{blocks.slice(1).map(goalList)}</div>
      </aside>
    );
  return (
    <aside
      aria-label={labels[marker.kind]}
      className={`my-5 rounded-xl border p-5 text-body ${colors[marker.kind]}`}
    >
      {label}
      <p className="mt-2">{question}</p>
      {blocks.slice(1)}
    </aside>
  );
}
