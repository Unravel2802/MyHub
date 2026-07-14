import { Badge } from "@/src/components/ui/Badge";
import type { CSSProperties } from "react";
import type { Achievement } from "@/src/modules/momentum/achievementCatalog";
import type { AchievementUnlock } from "@/src/modules/momentum/MomentumRepository";

export function AchievementCard({
  achievement,
  unlock,
  style,
}: {
  achievement: Achievement;
  unlock?: AchievementUnlock;
  style?: CSSProperties;
}) {
  return (
    <article
      className={`fade-up rounded-lg border p-4 transition-colors ${
        unlock
          ? "border-success-border bg-success-surface"
          : "border-border bg-surface-subtle"
      }`}
      style={style}
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
