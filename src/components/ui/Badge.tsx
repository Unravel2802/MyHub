import type { ReactNode } from "react";
import type { HueName } from "@/src/components/moduleHues";

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

const hueClasses: Record<HueName, string> = {
  accent: "border-accent-border bg-accent-surface text-accent-strong",
  amber: "border-hue-amber-border bg-hue-amber-surface text-hue-amber",
  orange: "border-hue-orange-border bg-hue-orange-surface text-hue-orange",
  rose: "border-hue-rose-border bg-hue-rose-surface text-hue-rose",
  violet: "border-hue-violet-border bg-hue-violet-surface text-hue-violet",
  blue: "border-hue-blue-border bg-hue-blue-surface text-hue-blue",
  cyan: "border-hue-cyan-border bg-hue-cyan-surface text-hue-cyan",
  teal: "border-hue-teal-border bg-hue-teal-surface text-hue-teal",
  emerald: "border-hue-emerald-border bg-hue-emerald-surface text-hue-emerald",
};

export function Badge({ children, tone = "neutral", hue }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${hue ? hueClasses[hue] : toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
