// Desktop sidebar collapse state. AppShell re-mounts on every page navigation,
// so a plain useState would reset the choice each time — this persists it to
// localStorage and exposes it as an external store (same pattern as theme.ts)
// so components read it via useSyncExternalStore without a set-state-in-effect
// or hydration flicker. Collapse is a DESKTOP concept; on mobile the existing
// Menu/Close toggle owns the rail and this is ignored.

export const SIDEBAR_STORAGE_KEY = "myhub-sidebar-collapsed";

const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    // Private browsing can throw on localStorage access; default to expanded.
    return false;
  }
}

export function subscribeSidebar(onChange: () => void) {
  listeners.add(onChange);

  // Keep other tabs of the app in sync when the choice changes.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SIDEBAR_STORAGE_KEY) return;
    onChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getSidebarCollapsed(): boolean {
  return readCollapsed();
}

// The server has no storage to read, so it renders expanded — and the client's
// first (hydration) render must match, so it uses this too.
export function getServerSidebarCollapsed(): boolean {
  return false;
}

export function setSidebarCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Persistence is best-effort; the toggle still takes effect this session.
  }
  for (const listener of listeners) listener();
}

export function toggleSidebar() {
  setSidebarCollapsed(!readCollapsed());
}
