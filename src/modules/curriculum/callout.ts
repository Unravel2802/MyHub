import type { ExtraProps } from "react-markdown";

type Element = NonNullable<ExtraProps["node"]>;
export const CALLOUT_KINDS = [
  "KEY",
  "PITFALL",
  "INTERVIEW",
  "CHECK",
  "EXERCISE",
  "WHY",
  "GOALS",
] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];
export const EXERCISE_LEVELS = ["recall", "apply", "stretch"] as const;
export type ExerciseLevel = (typeof EXERCISE_LEVELS)[number];

export function hastText(node: {
  value?: string;
  children?: readonly Parameters<typeof hastText>[0][];
}): string {
  return node.value ?? node.children?.map(hastText).join("") ?? "";
}

export function calloutMarker(
  node: Element | undefined,
): { kind: CalloutKind; prefix: string; level?: ExerciseLevel } | null {
  const first = node?.children.find((child) => child.type === "element");
  if (first?.type !== "element" || first.tagName !== "p") return null;
  const match =
    /^\[!(KEY|PITFALL|INTERVIEW|CHECK|EXERCISE|WHY|GOALS)(?:\s+([^\]\s]+))?\]\s*/.exec(
      hastText(first),
    );
  if (!match) return null;
  const kind = match[1] as CalloutKind;
  if (kind !== "EXERCISE") return match[2] ? null : { kind, prefix: match[0] };
  const level = EXERCISE_LEVELS.find((candidate) => candidate === match[2]);
  return level ? { kind, prefix: match[0], level } : null;
}

export function isKeyRule(node: Element | undefined): boolean {
  const first = node?.children.find((child) => child.type === "element");
  if (first && /^\[![^\]]+\]/.test(hastText(first))) return false;
  const paragraphs = node?.children.filter(
    (child) =>
      child.type === "element" || (child.type === "text" && child.value.trim()),
  );
  return (
    !!paragraphs?.length &&
    paragraphs.every(
      (child) =>
        child.type === "element" &&
        child.tagName === "p" &&
        child.children.every(
          (part) =>
            (part.type === "text" && !part.value.trim()) ||
            (part.type === "element" && part.tagName === "strong"),
        ),
    )
  );
}
