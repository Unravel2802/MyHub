import type { ReactNode } from "react";
import type { HueName } from "@/src/components/moduleHues";
import { hueVar } from "@/src/components/moduleHues";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "success" | "danger";
  // "hero" is the page's single focal point. The app otherwise lives entirely
  // between 12px and 24px, and size contrast is the cheapest hierarchy there is
  // — exactly one of these per page.
  size?: "default" | "hero";
  // Lift on hover. Off by default: a card that moves when you're only reading it
  // is noise. Turn it on where the card is actually interactive.
  interactive?: boolean;
  hue?: HueName;
}

const toneClasses = {
  default: "border-border bg-surface-subtle",
  accent: "border-accent-border bg-accent-surface",
  success: "border-success-border bg-success-surface",
  danger: "border-danger-border bg-danger-surface",
} as const;

const valueClasses = {
  default: "text-foreground",
  accent: "text-accent-strong",
  success: "text-success",
  danger: "text-danger",
} as const;

const hueClasses: Record<HueName, { container: string; value: string }> = {
  accent: {
    container: "border-accent-border bg-accent-surface",
    value: "text-accent-strong",
  },
  amber: {
    container: "border-hue-amber-border bg-hue-amber-surface",
    value: "text-hue-amber",
  },
  orange: {
    container: "border-hue-orange-border bg-hue-orange-surface",
    value: "text-hue-orange",
  },
  rose: {
    container: "border-hue-rose-border bg-hue-rose-surface",
    value: "text-hue-rose",
  },
  violet: {
    container: "border-hue-violet-border bg-hue-violet-surface",
    value: "text-hue-violet",
  },
  blue: {
    container: "border-hue-blue-border bg-hue-blue-surface",
    value: "text-hue-blue",
  },
  cyan: {
    container: "border-hue-cyan-border bg-hue-cyan-surface",
    value: "text-hue-cyan",
  },
  teal: {
    container: "border-hue-teal-border bg-hue-teal-surface",
    value: "text-hue-teal",
  },
  emerald: {
    container: "border-hue-emerald-border bg-hue-emerald-surface",
    value: "text-hue-emerald",
  },
  fuchsia: {
    container: "border-hue-fuchsia-border bg-hue-fuchsia-surface",
    value: "text-hue-fuchsia",
  },
};

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  size = "default",
  interactive = false,
  hue,
}: StatCardProps) {
  const isHero = size === "hero";
  const colors = hue ? hueClasses[hue] : null;

  return (
    <div
      className={[
        "rounded-lg border transition-all duration-200 ease-in-out",
        isHero ? "px-6 py-5" : "px-4 py-3",
        colors?.container ?? toneClasses[tone],
        interactive
          ? "hover:scale-[1.02] hover:border-accent-border motion-reduce:hover:scale-100"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={hue && isHero ? { ["--hue" as string]: hueVar(hue) } : undefined}
    >
      {/* The overline: uppercase, wide-tracked, muted. min-h keeps a two-line
          label ("ML system design") from dropping its value a line below the
          tiles beside it — the Prep scorecard row visibly broke because of this. */}
      <p className="min-h-[2rem] text-xs font-medium uppercase leading-4 tracking-widest text-muted">
        {label}
      </p>
      {/* tabular-nums so a value ticking 9 -> 10 doesn't shift the tile's width */}
      <p
        className={[
          "font-semibold tabular-nums tracking-tight",
          isHero ? "mt-1 text-5xl" : "mt-1 text-2xl",
          isHero && hue ? "hue-gradient-text" : "",
          colors?.value ?? valueClasses[tone],
        ].join(" ")}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
