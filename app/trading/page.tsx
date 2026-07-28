import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { AppShell } from "@/src/components/AppShell";
import { TradingJournal } from "@/src/modules/trading/components/TradingJournal";
import { TradingReferenceLibrary } from "@/src/modules/trading/components/TradingReferenceLibrary";

export default async function TradingPage() {
  const contentDirectory = join(
    process.cwd(),
    "src",
    "modules",
    "trading",
    "content",
  );
  const [systematicPlan, technicalDeepDive] = await Promise.all([
    readFile(join(contentDirectory, "systematic-trading-plan.md"), "utf8"),
    readFile(join(contentDirectory, "technical-deep-dive.md"), "utf8"),
  ]);

  return (
    <AppShell activeHref="/trading" title="Trading">
      <TradingJournal
        referenceContent={
          <TradingReferenceLibrary
            systematicPlan={systematicPlan}
            technicalDeepDive={technicalDeepDive}
          />
        }
      />
    </AppShell>
  );
}
