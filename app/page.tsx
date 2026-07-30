import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NAV_ITEMS } from "@/src/components/appNav";
import { CORE_TOOL_HREFS, MINI_APPS } from "@/src/components/miniApps";
import { hueFor } from "@/src/components/moduleHues";
import { HUE_DOT, HUE_TEXT } from "@/src/components/ui/hueClasses";
import { HueIconChip } from "@/src/components/ui/HueIconChip";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { Panel } from "@/src/components/ui/Panel";

export default function Home() {
  const coreTools = NAV_ITEMS.filter((item) =>
    CORE_TOOL_HREFS.includes(item.href),
  );

  return (
    <PageTemplate
      contentWidth="narrow"
      description="Choose a workspace and get back to the work that matters."
      eyebrow="Home"
      hero={null}
      href="/"
      title="Your apps"
    >
      <div className="grid gap-6 md:grid-cols-2">
        {MINI_APPS.map((app) => {
          const Icon = app.icon;
          const headingId = `${app.key}-heading`;
          return (
            <section aria-labelledby={headingId} key={app.key}>
              <div className="flex items-center justify-between gap-3">
                <h2
                  className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-muted"
                  id={headingId}
                >
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-sm ${HUE_DOT[app.hue]}`}
                  />
                  {app.label}
                </h2>
                <Link
                  aria-label={`Explore ${app.label} workspace`}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-80 ${HUE_TEXT[app.hue]}`}
                  href={app.href}
                >
                  Open {app.label}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>

              <Link
                aria-label={`Open ${app.label}`}
                className="group mt-3 block"
                href={app.href}
              >
                <Panel
                  className="h-full transition-colors group-hover:border-input-hover"
                  title={
                    <span className="flex items-center gap-2 text-foreground">
                      <HueIconChip hue={app.hue} icon={Icon} />
                      {app.label}
                    </span>
                  }
                >
                  <span className="flex items-center gap-1.5 text-sm text-muted transition-colors group-hover:text-foreground">
                    Open workspace
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </Panel>
              </Link>
            </section>
          );
        })}
      </div>

      <section aria-labelledby="core-tools-heading">
        <h2
          className="text-sm font-semibold uppercase tracking-widest text-muted"
          id="core-tools-heading"
        >
          Core tools
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {coreTools.map((tool) => {
            const Icon = tool.icon;
            const hue = hueFor(tool.href);
            return (
              <Link
                aria-label={`Open ${tool.label}`}
                className="group"
                href={tool.href}
                key={tool.href}
              >
                <Panel
                  className="h-full transition-colors group-hover:border-input-hover"
                  title={
                    <span className="flex items-center gap-2 text-foreground">
                      {Icon ? <HueIconChip hue={hue} icon={Icon} /> : null}
                      {tool.label}
                    </span>
                  }
                >
                  <span className="flex items-center gap-1.5 text-sm text-muted transition-colors group-hover:text-foreground">
                    Open tool
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </span>
                </Panel>
              </Link>
            );
          })}
        </div>
      </section>
    </PageTemplate>
  );
}
