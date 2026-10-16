import type { OutlineEntry } from "../chapterStructure";

export function ChapterToc({
  outline,
  activeId,
}: {
  outline: OutlineEntry[];
  activeId: string | null;
}) {
  return (
    <nav aria-label="Chapter contents" className="mt-3 border-l border-border">
      {outline.map((entry) => (
        <a
          aria-current={activeId === entry.id ? "location" : undefined}
          className={`block border-l-2 py-1 pl-3 font-sans text-sm ${activeId === entry.id ? "border-[var(--track)] text-[var(--track)]" : "border-transparent text-muted hover:text-[var(--track)]"}`}
          href={`#${entry.id}`}
          key={entry.id}
        >
          {entry.text}
        </a>
      ))}
    </nav>
  );
}
