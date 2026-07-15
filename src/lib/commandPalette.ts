// Published contract for the global Command Palette (myhub_plan.md Part A
// §A.2: "no dedicated table — a runtime, in-memory registry"). Same spirit as
// events.ts: a plain module-level singleton, not Zustand state — nothing here
// needs to trigger a re-render when the registry's *shape* changes, only when
// the palette's open/query state changes (that's useCommandPaletteStore.ts).
//
// See docs/handoff/command-palette.md for what's left for Codex: the Cmd+K
// modal, keyboard nav, and each module's own "register my commands" call site.

export interface CommandEntry {
  id: string;
  label: string;
  keywords: string[];
  action: () => void;
}

type RegisteredEntry = Omit<CommandEntry, "id"> & { id: string };

const registry = new Map<string, CommandEntry>();

// Ids are namespaced per module (`${moduleId}.${id}`) so two modules can
// never collide on a shared name like "refresh" — this collision guard is
// the one genuinely correctness-critical piece of the registry.
export function register(moduleId: string, entries: RegisteredEntry[]): void {
  for (const entry of entries) {
    const namespacedId = `${moduleId}.${entry.id}`;
    if (registry.has(namespacedId)) {
      throw new Error(
        `Command palette: "${namespacedId}" is already registered.`,
      );
    }
    registry.set(namespacedId, { ...entry, id: namespacedId });
  }
}

// Called on unmount — removes every entry namespaced to this module, so a
// module that registers on mount and unregisters on unmount can re-register
// freely across remounts without tripping the collision guard above.
export function unregister(moduleId: string): void {
  const prefix = `${moduleId}.`;
  for (const id of registry.keys()) {
    if (id.startsWith(prefix)) registry.delete(id);
  }
}

// Pure ranking, no state: exact label match first, then label-substring, then
// keyword-substring. An empty query returns the full registry in
// registration order rather than nothing, so opening the palette with no
// input shows every available command.
export function searchCommands(query: string): CommandEntry[] {
  const all = [...registry.values()];
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return all;

  const exact: CommandEntry[] = [];
  const labelMatch: CommandEntry[] = [];
  const keywordMatch: CommandEntry[] = [];

  for (const entry of all) {
    const label = entry.label.toLowerCase();
    if (label === trimmed) {
      exact.push(entry);
    } else if (label.includes(trimmed)) {
      labelMatch.push(entry);
    } else if (entry.keywords.some((k) => k.toLowerCase().includes(trimmed))) {
      keywordMatch.push(entry);
    }
  }

  return [...exact, ...labelMatch, ...keywordMatch];
}
