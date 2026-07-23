"use client";

import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { Bold, Heading2, Link2, List, NotebookPen, Plus } from "lucide-react";
import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Badge } from "@/src/components/ui/Badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { hueFor } from "@/src/components/moduleHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";
import { useNoteStore } from "@/src/modules/knowledgeBase/useNoteStore";

type MarkdownTool = {
  label: string;
  prefix: string;
  suffix?: string;
  icon: typeof Bold;
};

const MARKDOWN_TOOLS: MarkdownTool[] = [
  { label: "Heading", prefix: "## ", icon: Heading2 },
  { label: "Bold", prefix: "**", suffix: "**", icon: Bold },
  { label: "Bulleted list", prefix: "- ", icon: List },
  { label: "Link", prefix: "[", suffix: "](https://)", icon: Link2 },
];

const INDENT = "  ";

function computeIndent(
  current: string,
  selectionStart: number,
  selectionEnd: number,
  dedent: boolean,
): { next: string; start: number; end: number } {
  if (selectionStart === selectionEnd && !dedent) {
    const next = `${current.slice(0, selectionStart)}${INDENT}${current.slice(selectionEnd)}`;
    const cursor = selectionStart + INDENT.length;
    return { next, start: cursor, end: cursor };
  }

  const lineStart = current.lastIndexOf("\n", selectionStart - 1) + 1;
  const nextNewline = current.indexOf(
    "\n",
    Math.max(selectionEnd - 1, lineStart),
  );
  const lineEnd = nextNewline === -1 ? current.length : nextNewline;

  const lines = current.slice(lineStart, lineEnd).split("\n");
  let firstLineDelta = 0;
  const nextLines = lines.map((line, index) => {
    if (dedent) {
      const match = /^ {1,2}/.exec(line);
      if (!match) return line;
      if (index === 0) firstLineDelta = -match[0].length;
      return line.slice(match[0].length);
    }
    if (index === 0) firstLineDelta = INDENT.length;
    return `${INDENT}${line}`;
  });

  const nextBlock = nextLines.join("\n");
  const next = `${current.slice(0, lineStart)}${nextBlock}${current.slice(lineEnd)}`;

  return {
    next,
    start: Math.max(lineStart, selectionStart + firstLineDelta),
    end: lineStart + nextBlock.length,
  };
}

