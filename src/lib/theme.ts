export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "myhub-theme";
export const THEMES: Theme[] = ["light", "dark"];
export const DEFAULT_THEME: Theme = "dark";

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Private browsing can throw on localStorage access; fall back to default.
  }
  return DEFAULT_THEME;
}

// A minimal external store so the toggle can render the active theme via
// useSyncExternalStore, rather than syncing localStorage into state inside an
// effect (which would both trip react-hooks/set-state-in-effect and flicker).
const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);

  // Keep other tabs of the app in sync when the choice changes.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    applyTheme(readStoredTheme());
    onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getTheme(): Theme {
  return readStoredTheme();
}

// The server has no storage to read, so it renders the default.
export function getServerTheme(): Theme {
  return DEFAULT_THEME;
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persistence is best-effort; the applied theme still takes effect.
  }
  applyTheme(theme);
  for (const listener of listeners) listener();
}
