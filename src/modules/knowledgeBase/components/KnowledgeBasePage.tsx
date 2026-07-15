"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Badge } from "@/src/components/ui/Badge";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { useNoteStore } from "@/src/modules/knowledgeBase/useNoteStore";

export function KnowledgeBasePage() {
  const store = useNoteStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const selected = store.notes.find((note) => note.id === selectedId) ?? null;
  const selectedLinks = selectedId ? (store.links[selectedId] ?? []) : [];
  const query = linkSearch.trim().toLowerCase();
  const linkedIds = new Set(selectedLinks.map((link) => link.noteId));
  const linkCandidates = store.notes.filter(
    (note) =>
      note.id !== selectedId &&
      !linkedIds.has(note.id) &&
      (query === "" ||
        note.title.toLowerCase().includes(query) ||
        note.body.toLowerCase().includes(query)),
  );
  const { fetchNotes, fetchLinksForNote } = store;

  useEffect(() => {
    void fetchNotes();
    register("knowledge-base", [
      {
        id: "new-note",
        label: "New note",
        keywords: ["note", "knowledge", "create"],
        action: () => document.getElementById("new-note-button")?.click(),
      },
    ]);
    return () => unregister("knowledge-base");
  }, [fetchNotes]);

  useEffect(() => {
    if (!selectedId) return;
    void fetchLinksForNote(selectedId);
  }, [selectedId, fetchLinksForNote]);

  function startNewNote() {
    setSelectedId(null);
    setTitle("");
    setBody("");
    setLinkSearch("");
    requestAnimationFrame(() =>
      document.getElementById("new-note-title")?.focus(),
    );
  }

  function selectNote(id: string) {
    const note = store.notes.find((item) => item.id === id);
    setSelectedId(id);
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    setLinkSearch("");
  }

  async function saveNote() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    if (selectedId) {
      await store.updateNote(selectedId, { title: trimmedTitle, body });
    } else {
      await store.createNote({ title: trimmedTitle, body });
      await store.fetchNotes();
    }
  }

  async function linkNote(noteId: string) {
    if (!selectedId) return;
    await store.createLink(selectedId, noteId);
    await Promise.all([
      store.fetchLinksForNote(selectedId),
      store.fetchLinksForNote(noteId),
    ]);
    setLinkSearch("");
  }

  async function unlinkNote(linkId: string, otherNoteId: string) {
    if (!selectedId) return;
    await store.deleteLink(selectedId, linkId);
    await store.fetchLinksForNote(otherNoteId);
  }

  return (
    <AppShell activeHref="/notes" title="Knowledge Base">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          actions={
            <button
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              id="new-note-button"
              onClick={startNewNote}
              type="button"
            >
              New note
            </button>
          }
          bleed
          className="mb-6"
          description="Keep the ideas, decisions, and connections worth finding again."
          eyebrow="Knowledge base"
          hue={hueFor("/notes")}
          title="Notes that connect"
        />

        {store.error ? (
          <p
            aria-live="assertive"
            className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {store.error}
          </p>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <section aria-labelledby="notes-list-heading" className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold" id="notes-list-heading">
                Your notes
              </h2>
              <Badge tone="neutral">{store.notes.length}</Badge>
            </div>
            {store.notes.length === 0 ? (
              <EmptyState
                description="Capture one useful idea now, then link it to the next thing you learn."
                action={
                  <button onClick={startNewNote} type="button">
                    Write your first note
                  </button>
                }
                title="Start your knowledge base"
              />
            ) : (
              <ul className="mt-4 grid gap-2">
                {store.notes.map((note) => (
                  <li key={note.id}>
                    <button
                      className={`w-full rounded-md border p-3 text-left transition-all duration-200 ease-in-out ${selectedId === note.id ? "border-hue-fuchsia-border bg-hue-fuchsia-surface" : "border-border bg-surface-subtle hover:border-input-hover"}`}
                      onClick={() => selectNote(note.id)}
                      type="button"
                    >
                      <p className="font-medium text-foreground">
                        {note.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">
                        {note.body || "No body yet"}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        Updated {new Date(note.updatedAt).toLocaleDateString()}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="note-editor-heading" className="panel p-5">
            <h2 className="text-lg font-semibold" id="note-editor-heading">
              {selected ? "Edit note" : "New note"}
            </h2>
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void saveNote();
              }}
            >
              <label className="grid gap-1.5 text-sm font-medium text-body">
                Title
                <input
                  className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                  id="new-note-title"
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="A useful idea"
                  value={title}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-body">
                Body
                <textarea
                  className="min-h-52 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground"
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write the idea, decision, or reference..."
                  value={body}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:bg-disabled"
                  disabled={store.isCreating || !title.trim()}
                  type="submit"
                >
                  {selected ? "Save note" : "Create note"}
                </button>
                {selected ? (
                  <button
                    className="h-10 rounded-md border border-danger-border px-4 text-sm font-medium text-danger hover:bg-danger-surface"
                    onClick={() => {
                      void store.deleteNote(selected.id);
                      startNewNote();
                    }}
                    type="button"
                  >
                    Delete note
                  </button>
                ) : null}
              </div>
            </form>

            {selected ? (
              <div className="mt-8 border-t border-border pt-5">
                <h3 className="text-sm font-semibold" id="note-links-heading">
                  Linked notes
                </h3>
                {selectedLinks.length > 0 ? (
                  <ul className="mt-3 grid gap-2">
                    {selectedLinks.map((link) => {
                      const other = store.notes.find(
                        (note) => note.id === link.noteId,
                      );
                      return (
                        <li
                          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle px-3 py-2"
                          key={link.linkId}
                        >
                          <button
                            className="truncate text-left text-sm font-medium text-hue-fuchsia hover:underline"
                            onClick={() => selectNote(link.noteId)}
                            type="button"
                          >
                            {other?.title ?? "Deleted note"}
                          </button>
                          <button
                            className="shrink-0 text-xs text-danger hover:underline"
                            onClick={() =>
                              void unlinkNote(link.linkId, link.noteId)
                            }
                            type="button"
                          >
                            Unlink
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    No links yet. Connect this note to another idea below.
                  </p>
                )}
                <label className="mt-4 grid gap-1.5 text-sm font-medium text-body">
                  Find a note to link
                  <input
                    className="h-10 rounded-md border border-input bg-surface px-3 text-sm text-foreground"
                    onChange={(event) => setLinkSearch(event.target.value)}
                    placeholder="Search titles and bodies"
                    value={linkSearch}
                  />
                </label>
                {linkSearch.trim() ? (
                  <ul className="mt-2 grid gap-2">
                    {linkCandidates.length > 0 ? (
                      linkCandidates.map((note) => (
                        <li key={note.id}>
                          <button
                            className="w-full rounded-md border border-border px-3 py-2 text-left text-sm hover:border-hue-fuchsia-border hover:bg-hue-fuchsia-surface"
                            onClick={() => void linkNote(note.id)}
                            type="button"
                          >
                            {note.title}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted">No matching notes.</li>
                    )}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </AppShell>
  );
}
