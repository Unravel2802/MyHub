export type FinanceLedgerView = "cards" | "table";

export const FINANCE_LEDGER_VIEW_KEY = "finance.ledgerView";
const DEFAULT_LEDGER_VIEW: FinanceLedgerView = "table";
const listeners = new Set<() => void>();

function isLedgerView(value: unknown): value is FinanceLedgerView {
  return value === "cards" || value === "table";
}

export function getFinanceLedgerView(): FinanceLedgerView {
  try {
    const stored = localStorage.getItem(FINANCE_LEDGER_VIEW_KEY);
    if (isLedgerView(stored)) return stored;
  } catch {
    // Storage is best-effort; private browsing can reject access.
  }
  return DEFAULT_LEDGER_VIEW;
}

export function getServerFinanceLedgerView(): FinanceLedgerView {
  return DEFAULT_LEDGER_VIEW;
}

export function subscribeFinanceLedgerView(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === FINANCE_LEDGER_VIEW_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function setFinanceLedgerView(view: FinanceLedgerView) {
  try {
    localStorage.setItem(FINANCE_LEDGER_VIEW_KEY, view);
  } catch {
    // Keep the in-memory view usable even when persistence is unavailable.
  }
  for (const listener of listeners) listener();
}
