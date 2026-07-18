import { create } from "zustand";

// UI-only state for the global Command Palette overlay. Deliberately excludes
// the command registry itself (src/lib/commandPalette.ts) — registration is
// imperative (each module calls register() once on mount), and putting the
// registry's Map in here would make every subscriber recompute on every
// register call for no reason. See docs/handoff/command-palette.md.
// How many recently-invoked commands the palette surfaces in its "Recent"
// group. Small on purpose — recents are a shortcut to frequent actions, not a
// history log.
const MAX_RECENTS = 5;

export interface CommandPaletteStore {
  isOpen: boolean;
  query: string;
  // Namespaced command ids, most-recent-first, deduped and capped. The UI
  // renders these as a "Recent" group (Wave 4 Workstream D); the palette calls
  // pushRecent(id) whenever a command is invoked.
  recentIds: string[];
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
  pushRecent: (id: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>(
  (set, get) => ({
    isOpen: false,
    query: "",
    recentIds: [],
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false, query: "" }),
    toggle: () => set({ isOpen: !get().isOpen }),
    setQuery: (query) => set({ query }),
    // Re-invoking a command moves it to the front rather than duplicating it.
    pushRecent: (id) =>
      set((state) => ({
        recentIds: [id, ...state.recentIds.filter((r) => r !== id)].slice(
          0,
          MAX_RECENTS,
        ),
      })),
  }),
);
