"use client";

import { AppShell } from "@/src/components/AppShell";
import { PageHeader } from "@/src/components/ui/PageHeader";
import { StatCard } from "@/src/components/ui/StatCard";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
} from "@/src/modules/momentum/achievementCatalog";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import { AchievementCard } from "@/src/modules/momentum/components/AchievementCard";
import { hueFor } from "@/src/components/moduleHues";
import type { HueName } from "@/src/components/moduleHues";
import { ACHIEVEMENT_CATEGORY_HUES } from "@/src/modules/momentum/achievementCategoryHues";

const categories = ["prep", "career", "consistency"] as const;

const categoryHeadingClasses: Record<HueName, string> = {
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

export function AchievementsPage() {
  const { streak, unlocked } = useMomentumStore();
  const unlockedByKey = new Map(unlocked.map((item) => [item.key, item]));
  return (
    <AppShell activeHref="/achievements" title="Achievements">
      <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          bleed
          description="Visible milestones tied to the roadmap, not points or levels."
          eyebrow="Momentum"
          hue={hueFor("/achievements")}
          title="Achievements"
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {/* Only tint the streak once there IS one. Highlighting a zero draws
              the eye to nothing and reads as celebrating it. */}
          <StatCard
            label="Current streak"
            hue={streak.current > 0 ? hueFor("/achievements") : undefined}
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
                className={`text-xl font-semibold capitalize ${categoryHeadingClasses[ACHIEVEMENT_CATEGORY_HUES[category]]}`}
                id={`${category}-achievements`}
              >
                {category}
              </h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {ACHIEVEMENTS.filter((item) => item.category === category).map(
                  (achievement, index) => {
                    const unlock = unlockedByKey.get(achievement.key);
                    return (
                      <AchievementCard
                        achievement={achievement}
                        key={achievement.key}
                        style={{ ["--i" as string]: index }}
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
