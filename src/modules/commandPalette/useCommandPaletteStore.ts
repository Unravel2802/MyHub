import { create } from "zustand";

// UI-only state for the global Command Palette overlay. Deliberately excludes
// the command registry itself (src/lib/commandPalette.ts) — registration is
// imperative (each module calls register() once on mount), and putting the
// registry's Map in here would make every subscriber recompute on every
// register call for no reason. See docs/handoff/command-palette.md.
export interface CommandPaletteStore {
  isOpen: boolean;
  query: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (query: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteStore>(
  (set, get) => ({
    isOpen: false,
    query: "",
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false, query: "" }),
    toggle: () => set({ isOpen: !get().isOpen }),
    setQuery: (query) => set({ query }),
  }),
);
