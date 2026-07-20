import type { HueName } from "@/src/components/moduleHues";

export const HUE_DOT: Record<HueName, string> = {
  accent: "bg-accent",
  amber: "bg-hue-amber",
  orange: "bg-hue-orange",
  rose: "bg-hue-rose",
  violet: "bg-hue-violet",
  blue: "bg-hue-blue",
  cyan: "bg-hue-cyan",
  teal: "bg-hue-teal",
  emerald: "bg-hue-emerald",
  fuchsia: "bg-hue-fuchsia",
  lime: "bg-hue-lime",
};

export const HUE_NAV_ACTIVE: Record<HueName, string> = {
  accent: "bg-accent-surface font-medium text-accent-strong",
  amber: "bg-hue-amber-surface font-medium text-hue-amber",
  orange: "bg-hue-orange-surface font-medium text-hue-orange",
  rose: "bg-hue-rose-surface font-medium text-hue-rose",
  violet: "bg-hue-violet-surface font-medium text-hue-violet",
  blue: "bg-hue-blue-surface font-medium text-hue-blue",
  cyan: "bg-hue-cyan-surface font-medium text-hue-cyan",
  teal: "bg-hue-teal-surface font-medium text-hue-teal",
  emerald: "bg-hue-emerald-surface font-medium text-hue-emerald",
  fuchsia: "bg-hue-fuchsia-surface font-medium text-hue-fuchsia",
  lime: "bg-hue-lime-surface font-medium text-hue-lime",
};

export const HUE_BADGE: Record<HueName, string> = {
  accent: "border-accent-border bg-accent-surface text-accent-strong",
  amber: "border-hue-amber-border bg-hue-amber-surface text-hue-amber",
  orange: "border-hue-orange-border bg-hue-orange-surface text-hue-orange",
  rose: "border-hue-rose-border bg-hue-rose-surface text-hue-rose",
  violet: "border-hue-violet-border bg-hue-violet-surface text-hue-violet",
  blue: "border-hue-blue-border bg-hue-blue-surface text-hue-blue",
  cyan: "border-hue-cyan-border bg-hue-cyan-surface text-hue-cyan",
  teal: "border-hue-teal-border bg-hue-teal-surface text-hue-teal",
  emerald: "border-hue-emerald-border bg-hue-emerald-surface text-hue-emerald",
  fuchsia: "border-hue-fuchsia-border bg-hue-fuchsia-surface text-hue-fuchsia",
  lime: "border-hue-lime-border bg-hue-lime-surface text-hue-lime",
};

export const HUE_PROGRESS: Record<HueName, string> = {
  accent: "bg-accent",
  amber: "bg-hue-amber",
  orange: "bg-hue-orange",
  rose: "bg-hue-rose",
  violet: "bg-hue-violet",
  blue: "bg-hue-blue",
  cyan: "bg-hue-cyan",
  teal: "bg-hue-teal",
  emerald: "bg-hue-emerald",
  fuchsia: "bg-hue-fuchsia",
  lime: "bg-hue-lime",
};

export const HUE_TEXT: Record<HueName, string> = {
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
  lime: "text-hue-lime",
};

export const HUE_BORDER_LEFT: Record<HueName, string> = {
  accent: "border-l-accent-border",
  amber: "border-l-hue-amber-border",
  orange: "border-l-hue-orange-border",
  rose: "border-l-hue-rose-border",
  violet: "border-l-hue-violet-border",
  blue: "border-l-hue-blue-border",
  cyan: "border-l-hue-cyan-border",
  teal: "border-l-hue-teal-border",
  emerald: "border-l-hue-emerald-border",
  fuchsia: "border-l-hue-fuchsia-border",
  lime: "border-l-hue-lime-border",
};

export const HUE_BORDER_TOP: Record<HueName, string> = {
  accent: "border-t-accent-border",
  amber: "border-t-hue-amber-border",
  orange: "border-t-hue-orange-border",
  rose: "border-t-hue-rose-border",
  violet: "border-t-hue-violet-border",
  blue: "border-t-hue-blue-border",
  cyan: "border-t-hue-cyan-border",
  teal: "border-t-hue-teal-border",
  emerald: "border-t-hue-emerald-border",
  fuchsia: "border-t-hue-fuchsia-border",
  lime: "border-t-hue-lime-border",
};

export const HUE_STATCARD: Record<
  HueName,
  { container: string; value: string }
> = {
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
  lime: {
    container: "border-hue-lime-border bg-hue-lime-surface",
    value: "text-hue-lime",
  },
};
