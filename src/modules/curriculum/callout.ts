import type { ExtraProps } from "react-markdown";

type Element = NonNullable<ExtraProps["node"]>;
export const CALLOUT_KINDS = ["KEY", "PITFALL", "INTERVIEW", "CHECK"] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export function hastText(node: {
  value?: string;
  children?: readonly Parameters<typeof hastText>[0][];
}): string {
  return node.value ?? node.children?.map(hastText).join("") ?? "";
}

export function calloutMarker(
  node: Element | undefined,
): { kind: CalloutKind; prefix: string } | null {
  const first = node?.children.find((child) => child.type === "element");
  if (first?.type !== "element" || first.tagName !== "p") return null;
  const match = /^\[!(KEY|PITFALL|INTERVIEW|CHECK)\](?:\s+|$)/.exec(
    hastText(first),
  );
  return match ? { kind: match[1] as CalloutKind, prefix: match[0] } : null;
}

export function isKeyRule(node: Element | undefined): boolean {
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