export function KnowledgeBasePage() {
  const store = useNoteStore();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const selected = store.notes.find((note) => note.id === selectedId) ?? null;
  const selectedLinks = selectedId ? (store.links[selectedId] ?? []) : [];
  const query = linkSearch.trim().toLowerCase();
  const linkedIds = new Set(selectedLinks.map((link) => link.noteId));
  const linkCandidates = store.notes.filter(
    (note) =>
      query === "" ||
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query),
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
      {
        id: "focus-notes",
        label: "Browse notes",
        keywords: ["note", "knowledge", "list", "browse"],
        action: () =>
          document
            .getElementById("notes-list-heading")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    ]);
    registerShortcuts("knowledge-base", [
      {
        combo: "n n",
        commandId: "knowledge-base.new-note",
        description: "Create a note",
      },
      {
        combo: "b n",
        commandId: "knowledge-base.focus-notes",
        description: "Browse notes",
      },
    ]);
    return () => {
      unregisterShortcuts("knowledge-base");
      unregister("knowledge-base");
    };
  }, [fetchNotes]);

  useEffect(() => {
    if (!selectedId) return;
    void fetchLinksForNote(selectedId);
  }, [selectedId, fetchLinksForNote]);

  useEffect(() => {
    if (!pendingSelection.current || !bodyRef.current) return;
    const { start, end } = pendingSelection.current;
    bodyRef.current.setSelectionRange(start, end);
    pendingSelection.current = null;
  }, [body]);

  function handleBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Tab") return;

    event.preventDefault();
    const { selectionStart, selectionEnd } = event.currentTarget;
    const { next, start, end } = computeIndent(
      body,
      selectionStart,
      selectionEnd,
      event.shiftKey,
    );
    pendingSelection.current = { start, end };
    setBody(next);
  }

  function resetLinkPicker() {
    setLinkPickerOpen(false);
    setLinkSearch("");
  }

  function startNewNote() {
    setSelectedId(null);
    setTitle("");
    setBody("");
    resetLinkPicker();
    requestAnimationFrame(() =>
      document.getElementById("new-note-title")?.focus(),
    );
  }

  function selectNote(id: string) {
    const note = store.notes.find((item) => item.id === id);
    setSelectedId(id);
    setTitle(note?.title ?? "");
    setBody(note?.body ?? "");
    resetLinkPicker();
  }

  function applyMarkdown(prefix: string, suffix = "") {
    const textarea = bodyRef.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const selection = body.slice(start, end);
    const next = `${body.slice(0, start)}${prefix}${selection}${suffix}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      const cursor = selection
        ? start + prefix.length + selection.length + suffix.length
        : start + prefix.length;
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
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
    if (!selectedId || noteId === selectedId) return;
    await store.createLink(selectedId, noteId);
    await Promise.all([
      store.fetchLinksForNote(selectedId),
      store.fetchLinksForNote(noteId),
    ]);
    resetLinkPicker();
  }

  async function unlinkNote(linkId: string, otherNoteId: string) {
    if (!selectedId) return;
    await store.deleteLink(selectedId, linkId);
    await store.fetchLinksForNote(otherNoteId);
  }

  return (
    <AppShell activeHref="/notes" title="Knowledge Base">
      <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
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
          icon={NotebookPen}
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <section aria-labelledby="notes-list-heading" className="panel p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold" id="notes-list-heading">
                Your notes
              </h2>
              <Badge tone="neutral">{store.notes.length}</Badge>
            </div>
            {store.notes.length === 0 ? (
              <EmptyState
                action={
                  <button onClick={startNewNote} type="button">
                    Write your first note
                  </button>
                }
                description="Capture one useful idea now, then link it to the next thing you learn."
                icon={NotebookPen}
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

          <div className="grid content-start gap-6">
            <section
              aria-labelledby="note-editor-heading"
              className="panel p-5"
            >
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
                <div className="grid gap-1.5">
                  <span className="text-sm font-medium text-body">Body</span>
                  <div
                    aria-label="Markdown formatting"
                    className="flex flex-wrap gap-1 rounded-t-md border border-b-0 border-input bg-surface-subtle p-1"
                    role="toolbar"
                  >
                    {MARKDOWN_TOOLS.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          aria-label={tool.label}
                          className="rounded p-2 text-muted hover:bg-surface hover:text-foreground"
                          key={tool.label}
                          onClick={() =>
                            applyMarkdown(tool.prefix, tool.suffix)
                          }
                          title={tool.label}
                          type="button"
                        >
                          <Icon aria-hidden="true" className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    aria-label="Body"
                    className="min-h-64 w-full rounded-b-md border border-input bg-surface px-3 py-2 font-mono text-sm leading-relaxed text-foreground"
                    onChange={(event) => setBody(event.target.value)}
                    onKeyDown={handleBodyKeyDown}
                    placeholder="Write in Markdown: ideas, decisions, references..."
                    ref={bodyRef}
                    value={body}
                  />
                </div>
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
            </section>

            {selected ? (
              <section
                aria-labelledby="note-links-heading"
                className="panel p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2
                      className="text-lg font-semibold"
                      id="note-links-heading"
                    >
                      Backlinks &amp; connections
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Links are visible from both connected notes.
                    </p>
                  </div>
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-input bg-surface px-3 text-sm font-medium hover:bg-surface-subtle"
                    onClick={() => setLinkPickerOpen(true)}
                    type="button"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Link note
                  </button>
                </div>
                {selectedLinks.length > 0 ? (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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
                  <EmptyState
                    action={
                      <button
                        onClick={() => setLinkPickerOpen(true)}
                        type="button"
                      >
                        Link another note
                      </button>
                    }
                    description="Connect this note to another idea to build context in both directions."
                    icon={Link2}
                    title="No backlinks yet"
                  />
                )}
              </section>
            ) : null}
          </div>
        </div>

        <Dialog
          onOpenChange={(open) => {
            setLinkPickerOpen(open);
            if (!open) setLinkSearch("");
          }}
          open={linkPickerOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link another note</DialogTitle>
              <DialogDescription>
                Search your knowledge base. The connection will appear on both
                notes.
              </DialogDescription>
            </DialogHeader>
            <label className="grid gap-1.5 text-sm font-medium text-body">
              Search notes
              <input
                autoFocus
                className="h-10 rounded-md border border-input bg-surface px-3 text-foreground"
                onChange={(event) => setLinkSearch(event.target.value)}
                placeholder="Search titles and bodies"
                value={linkSearch}
              />
            </label>
            <ul className="max-h-72 overflow-y-auto rounded-md border border-border">
              {linkCandidates.length > 0 ? (
                linkCandidates.map((note) => {
                  const isCurrent = note.id === selectedId;
                  const isLinked = linkedIds.has(note.id);
                  return (
                    <li
                      className="border-b border-border last:border-b-0"
                      key={note.id}
                    >
                      <button
                        className="w-full px-3 py-3 text-left text-sm hover:bg-surface-subtle disabled:cursor-not-allowed disabled:text-muted"
                        disabled={isCurrent || isLinked}
                        onClick={() => void linkNote(note.id)}
                        type="button"
                      >
                        <span className="block font-medium">{note.title}</span>
                        <span className="mt-1 block line-clamp-1 text-xs text-muted">
                          {isCurrent
                            ? "Current note"
                            : isLinked
                              ? "Already linked"
                              : note.body || "No body yet"}
                        </span>
                      </button>
                    </li>
                  );
                })
              ) : (
                <li className="px-3 py-6 text-center text-sm text-muted">
                  No matching notes.
                </li>
              )}
            </ul>
          </DialogContent>
        </Dialog>
      </section>
    </AppShell>
  );
}
