import { Badge } from "@/src/components/ui/Badge";
import type { Achievement } from "@/src/modules/momentum/achievementCatalog";
import type { AchievementUnlock } from "@/src/modules/momentum/MomentumRepository";

export function AchievementCard({
  achievement,
  unlock,
}: {
  achievement: Achievement;
  unlock?: AchievementUnlock;
}) {
  return (
    <article
      className={`rounded-lg border p-4 transition-colors ${
        unlock
          ? "border-success-border bg-success-surface"
          : "border-border bg-surface-subtle"
      }`}
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
