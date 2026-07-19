import { AppShell } from "@/src/components/AppShell";
import { EmptyState } from "@/src/components/ui/EmptyState";

// Placeholder route so the /finance nav link resolves while Codex builds the
// real ledger UI (see docs/handoff/finance-ledger.md). The data layer beneath it
// — migration 0019, FinanceRepository, useFinanceStore, the money/period/summary
// logic — is complete and live; only this page is a stub.
export default function Page() {
  return (
    <AppShell title="Finances" activeHref="/finance">
      <div className="page-fade px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState
          title="Finances — coming soon"
          description="The ledger data layer is ready; the interface is being built."
        />
      </div>
    </AppShell>
  );
}
