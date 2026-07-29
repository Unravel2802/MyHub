import type { ReactNode } from "react";
import type { HueName } from "@/src/components/moduleHues";
import { hueVar } from "@/src/components/moduleHues";
import { HUE_STATCARD } from "@/src/components/ui/hueClasses";

// The quiet-state contract (docs/ui-upgrade-wave3.md §2.2).
//
// A stat card has three states, and the app was collapsing them into one:
//
//   value    measured, non-zero        full weight, hue and gradient allowed
//   zero     MEASURED zero             full weight, never tinted — it is data
//   pending  not yet measurable        subdued; an em-dash is not a statistic
//
// Trading renders eight of its ten tiles as `—` at value size and weight, which
// is the "sentences styled as statistics" defect docs/visual-refresh.md §1.6
// flagged. And "never tint absence" — the rule three components have broken —
// was being enforced by ten separate call sites hand-writing
// `hue={x > 0 ? h : undefined}` / `tone={x > 0 ? "accent" : "default"}`.
// A rule implemented by copy-paste ten times is a rule waiting to be forgotten,
// so the component owns it now: pass the hue and tone you want, and absence
// suppresses them for you.

interface StatCardProps {
  label: string;
  /**
   * The measured value. Pass `null` when the metric is not yet measurable — a
   * win rate with no closed trades — which renders the pending treatment rather
   * than an em-dash dressed up as a number.
   */
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
  /**
   * Force the absence treatment for a preformatted value — "$0.00", "0 / 2–3",
   * "0 days · 0 applications". `null` and numeric zero are detected on their
   * own; a string that happens to contain a zero cannot be, so say so here.
   */
  absent?: boolean;
  /**
   * What a hero shows in place of an absent value.
   *
   * "Never headline absence": the largest element on a page must not be a zero
   * or an em-dash. The Dashboard's hero currently reads
   * "0 days · 0 applications · 0 outreach" in the biggest type in the app — a
   * statement of three things you have not done, on the page you open first.
   * A quiet account is the common case for a personal tracker, so the hero
   * states the next action instead.
   *
   * Ignored when the value is present, or when size is "default".
   */
  whenAbsent?: ReactNode;
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

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  size = "default",
  interactive = false,
  hue,
  absent,
  whenAbsent,
}: StatCardProps) {
  const isHero = size === "hero";
  const isPending = value === null || value === undefined;
  const isAbsent = absent ?? (isPending || value === 0);

  // Never tint absence. Suppressed here rather than at each call site.
  const effectiveTone = isAbsent ? "default" : tone;
  const effectiveHue = isAbsent ? undefined : hue;
  const colors = effectiveHue ? HUE_STATCARD[effectiveHue] : null;

  const heroFallback = isHero && isAbsent ? whenAbsent : undefined;

  if (
    process.env.NODE_ENV !== "production" &&
    isHero &&
    isAbsent &&
    !whenAbsent
  )
    console.error(
      `StatCard("${label}"): a hero is showing an absent value with no ` +
        `\`whenAbsent\`. Never headline absence — give the hero the next ` +
        `action instead. See docs/ui-upgrade-wave3.md §2.2.`,
    );

  return (
    <div
      className={[
        "rounded-lg border transition-all duration-200 ease-in-out",
        isHero ? "px-6 py-5" : "px-4 py-3",
        colors?.container ?? toneClasses[effectiveTone],
        interactive
          ? "hover:scale-[1.02] hover:border-accent-border motion-reduce:hover:scale-100"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        effectiveHue && isHero
          ? { ["--hue" as string]: hueVar(effectiveHue) }
          : undefined
      }
    >
      {/* The overline: uppercase, wide-tracked, muted. min-h keeps a two-line
          label ("ML system design") from dropping its value a line below the
          tiles beside it — the Prep scorecard row visibly broke because of this. */}
      <p className="min-h-[2rem] text-xs font-medium uppercase leading-4 tracking-widest text-muted">
        {label}
      </p>
      {heroFallback ? (
        // Prose, not a number: no tabular-nums, and a size that reads as a
        // sentence while still carrying the page.
        <p
          className="mt-1 text-2xl font-semibold tracking-tight text-foreground"
          data-stat-value
        >
          {heroFallback}
        </p>
      ) : isPending ? (
        // An em-dash is the absence of a statistic, so it must not be set like
        // one. Label weight, subtle colour — the `hint` beside it carries the
        // meaning. The text stays exactly "—": tests/ui/trading.spec.ts matches
        // it with `getByText("—", { exact: true })`.
        <p
          className="mt-1 text-base font-normal leading-8 text-subtle"
          data-stat-value
        >
          —
        </p>
      ) : (
        // tabular-nums so a value ticking 9 -> 10 doesn't shift the tile's width
        <p
          className={[
            "font-semibold tabular-nums tracking-tight",
            isHero ? "mt-1 text-5xl" : "mt-1 text-2xl",
            isHero && effectiveHue ? "hue-gradient-text" : "",
            colors?.value ?? valueClasses[effectiveTone],
          ].join(" ")}
          // Lets tests/ui/page-contract.spec.ts read the value on its own,
          // without the label and hint around it. That is what makes "never
          // headline absence" checkable for preformatted values — a hero whose
          // value is a template string ("0 days · 0 applications") is invisible
          // to the null/zero detection above, and every real hero in this app
          // is exactly that.
          data-stat-value
        >
          {value}
        </p>
      )}
      {hint ? (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
