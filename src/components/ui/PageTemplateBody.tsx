import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/src/components/ui/PageHeader";

// The ordering half of the page contract (docs/ui-upgrade-wave3.md §2.1).
//
// This lives apart from PageTemplate.tsx on purpose. PageTemplate wires the
// AppShell, which reaches Zustand, next/link and a Supabase client that throws
// at import time without env vars — importing it into the unit suite would mean
// mocking three subsystems to test a `<div>` order. Everything the contract
// actually promises is in this file, and `react-dom/server` renders it in the
// existing node environment with no jsdom and no mocks.
//
// The slot order IS the contract:
//
//     header -> error -> hero -> stats -> data (children) -> compose
//
// `compose` (entry forms) renders after `children` (the data), always. There is
// no prop that reorders them. Trading shipped a nine-field form above its equity
// curve and journal — the exact form-first defect docs/visual-refresh.md §1.5
// diagnosed and X1 fixed for three other modules — because "data before forms"
// lived only in prose. Here it is structure.
//
// The render maps over SLOT_ORDER rather than hard-coding JSX in sequence, so
// pageTemplate.test.tsx asserts against the same array the component renders
// from: reordering the page means reordering that array, and the suite fails.

export const SLOT_ORDER = ["hero", "stats", "data", "compose"] as const;

export type SlotName = (typeof SLOT_ORDER)[number];

// Secondary metrics are capped because ten equal-weight tiles is not a
// scoreboard, it's a wall — Trading shipped exactly that (5x2, eight of them
// showing an em-dash). Four is the most that still reads as a row rather than a
// grid you have to scan. Anything past four belongs in the panel that gives it
// context.
export const MAX_STATS = 4;

export interface PageTemplateBodyProps {
  /**
   * The module's nav href. Single source of truth: it drives the rail's active
   * state AND the module hue, so the two can never disagree the way they could
   * when pages passed `activeHref` and `hueFor(...)` separately.
   */
  href: string;
  /** The page's own H2. Often not the nav label — "Keep the week honest". */
  title: ReactNode;
  eyebrow: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  /**
   * Page-level controls — refresh, create, filter. One slot and one placement,
   * because Refresh currently renders three different ways across three pages
   * (a full-width bar, an icon button, and a toolbar button).
   */
  actions?: ReactNode;
  /** Store error. Rendered as the standard assertive banner; null when clear. */
  error?: string | null;
  /**
   * The page's single focal point, normally a `<StatCard size="hero">`.
   *
   * Required, but nullable — pass `hero={null}` deliberately for pages whose
   * focal point genuinely is their content rather than a metric (Knowledge Base,
   * Design Drills). Requiring the prop forces that to be a decision someone
   * typed, not an omission. What it must never be is a bare zero or an em-dash:
   * see "never headline absence" in docs/ui-upgrade-wave3.md §2.2.
   */
  hero: ReactNode;
  /** Secondary metrics, at most MAX_STATS. The template owns the grid. */
  stats?: ReactNode[];
  /** The data. Always rendered above `compose`. */
  children: ReactNode;
  /** Entry forms and composers. Structurally forced below the data. */
  compose?: ReactNode;
  /**
   * `"full"` (default): header washes edge-to-edge, matching every workspace
   * page. `"narrow"`: header and every slot share one centered `max-w-5xl`
   * column instead, and the header's bleed wash is turned off — the hub's
   * distinct landing-page identity, not a workspace. Reach for `"full"`
   * unless the page is explicitly a nav index rather than a workspace; a
   * second `"narrow"` caller should mean the app now has two kinds of
   * landing page, not that `"narrow"` has become the default choice.
   */
  contentWidth?: "full" | "narrow";
}

export function PageTemplateBody({
  actions,
  children,
  compose,
  contentWidth = "full",
  description,
  error = null,
  eyebrow,
  hero,
  href,
  icon,
  stats,
  title,
}: PageTemplateBodyProps) {
  if (
    process.env.NODE_ENV !== "production" &&
    stats &&
    stats.length > MAX_STATS
  )
    console.error(
      `PageTemplate(${href}): ${stats.length} stats passed, max is ${MAX_STATS}. ` +
        `The extras are dropped — move them into the panel that gives them ` +
        `context. See docs/ui-upgrade-wave3.md §2.3.`,
    );

  const slots: Record<SlotName, ReactNode> = {
    hero: hero ?? null,
    stats: stats?.length ? (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.slice(0, MAX_STATS)}
      </div>
    ) : null,
    data: <div className="grid min-w-0 gap-6">{children}</div>,
    compose: compose ?? null,
  };

  const inner = (
    <>
      <PageHeader
        actions={actions}
        bleed={contentWidth === "full"}
        className="mb-6"
        description={description}
        eyebrow={eyebrow}
        icon={icon}
        title={title}
      />

      {error ? (
        <p
          aria-live="assertive"
          className="mb-5 rounded-md border border-danger-border bg-danger-surface px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {/* `data-page-slot` is not decoration: tests/ui/page-contract.spec.ts
          asserts against these markers that no page renders `compose` before
          `data`.

          Named `data-page-slot`, not `data-slot`: the generated shadcn
          primitives (dialog, select, command) already put `data-slot` on 32
          elements, so the plain name cannot distinguish a page section from a
          dropdown's trigger. The gate found this on its first run. */}
      {SLOT_ORDER.map((slot) =>
        slots[slot] ? (
          <div className="mb-6 last:mb-0" data-page-slot={slot} key={slot}>
            {slots[slot]}
          </div>
        ) : null,
      )}
    </>
  );

  return (
    <section className="page-fade min-w-0 px-4 py-6 sm:px-6 lg:px-8">
      {contentWidth === "narrow" ? (
        <div className="mx-auto w-full max-w-5xl">{inner}</div>
      ) : (
        inner
      )}
    </section>
  );
}
