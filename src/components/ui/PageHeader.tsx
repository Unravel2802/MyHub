import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { hueVar, type HueName } from "@/src/components/moduleHues";

const eyebrowClasses: Record<HueName, string> = {
  accent: "text-accent-strong",
  amber: "text-hue-amber",
  orange: "text-hue-orange",
  rose: "text-hue-rose",
  violet: "text-hue-violet",
  blue: "text-hue-blue",
  cyan: "text-hue-cyan",
  teal: "text-hue-teal",
  emerald: "text-hue-emerald",
  fuchsia: "text-hue-fuchsia",
};

type PageHeaderProps = {
  actions?: ReactNode;
  bleed?: boolean;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow: ReactNode;
  hue: HueName;
  icon?: LucideIcon;
  title: ReactNode;
};

export function PageHeader({
  actions,
  bleed = false,
  children,
  className = "",
  description,
  eyebrow,
  hue,
  icon,
  title,
}: PageHeaderProps) {
  const Icon = icon;
  return (
    <header
      className={`hue-wash border-b border-border bg-surface px-4 py-5 sm:px-6 lg:px-8 ${
        bleed ? "-mx-4 -mt-6 sm:-mx-6 lg:-mx-8" : ""
      } ${className}`}
      style={{ ["--hue" as string]: hueVar(hue) }}
    >
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p
            className={`flex items-center gap-2 text-sm font-medium ${eyebrowClasses[hue]}`}
          >
            {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
            {eyebrow}
          </p>
          <h2 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </header>
  );
}
