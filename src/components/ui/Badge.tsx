import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "success";
}

const toneClasses = {
  neutral: "bg-surface-subtle text-muted",
  accent: "bg-accent text-accent-strong",
  danger: "bg-danger-surface text-danger",
  success: "bg-accent text-accent-strong",
} as const;

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}
