"use client";

import { AppShell } from "@/src/components/AppShell";
import { StatCard } from "@/src/components/ui/StatCard";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
} from "@/src/modules/momentum/achievementCatalog";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import { AchievementCard } from "@/src/modules/momentum/components/AchievementCard";

const categories = ["prep", "career", "consistency"] as const;

export function AchievementsPage() {
  const { streak, unlocked } = useMomentumStore();
  const unlockedByKey = new Map(unlocked.map((item) => [item.key, item]));
  return (
    <AppShell activeHref="/achievements" title="Achievements">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <header>
          <p className="text-sm font-medium text-muted">Momentum</p>
          <h2 className="mt-1 text-3xl font-semibold">Achievements</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Visible milestones tied to the roadmap, not points or levels.
          </p>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {/* Only tint the streak once there IS one. Highlighting a zero draws
              the eye to nothing and reads as celebrating it. */}
          <StatCard
            label="Current streak"
            size="hero"
            tone={streak.current > 0 ? "accent" : "default"}
            value={`${streak.current} days`}
            hint={
              streak.current > 0 && !streak.activeToday
                ? "Log something today to keep it"
                : undefined
            }
          />
          <StatCard label="Longest streak" value={`${streak.longest} days`} />
          <StatCard
            label="Unlocked"
            tone={unlocked.length > 0 ? "success" : "default"}
            value={`${unlocked.length}/${ACHIEVEMENT_COUNT}`}
          />
        </div>
        <div className="mt-8 grid gap-8">
          {categories.map((category) => (
            <section
              aria-labelledby={`${category}-achievements`}
              key={category}
            >
              <h3
                className="text-xl font-semibold capitalize"
                id={`${category}-achievements`}
              >
                {category}
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ACHIEVEMENTS.filter((item) => item.category === category).map(
                  (achievement) => {
                    const unlock = unlockedByKey.get(achievement.key);
                    return (
                      <AchievementCard
                        achievement={achievement}
                        key={achievement.key}
                        unlock={unlock}
                      />
                    );
                  },
                )}
              </div>
            </section>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
