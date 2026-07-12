import { type FormEvent, useMemo, useState } from "react";
import type { UpsertStoryInput } from "@/src/modules/prep/PrepRepository";
import type { BehavioralStory } from "@/src/modules/prep/types";

type BehavioralStoriesProps = {
  stories: BehavioralStory[];
  disabled: boolean;
  pendingIds: ReadonlySet<string>;
  onCreate: (input: UpsertStoryInput) => Promise<void>;
  onUpdate: (id: string, input: Partial<UpsertStoryInput>) => Promise<void>;
  onDelete: (id: string, title: string) => void;
};

export function BehavioralStories({
  stories,
  disabled,
  pendingIds,
  onCreate,
  onUpdate,
  onDelete,
}: BehavioralStoriesProps) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [conciseVersion, setConciseVersion] = useState("");
  const [extendedVersion, setExtendedVersion] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const grouped = new Map<string, BehavioralStory[]>();
    for (const story of stories) {
      const key = story.theme?.trim() || "Uncategorized";
      grouped.set(key, [...(grouped.get(key) ?? []), story]);
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stories]);

  function reset() {
    setTitle("");
    setTheme("");
    setConciseVersion("");
    setExtendedVersion("");
    setEditingId(null);
  }

  function startEdit(story: BehavioralStory) {
    setEditingId(story.id);
    setTitle(story.title);
    setTheme(story.theme ?? "");
    setConciseVersion(story.conciseVersion ?? "");
    setExtendedVersion(story.extendedVersion ?? "");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = {
      title: title.trim(),
      theme: theme.trim() || null,
      conciseVersion: conciseVersion.trim() || null,
      extendedVersion: extendedVersion.trim() || null,
    };
    if (editingId) await onUpdate(editingId, input);
    else await onCreate(input);
    reset();
  }

  const fieldClass =
    "rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-subtle focus:border-accent disabled:bg-surface-subtle";

  return (
    <section aria-labelledby="stories-heading" className="grid gap-4">
      <form
        className="grid gap-3 rounded-lg border border-border bg-surface p-5"
        onSubmit={handleSubmit}
      >
        <div>
          <h2
            className="text-lg font-semibold text-foreground"
            id="stories-heading"
          >
            Behavioral stories
          </h2>
          <p className="mt-1 text-sm text-muted">
            Keep a concise answer and a deeper version ready.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-body">
            Title
            <input
              className={fieldClass}
              disabled={disabled}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Led a risky migration"
              required
              value={title}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-body">
            Theme
            <input
              className={fieldClass}
              disabled={disabled}
              onChange={(event) => setTheme(event.target.value)}
              placeholder="Technical leadership"
              value={theme}
            />
          </label>
        </div>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Concise version
          <textarea
            className={`${fieldClass} min-h-20`}
            disabled={disabled}
            onChange={(event) => setConciseVersion(event.target.value)}
            value={conciseVersion}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-body">
          Extended version
          <textarea
            className={`${fieldClass} min-h-28`}
            disabled={disabled}
            onChange={(event) => setExtendedVersion(event.target.value)}
            value={extendedVersion}
          />
        </label>
        <div className="flex gap-2">
          <button
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
            disabled={disabled || !title.trim()}
            type="submit"
          >
            {editingId ? "Save story" : "Add story"}
          </button>
          {editingId ? (
            <button
              className="h-10 rounded-md border border-input px-4 text-sm text-body"
              onClick={reset}
              type="button"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      {groups.map(([groupTheme, groupStories]) => (
        <div
          className="rounded-lg border border-border bg-surface p-5"
          key={groupTheme}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            {groupTheme}
          </h3>
          <ul className="mt-3 grid gap-3">
            {groupStories.map((story) => (
              <li className="rounded-md bg-surface-subtle p-4" key={story.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">
                      {story.title}
                    </p>
                    {story.conciseVersion ? (
                      <p className="mt-2 text-sm text-body">
                        {story.conciseVersion}
                      </p>
                    ) : null}
                    {story.extendedVersion ? (
                      <details className="mt-2 text-sm text-muted">
                        <summary className="cursor-pointer">
                          Extended version
                        </summary>
                        <p className="mt-2 whitespace-pre-wrap text-body">
                          {story.extendedVersion}
                        </p>
                      </details>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="rounded-md border border-input px-3 py-1.5 text-xs text-body"
                      disabled={pendingIds.has(story.id)}
                      onClick={() => startEdit(story)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-danger-border px-3 py-1.5 text-xs text-danger hover:bg-danger-surface"
                      disabled={pendingIds.has(story.id)}
                      onClick={() => onDelete(story.id, story.title)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
