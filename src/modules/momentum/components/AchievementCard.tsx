import { Badge } from "@/src/components/ui/Badge";
import type { CSSProperties } from "react";
import type { Achievement } from "@/src/modules/momentum/achievementCatalog";
import type { AchievementUnlock } from "@/src/modules/momentum/MomentumRepository";
import { ACHIEVEMENT_CATEGORY_HUES } from "@/src/modules/momentum/achievementCategoryHues";
import { hueVar, type HueName } from "@/src/components/moduleHues";

const categoryBorderClasses: Record<HueName, string> = {
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

export function AchievementCard({
  achievement,
  unlock,
  style,
}: {
  achievement: Achievement;
  unlock?: AchievementUnlock;
  style?: CSSProperties;
}) {
  const categoryHue = ACHIEVEMENT_CATEGORY_HUES[achievement.category];
  const cardStyle = unlock
    ? {
        ...style,
        ["--hue" as string]: hueVar(categoryHue),
      }
    : style;

  return (
    <article
      className={`fade-up rounded-lg border border-l-4 p-4 transition-colors ${categoryBorderClasses[categoryHue]} ${
        unlock
          ? "border-success-border bg-success-surface hue-glow"
          : "border-border bg-surface-subtle"
      }`}
      style={cardStyle}
      key={achievement.key}
    >
      <div className="flex items-start justify-between gap-3">
        <h4
          className={
            unlock ? "font-semibold text-foreground" : "font-semibold text-body"
          }
        >
          {achievement.title}
        </h4>
        {unlock ? <Badge tone="success">Unlocked</Badge> : null}
      </div>
      <p className="mt-2 text-sm text-muted">{achievement.description}</p>
      <p className="mt-3 text-xs text-muted">
        {unlock
          ? `Unlocked ${new Date(unlock.unlockedAt).toLocaleDateString()}`
          : achievement.source}
      </p>
    </article>
  );
}
