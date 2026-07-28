import { AppShell } from "@/src/components/AppShell";
import { NAV_ITEMS } from "@/src/components/appNav";
import {
  PageTemplateBody,
  type PageTemplateBodyProps,
} from "@/src/components/ui/PageTemplateBody";

// The page contract (docs/ui-upgrade-wave3.md §2.1).
//
// Every route was hand-rolling the same five things — the AppShell call, the
// padding wrapper, a `bleed` PageHeader, an identical `aria-live` error banner,
// and its own idea of what order the sections go in. Thirteen copies, and the
// order is the one that drifted.
//
// This file is the shell wiring. The ordering guarantee — and the reasoning
// behind it — lives in PageTemplateBody.tsx, which is where the unit suite
// points. Consumers only ever need this component.

interface PageTemplateProps extends PageTemplateBodyProps {
  /**
   * Title for the sidebar rail. Defaults to this href's nav label — pass it only
   * when the rail should read differently from the nav ("Daily Dashboard" for a
   * nav item labelled "Dashboard").
   */
  navTitle?: string;
}

export function PageTemplate({ navTitle, ...body }: PageTemplateProps) {
  const railTitle =
    navTitle ??
    NAV_ITEMS.find((item) => item.href === body.href)?.label ??
    "MyHub";

  return (
    <AppShell activeHref={body.href} title={railTitle}>
      <PageTemplateBody {...body} />
    </AppShell>
  );
}
