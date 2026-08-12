import type { ReactNode } from "react";
import { cn } from "@/src/lib/cn";

interface SectionHeaderProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export function SectionHeader({ children, className, id }: SectionHeaderProps) {
  return (
    <h2
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.08em] text-muted",
        className,
      )}
      id={id}
    >
      {children}
    </h2>
  );
}
