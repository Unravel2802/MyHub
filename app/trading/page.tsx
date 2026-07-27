import { AppShell } from "@/src/components/AppShell";
import { TradingJournal } from "@/src/modules/trading/components/TradingJournal";

export default function TradingPage() {
  return (
    <AppShell activeHref="/trading" title="Trading">
      <TradingJournal />
    </AppShell>
  );
}
