import type { PrepEntry } from "@/src/modules/prep/types";

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
};

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
        <p className="mt-3 text-sm text-muted">No prep sessions logged yet.</p>
      ) : (
        <ul className="mt-4 grid gap-3">
          {entries.map((entry) => (
            <li
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
              key={entry.id}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-foreground">
                    {entry.topic ?? labels[entry.entryType]}
                  </p>
                  <span className="rounded-full border border-accent px-2 py-0.5 text-xs text-accent-strong">
                    {labels[entry.entryType]}
                  </span>
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
                  <p className="mt-2 line-clamp-2 text-sm text-body">
                    {entry.notes}
                  </p>
                ) : null}
              </div>
              <button
                className="rounded-md border border-danger-border px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-surface disabled:cursor-not-allowed disabled:text-danger-subtle"
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
