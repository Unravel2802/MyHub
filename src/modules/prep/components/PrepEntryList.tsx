import { Badge } from "@/src/components/ui/Badge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import type { PrepEntry } from "@/src/modules/prep/types";
import { PREP_TYPE_HUES } from "@/src/modules/prep/prepTypeHues";

type PrepEntryListProps = {
  entries: PrepEntry[];
  pendingIds: ReadonlySet<string>;
  onDelete: (id: string, topic: string) => void;
};

const labels = {
  algorithm: "Algorithm",
  system_design: "System design",
  ml_system_design: "ML system design",
  behavioral: "Behavioral",
  mock_interview: "Mock interview",
  resume_deep_dive: "Resume deep-dive",
};

const subtypeLabels = {
  coding: "Coding",
  system_design: "System design",
  ml_system_design: "ML system design",
} as const;

export function PrepEntryList({
  entries,
  pendingIds,
  onDelete,
}: PrepEntryListProps) {
  return (
    <section
      aria-labelledby="recent-prep-heading"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2
        className="text-lg font-semibold text-foreground"
        id="recent-prep-heading"
      >
        Recent sessions
      </h2>
      {entries.length === 0 ? (
        <EmptyState
          description="Your first rep starts the December count. Log one above to begin."
          title="Start the December count"
        />
      ) : (
        <ul className="mt-4 grid max-h-[36rem] gap-3 overflow-y-auto rounded-md border border-border">
          {entries.map((entry) => (
            <li
              className="relative rounded-md border border-border p-3"
              key={entry.id}
            >
              <div className="min-w-0 pr-20">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {entry.topic ?? labels[entry.entryType]}
                  </p>
                  <Badge hue={PREP_TYPE_HUES[entry.entryType]}>
                    {labels[entry.entryType]}
                  </Badge>
                  {entry.entryType === "mock_interview" ? (
                    <Badge tone="neutral">
                      {entry.mockSubtype
                        ? subtypeLabels[entry.mockSubtype]
                        : "Unclassified"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {entry.date}
                  {entry.durationMin !== null
                    ? ` · ${entry.durationMin} min`
                    : ""}
                  {entry.outcome
                    ? ` · ${entry.outcome.replace("_", " ")}`
                    : " · unjudged"}
                </p>
                {entry.notes ? (
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-body">
                    {entry.notes}
                  </p>
                ) : null}
              </div>
              <button
                className="absolute right-3 top-3 rounded-md border border-danger-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-surface disabled:cursor-not-allowed disabled:text-danger-subtle"
                disabled={pendingIds.has(entry.id)}
                onClick={() =>
                  onDelete(entry.id, entry.topic ?? labels[entry.entryType])
                }
                type="button"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
