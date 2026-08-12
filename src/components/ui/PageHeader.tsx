import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type PageHeaderProps = {
  actions?: ReactNode;
  bleed?: boolean;
  children?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow: ReactNode;
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
  icon,
  title,
}: PageHeaderProps) {
  const Icon = icon;
  return (
    <header
      className={`border-b border-border bg-surface px-4 pb-sm pt-md sm:px-6 lg:px-8 ${
        bleed ? "-mx-4 -mt-6 sm:-mx-6 lg:-mx-8" : ""
      } ${className}`}
    >
      <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs text-muted">
            {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
            {eyebrow}
          </p>
          <h2 className="mt-1 text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>
          ) : null}
        </div>
        {/* Actions must not stretch. As a bare child of this `flex-col` they
            inherited `align-items: stretch` and went full-bleed below 2xl —
            that, not a Dashboard mistake, is why Refresh renders as a wide bar
            across the top of the page (docs/ui-upgrade-wave3.md §1.6). Pages
            whose action is a fixed-size icon button hid the bug by accident. */}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 self-start 2xl:self-end">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}
