import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NAV_ITEMS } from "@/src/components/appNav";
import { CORE_TOOL_HREFS, MINI_APPS } from "@/src/components/miniApps";
import { hueFor, hueVar } from "@/src/components/moduleHues";
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
      <section aria-labelledby="mini-apps-heading">
        <h2
          className="text-sm font-semibold uppercase tracking-widest text-muted"
          id="mini-apps-heading"
        >
          Mini-apps
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {MINI_APPS.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                aria-label={`Open ${app.label}`}
                className="group"
                href={app.href}
                key={app.key}
                style={{ ["--hue" as string]: hueVar(app.hue) }}
              >
                <Panel
                  className="h-full transition-colors group-hover:border-input-hover"
                  title={
                    <span className="hue-gradient-text flex items-center gap-2">
                      <Icon
                        aria-hidden="true"
                        className="size-5"
                        style={{ color: "var(--hue)" }}
                      />
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
            );
          })}
        </div>
      </section>

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
                style={{ ["--hue" as string]: hueVar(hue) }}
              >
                <Panel
                  className="h-full transition-colors group-hover:border-input-hover"
                  title={
                    <span className="hue-gradient-text flex items-center gap-2">
                      {Icon ? (
                        <Icon
                          aria-hidden="true"
                          className="size-5"
                          style={{ color: "var(--hue)" }}
                        />
                      ) : null}
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
