export type DesignDrillCodeLanguage =
  | "markdown"
  | "plaintext"
  | "python"
  | "typescript"
  | "javascript"
  | "go"
  | "java"
  | "sql";

export const DESIGN_DRILL_CODE_LANGUAGE_KEY = "designDrills.codeLanguage";
const DEFAULT_CODE_LANGUAGE: DesignDrillCodeLanguage = "markdown";
const listeners = new Set<() => void>();

function isCodeLanguage(value: unknown): value is DesignDrillCodeLanguage {
  return (
    value === "markdown" ||
    value === "plaintext" ||
    value === "python" ||
    value === "typescript" ||
    value === "javascript" ||
    value === "go" ||
    value === "java" ||
    value === "sql"
  );
}

export function getDesignDrillCodeLanguage(): DesignDrillCodeLanguage {
  try {
    const stored = localStorage.getItem(DESIGN_DRILL_CODE_LANGUAGE_KEY);
    if (isCodeLanguage(stored)) return stored;
  } catch {
    // Storage is best-effort; private browsing can reject access.
  }
  return DEFAULT_CODE_LANGUAGE;
}

export function getServerDesignDrillCodeLanguage(): DesignDrillCodeLanguage {
  return DEFAULT_CODE_LANGUAGE;
}

export function subscribeDesignDrillCodeLanguage(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === DESIGN_DRILL_CODE_LANGUAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setDesignDrillCodeLanguage(language: DesignDrillCodeLanguage) {
  try {
    localStorage.setItem(DESIGN_DRILL_CODE_LANGUAGE_KEY, language);
  } catch {
    // Keep the in-memory language usable even when persistence is unavailable.
  }
  for (const listener of listeners) listener();
}
