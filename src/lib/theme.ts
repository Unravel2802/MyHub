export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "myhub-theme";
export const THEMES: Theme[] = ["light", "dark", "system"];

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

// "system" follows the OS setting; everything else is an explicit choice.
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(theme) === "dark",
  );
}

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // Private browsing can throw on localStorage access; fall back to system.
  }
  return "system";
}

// A minimal external store so the toggle can render the active theme via
// useSyncExternalStore, rather than syncing localStorage into state inside an
// effect (which would both trip react-hooks/set-state-in-effect and flicker).
const listeners = new Set<() => void>();

export function subscribeTheme(onChange: () => void) {
  listeners.add(onChange);

  // While the choice is "system", follow the OS as it changes.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readStoredTheme() === "system") applyTheme("system");
  };
  media.addEventListener("change", onSystemChange);

  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onSystemChange);
  };
}

export function getTheme(): Theme {
  return readStoredTheme();
}

// The server has no storage or OS hint, so it always renders the default.
export function getServerTheme(): Theme {
  return "system";
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
