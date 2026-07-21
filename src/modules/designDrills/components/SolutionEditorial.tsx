import { Badge } from "@/src/components/ui/Badge";
import { Markdown } from "@/src/components/ui/Markdown";
import { Panel } from "@/src/components/ui/Panel";
import { cn } from "@/src/lib/cn";
import { DESIGN_DRILL_CATEGORY_HUES } from "@/src/modules/designDrills/designDrillHues";
import type {
  DesignDrillCategory,
  DrillSolution,
} from "@/src/modules/designDrills/types";

interface SolutionEditorialProps {
  category: DesignDrillCategory;
  solution: DrillSolution;
}

function safeReferenceUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function SolutionEditorial({
  category,
  solution,
}: SolutionEditorialProps) {
  const hue = DESIGN_DRILL_CATEGORY_HUES[category];
  const references = (solution.references ?? []).flatMap((reference) => {
    const url = safeReferenceUrl(reference.url);
    return url ? [{ ...reference, url }] : [];
  });

  return (
    <article className={cn("grid gap-5", "text-body")}>
      <Panel aside={<Badge hue={hue}>Editorial</Badge>} overline="Intuition">
        <Markdown>{solution.summary}</Markdown>
      </Panel>

      <nav aria-label="Solution outline">
        <p className="text-xs font-medium uppercase tracking-widest text-muted">
          Outline
        </p>
        <ol className="mt-2 flex flex-wrap gap-2">
          {solution.sections.map((section, index) => (
            <li key={section.id}>
              <a
                className="inline-flex rounded-full border border-border bg-surface-subtle px-3 py-1 text-xs font-medium text-body hover:border-accent-border hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                href={`#${section.id}`}
              >
                {index + 1}. {section.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-5">
        {solution.sections.map((section, index) => (
          <section
            aria-labelledby={`${section.id}-heading`}
            className="scroll-mt-6 border-t border-border pt-5 first:border-0 first:pt-0"
            id={section.id}
            key={section.id}
          >
            <div className="mb-3 flex items-start gap-3">
              <Badge hue={hue}>{String(index + 1).padStart(2, "0")}</Badge>
              <h3
                className="text-lg font-semibold tracking-tight text-foreground"
                id={`${section.id}-heading`}
              >
                {section.heading}
              </h3>
            </div>
            <Markdown>{section.body}</Markdown>
          </section>
        ))}
      </div>

      {solution.estimates.length > 0 ? (
        <Panel
          description="Back-of-the-envelope figures that shape the architecture."
          overline="Scale, latency & cost"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-96 border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-medium" scope="col">
                    Measure
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Estimate
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Basis
                  </th>
                </tr>
              </thead>
              <tbody>
                {solution.estimates.map((estimate) => (
                  <tr
                    className="border-b border-border last:border-0"
                    key={`${estimate.label}-${estimate.value}`}
                  >
                    <th
                      className="px-3 py-2 font-medium text-foreground"
                      scope="row"
                    >
                      {estimate.label}
                    </th>
                    <td className="px-3 py-2 font-mono text-accent-strong tabular-nums">
                      {estimate.value}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {estimate.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {references.length > 0 ? (
        <section aria-labelledby="solution-references-heading">
          <h3
            className="text-sm font-semibold text-foreground"
            id="solution-references-heading"
          >
            References
          </h3>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {references.map((reference) => (
              <li key={`${reference.label}-${reference.url}`}>
                <a
                  className="font-medium text-accent-strong underline underline-offset-2 hover:text-accent"
                  href={reference.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {reference.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
