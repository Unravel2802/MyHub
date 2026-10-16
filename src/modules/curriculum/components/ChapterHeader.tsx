import Link from "next/link";
import { topicNeighbours, trackById } from "../curriculumCatalog";
import { topicState } from "../curriculumProgress";
import type { Topic, Lesson, CurriculumIndex } from "../types";

export function ChapterHeader({
  topic,
  lesson,
  index,
  completedKeys,
}: {
  topic: Topic;
  lesson: Lesson;
  index: CurriculumIndex;
  completedKeys: ReadonlySet<string>;
}) {
  const track = trackById(topic.trackId);
  const neighbours = topicNeighbours(topic.id);
  return (
    <div className="min-w-0 min-[1060px]:col-start-1 min-[1060px]:row-start-1">
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
          <span>{topic.tier[0].toUpperCase() + topic.tier.slice(1)}</span>
          {lesson.meta.minutes ? <span>{lesson.meta.minutes} min</span> : null}
        </div>
        <h2 className="mt-5 text-[clamp(34px,5.4vw,52px)] font-[650] leading-[1.05] tracking-tight text-balance text-foreground">
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
                        <Link
                          className="text-foreground hover:text-[var(--track)]"
                          href={
                            index[entry.id]?.[0]
                              ? `/curriculum/${entry.id}/${index[entry.id][0].id}`
                              : `/curriculum?topic=${entry.id}`
                          }
                        >
                          {entry.label}
                        </Link>
                        {label === "Builds on" &&
                        topicState(entry, index, completedKeys).progress ===
                          1 ? (
                          <span className="ml-2 text-success">
                            <span aria-hidden>✓ </span>read
                          </span>
                        ) : null}
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
    </div>
  );
}
