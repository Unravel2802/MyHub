import type { ReactNode } from "react";
import type { HueName } from "@/src/components/moduleHues";
import { HUE_BADGE } from "@/src/components/ui/hueClasses";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "success";
  hue?: HueName;
}

// Every tone pairs a tinted SURFACE with a strong FOREGROUND of the same hue.
// `accent` previously painted accent text on an accent fill — teal on teal,
// near-unreadable — and `success` was a straight copy of it. Both now follow the
// surface/foreground pairing `danger` already used correctly.
const toneClasses = {
  neutral: "border-border bg-surface-subtle text-muted",
  accent: "border-accent-border bg-accent-surface text-accent-strong",
  success: "border-success-border bg-success-surface text-success",
  danger: "border-danger-border bg-danger-surface text-danger",
} as const;

export function Badge({ children, tone = "neutral", hue }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${hue ? HUE_BADGE[hue] : toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
