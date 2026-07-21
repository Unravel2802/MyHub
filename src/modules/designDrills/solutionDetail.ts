import type {
  DrillSolution,
  DrillSolutionSection,
} from "@/src/modules/designDrills/types";

// Defensive parser for the `design_drills.solution_detail` jsonb column.
// Supabase hands the column back already parsed (object | null), so the input is
// `unknown`. A null, missing, or structurally-wrong blob returns null — the UI
// then falls back to the plain-text `solution` — and it NEVER throws, so one bad
// row can't take down the whole drills fetch. It does console.error the reason,
// per the module's error convention (real error to the console, graceful
// degradation for the user).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseSolutionDetail(
  raw: unknown,
  slug: string,
): DrillSolution | null {
  if (raw == null) return null;
  if (!isRecord(raw)) {
    console.error(
      `design_drills.solution_detail for "${slug}" is not an object`,
    );
    return null;
  }

  const { summary, sections, estimates, references } = raw;
  if (
    typeof summary !== "string" ||
    !Array.isArray(sections) ||
    !Array.isArray(estimates)
  ) {
    console.error(
      `design_drills.solution_detail for "${slug}" is missing required fields`,
    );
    return null;
  }

  const parsedSections: DrillSolutionSection[] = [];
  for (const section of sections) {
    if (
      isRecord(section) &&
      typeof section.id === "string" &&
      typeof section.heading === "string" &&
      typeof section.body === "string"
    ) {
      parsedSections.push({
        id: section.id,
        heading: section.heading,
        body: section.body,
      });
    }
  }

  const parsedEstimates = estimates
    .filter(
      (estimate): estimate is Record<string, unknown> =>
        isRecord(estimate) &&
        typeof estimate.label === "string" &&
        typeof estimate.value === "string",
    )
    .map((estimate) => ({
      label: estimate.label as string,
      value: estimate.value as string,
      ...(typeof estimate.note === "string" ? { note: estimate.note } : {}),
    }));

  const parsedReferences = Array.isArray(references)
    ? references
        .filter(
          (ref): ref is Record<string, unknown> =>
            isRecord(ref) &&
            typeof ref.label === "string" &&
            typeof ref.url === "string",
        )
        .map((ref) => ({ label: ref.label as string, url: ref.url as string }))
    : undefined;

  // An editorial with no usable sections is treated as "not authored" so the
  // fallback plain-text solution shows instead of an empty shell.
  if (parsedSections.length === 0) {
    console.error(
      `design_drills.solution_detail for "${slug}" has no valid sections`,
    );
    return null;
  }

  return {
    summary,
    sections: parsedSections,
    estimates: parsedEstimates,
    ...(parsedReferences && parsedReferences.length > 0
      ? { references: parsedReferences }
      : {}),
  };
}
