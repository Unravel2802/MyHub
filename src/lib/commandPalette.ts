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

// Direct lookup by namespaced id — the shortcut layer (src/lib/shortcuts.ts)
// resolves a key combo to a commandId and invokes getCommand(id)?.action(),
// reusing this registry rather than duplicating the command list.
export function getCommand(id: string): CommandEntry | undefined {
  return registry.get(id);
}

// Fuzzy subsequence score: are all chars of `q` present in `text` in order?
// Returns a score where LOWER is a tighter match (matched chars packed close
// together and near the start), or null if `q` is not a subsequence of `text`.
// Used only as the last-resort tier below, so precise substring matches always
// outrank fuzzy ones.
function fuzzyScore(text: string, q: string): number | null {
  let from = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  for (const ch of q) {
    const found = text.indexOf(ch, from);
    if (found === -1) return null;
    if (firstIdx === -1) firstIdx = found;
    lastIdx = found;
    from = found + 1;
  }
  // Span of the match dominates; ties broken by how early it starts.
  return (lastIdx - firstIdx) * 100 + firstIdx;
}

// Pure ranking, no state. Four tiers, in order: exact label match,
// label-substring, keyword-substring, then a fuzzy-subsequence fallback (so
// "ntsk" still surfaces "New task" when nothing matched as a substring). An
// empty query returns the full registry in registration order rather than
// nothing, so opening the palette with no input shows every command. Within
// the first three tiers, registration order is preserved; the fuzzy tier is
// sorted by score (stable within equal scores).
export function searchCommands(query: string): CommandEntry[] {
  const all = [...registry.values()];
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") return all;

  const exact: CommandEntry[] = [];
  const labelMatch: CommandEntry[] = [];
  const keywordMatch: CommandEntry[] = [];
  const fuzzy: { entry: CommandEntry; score: number }[] = [];

  for (const entry of all) {
    const label = entry.label.toLowerCase();
    if (label === trimmed) {
      exact.push(entry);
    } else if (label.includes(trimmed)) {
      labelMatch.push(entry);
    } else if (entry.keywords.some((k) => k.toLowerCase().includes(trimmed))) {
      keywordMatch.push(entry);
    } else {
      // Fuzzy fallback against the label and every keyword; keep the best score.
      const haystacks = [label, ...entry.keywords.map((k) => k.toLowerCase())];
      let best: number | null = null;
      for (const h of haystacks) {
        const s = fuzzyScore(h, trimmed);
        if (s !== null && (best === null || s < best)) best = s;
      }
      if (best !== null) fuzzy.push({ entry, score: best });
    }
  }

  fuzzy.sort((a, b) => a.score - b.score);

  return [
    ...exact,
    ...labelMatch,
    ...keywordMatch,
    ...fuzzy.map((f) => f.entry),
  ];
}
