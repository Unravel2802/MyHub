// Published contract for the global keyboard-shortcut layer (Wave 4 Workstream
// D item 4). Deliberately a plain module-level singleton in the same spirit as
// commandPalette.ts and events.ts — not Zustand state, since nothing needs to
// re-render when the shortcut map changes.
//
// A Shortcut maps a key combo to a commandId that ALREADY exists in the Command
// Palette registry (src/lib/commandPalette.ts). AppShell's global handler calls
// matchShortcut(event, buffer) and, on a hit, invokes
// getCommand(commandId)?.action(). This is NOT a parallel command dispatcher:
// shortcuts are just an alternate trigger for a registered command, so the two
// systems never drift.

export interface Shortcut {
  // A normalized combo, in one of two forms:
  //   - chord: modifier(s) + a key, e.g. "mod+k" ("mod" = Cmd on macOS, Ctrl
  //     elsewhere), "shift+/", or a bare key like "/".
  //   - sequence: two plain keys pressed in quick succession, e.g. "g d".
  combo: string;
  // A namespaced id in the Command Palette registry (`${moduleId}.${id}`).
  commandId: string;
  // Optional human-readable description for a future "keyboard shortcuts" help
  // overlay; listShortcuts() exposes it.
  description?: string;
}

interface RegisteredShortcut extends Shortcut {
  moduleId: string;
}

// A minimal KeyboardEvent shape so matchShortcut is unit-testable without a DOM
// event. A real KeyboardEvent is assignable to this.
export interface KeyEvent {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const shortcuts: RegisteredShortcut[] = [];

// Canonical modifier order so "shift+mod+k" and "mod+shift+k" compare equal.
// Sequences (containing a space) are lowercased but otherwise left as-is.
export function normalizeCombo(combo: string): string {
  const raw = combo.trim().toLowerCase();
  if (raw.includes(" ")) return raw.replace(/\s+/g, " ");

  const parts = raw.split("+");
  const key = parts.pop() ?? "";
  const mods = new Set(parts);
  const ordered: string[] = [];
  if (mods.has("mod")) ordered.push("mod");
  if (mods.has("alt")) ordered.push("alt");
  if (mods.has("shift")) ordered.push("shift");
  return [...ordered, key].join("+");
}

// The combo a keyboard event represents, in the same canonical form as
// normalizeCombo. meta and ctrl both fold into "mod" so a single registration
// works cross-platform.
export function eventCombo(event: KeyEvent): string {
  const parts: string[] = [];
  if (event.metaKey || event.ctrlKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}

// Guards against two modules claiming the same combo — the same class of bug
// the palette's id collision guard catches.
export function registerShortcuts(moduleId: string, entries: Shortcut[]): void {
  for (const entry of entries) {
    const combo = normalizeCombo(entry.combo);
    const clash = shortcuts.find((s) => s.combo === combo);
    if (clash) {
      throw new Error(
        `Shortcuts: "${combo}" is already registered by "${clash.moduleId}".`,
      );
    }
    shortcuts.push({ ...entry, combo, moduleId });
  }
}

export function unregisterShortcuts(moduleId: string): void {
  for (let i = shortcuts.length - 1; i >= 0; i--) {
    if (shortcuts[i].moduleId === moduleId) shortcuts.splice(i, 1);
  }
}

export function listShortcuts(): readonly Shortcut[] {
  return shortcuts.map((s) => ({
    combo: s.combo,
    commandId: s.commandId,
    description: s.description,
  }));
}

function isSequencePrefix(candidate: string): boolean {
  return shortcuts.some(
    (s) =>
      s.combo.includes(" ") &&
      (s.combo === candidate || s.combo.startsWith(`${candidate} `)),
  );
}

// The one correctness-critical piece: given a key event and the caller's
// current sequence buffer, return the matched commandId (or null) and the next
// buffer state. Pure — the caller (AppShell) holds `buffer` in a ref and feeds
// it back in.
//
// Priority: a chord (modified) match wins immediately and clears the buffer.
// Otherwise a plain key extends the sequence buffer: an exact sequence match
// fires and resets; a live prefix keeps buffering; anything else resets (but
// retries the key as a fresh sequence start so "g g d" still finds "g d").
export function matchShortcut(
  event: KeyEvent,
  buffer: string,
): { commandId: string | null; buffer: string } {
  const combo = eventCombo(event);

  const chord = shortcuts.find(
    (s) => !s.combo.includes(" ") && s.combo === combo,
  );
  if (chord) return { commandId: chord.commandId, buffer: "" };

  // A modified keystroke that didn't match a chord never contributes to a
  // plain-key sequence.
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return { commandId: null, buffer: "" };
  }

  const key = event.key.toLowerCase();
  const seq = (buffer ? `${buffer} ${key}` : key).trim();

  const exactSeq = shortcuts.find(
    (s) => s.combo.includes(" ") && s.combo === seq,
  );
  if (exactSeq) return { commandId: exactSeq.commandId, buffer: "" };

  if (isSequencePrefix(seq)) return { commandId: null, buffer: seq };
  if (isSequencePrefix(key)) return { commandId: null, buffer: key };
  return { commandId: null, buffer: "" };
}
