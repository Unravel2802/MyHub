"use client";

import { READINESS_AREAS } from "@/src/modules/roadmap/roadmapCatalog";
import { levelValue } from "@/src/modules/roadmap/roadmapProgress";
import type { ReadinessEvidenceResult } from "@/src/modules/roadmap/roadmapProgress";
import type { ReadinessLevel } from "@/src/modules/roadmap/types";

type ReadinessRadarProps = {
  readiness: Record<string, ReadinessLevel>;
  evidenceFor: (areaKey: string) => ReadinessEvidenceResult | null;
  pendingKeys: ReadonlySet<string>;
  onSetLevel: (areaKey: string, level: ReadinessLevel) => void;
};

const LEVELS: ReadinessLevel[] = ["not_started", "minimum", "strong"];
const LEVEL_LABEL: Record<ReadinessLevel, string> = {
  not_started: "Not started",
  minimum: "Minimum",
  strong: "Strong",
};

const SIZE = 260;
const CENTRE = SIZE / 2;
const RADIUS = 92;
const MAX_LEVEL = 2; // strong

// Vertex for area `i` at level value `value` (0-2). Starts at 12 o'clock and
// goes clockwise, so "Algorithms" sits at the top.
function vertex(index: number, count: number, value: number) {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const r = (value / MAX_LEVEL) * RADIUS;
  return [CENTRE + r * Math.cos(angle), CENTRE + r * Math.sin(angle)] as const;
}

const polygon = (values: number[]) =>
  values
    .map((value, i) => vertex(i, values.length, value).join(","))
    .join(" ");

// §6.1's target is literally "strong across the board" — so make "across the
// board" a SHAPE. Pure SVG; no chart library (not on the approved list, and not
// needed for a heptagon).
export function ReadinessRadar({
  readiness,
  evidenceFor,
  pendingKeys,
  onSetLevel,
}: ReadinessRadarProps) {
  const areas = READINESS_AREAS;

  const claimed = areas.map((area) =>
    levelValue(readiness[area.key] ?? "not_started"),
  );

  // The third layer, and the reason this chart earns its place. Where we can
  // measure an area, use what the DATA supports rather than what was claimed —
  // so claiming Strong on Algorithms while averaging 38 minutes visibly pulls
  // the dashed line inward from the solid one. Where the bar is a judgment
  // (5 of the 7 areas), evidence is null and the dashed line simply follows the
  // claim: we don't have a number, and inventing one would be worse than saying so.
  const measured = areas.map((area, i) => {
    const evidence = evidenceFor(area.key);
    return evidence ? levelValue(evidence.supported) : claimed[i];
  });

  const hasContradiction = areas.some((area, i) => measured[i] < claimed[i]);

  return (
    <section aria-labelledby="readiness-heading" className="grid gap-5">
      <div>
        <h2
          className="text-xl font-semibold tracking-tight text-foreground"
          id="readiness-heading"
        >
          Graduation readiness
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          Target is Strong across all seven (§6.1). The dashed line is what your
          data actually supports.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-start">
        <svg
          aria-label="Readiness radar: target, claimed, and measured levels"
          className="mx-auto shrink-0"
          height={SIZE}
          role="img"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
        >
          <defs>
            {/* The claimed polygon fills with the brand indigo shifting toward
                violet — the "meta pages" family. A flat fill read as inert; the
                gradient gives the shape depth against the near-black canvas. */}
            <linearGradient id="radar-claimed" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--hue-violet)" stopOpacity="0.2" />
            </linearGradient>
          </defs>

          {/* Rings at minimum and strong. */}
          {[1, 2].map((level) => (
            <polygon
              className="fill-none stroke-border"
              key={level}
              points={polygon(areas.map(() => level))}
              strokeWidth={1}
            />
          ))}
          {/* Spokes. */}
          {areas.map((area, i) => {
            const [x, y] = vertex(i, areas.length, MAX_LEVEL);
            return (
              <line
                className="stroke-border"
                key={area.key}
                strokeWidth={1}
                x1={CENTRE}
                x2={x}
                y1={CENTRE}
                y2={y}
              />
            );
          })}

          {/* Claimed — gradient fill, accent stroke. */}
          <polygon
            className="stroke-accent"
            fill="url(#radar-claimed)"
            points={polygon(claimed)}
            strokeWidth={2}
          />

          {/* Measured — dashed. Red ONLY when it contradicts a claim; muted zinc
              when it merely agrees. Previously always red, which cried wolf even
              when the data backed you. */}
          <polygon
            className={
              hasContradiction ? "fill-none stroke-danger" : "fill-none stroke-subtle"
            }
            points={polygon(measured)}
            strokeDasharray="4 3"
            strokeWidth={2}
          />
        </svg>

        <ul className="grid gap-3">
          {areas.map((area, i) => {
            const level = readiness[area.key] ?? "not_started";
            const evidence = evidenceFor(area.key);
            const contradicted = measured[i] < claimed[i];

            return (
              <li
                className="rounded-md border border-border bg-surface-subtle p-3"
                key={area.key}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {area.label}
                  </span>
                  <div
                    aria-label={`${area.label} level`}
                    className="flex gap-1"
                    role="group"
                  >
                    {LEVELS.map((option) => (
                      <button
                        aria-pressed={level === option}
                        className={`rounded px-2 py-1 text-xs font-medium transition-colors duration-200 ease-in-out ${
                          level === option
                            ? "bg-accent text-primary-foreground"
                            : "bg-surface text-muted hover:text-foreground"
                        }`}
                        disabled={pendingKeys.has(area.key)}
                        key={option}
                        onClick={() => onSetLevel(area.key, option)}
                        type="button"
                      >
                        {LEVEL_LABEL[option]}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  <span className="font-medium">Strong:</span> {area.strong}
                </p>

                {evidence ? (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      contradicted
                        ? "text-danger"
                        : evidence.supported === "not_started"
                          ? // "No timed attempts yet" is ABSENCE, not success.
                            // Painting it green congratulates you for having no
                            // data — the same tint-on-nothing mistake already
                            // fixed on the achievements streak card and the CRM
                            // offer rate. Third time. Muted.
                            "text-muted"
                          : "text-success"
                    }`}
                  >
                    {contradicted ? "Your data says: " : "Evidence: "}
                    {evidence.detail}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {hasContradiction ? (
        <p className="rounded-md border border-danger-border bg-danger-surface p-3 text-sm text-danger">
          The dashed line sits inside your claim on at least one area — your data
          doesn&apos;t yet back the level you&apos;ve given yourself.
        </p>
      ) : null}
    </section>
  );
}
