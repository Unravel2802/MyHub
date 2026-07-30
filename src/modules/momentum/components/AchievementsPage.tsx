"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { PageTemplate } from "@/src/components/ui/PageTemplate";
import { StatCard } from "@/src/components/ui/StatCard";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_COUNT,
} from "@/src/modules/momentum/achievementCatalog";
import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import { AchievementCard } from "@/src/modules/momentum/components/AchievementCard";
import { hueFor } from "@/src/components/moduleHues";
import { HUE_TEXT } from "@/src/components/ui/hueClasses";
import { ACHIEVEMENT_CATEGORY_HUES } from "@/src/modules/momentum/achievementCategoryHues";
import { register, unregister } from "@/src/lib/commandPalette";
import { registerShortcuts, unregisterShortcuts } from "@/src/lib/shortcuts";

const categories = ["prep", "career", "consistency"] as const;

export function AchievementsPage() {
  const router = useRouter();
  const { streak, unlocked } = useMomentumStore();
  const unlockedByKey = new Map(unlocked.map((item) => [item.key, item]));

  useEffect(() => {
    register("achievements", [
      {
        id: "go-to-page",
        label: "Go to Achievements",
        keywords: ["achievements", "momentum", "streaks"],
        action: () => router.push("/achievements"),
      },
      {
        id: "browse-catalog",
        label: "Browse achievement catalog",
        keywords: ["achievements", "catalog", "milestones"],
        action: () =>
          document
            .getElementById("achievement-catalog")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      },
    ]);
    registerShortcuts("achievements", [
      {
        combo: "g a",
        commandId: "achievements.go-to-page",
        description: "Open achievements",
      },
      {
        combo: "b a",
        commandId: "achievements.browse-catalog",
        description: "Browse achievements",
      },
    ]);
    return () => {
      unregisterShortcuts("achievements");
      unregister("achievements");
    };
  }, [router]);
  return (
    <PageTemplate
      description="Visible milestones tied to the roadmap, not points or levels."
      eyebrow="Momentum"
      hero={
        /* Only tint the streak once there IS one. Highlighting a zero draws
           the eye to nothing and reads as celebrating it. */
        <StatCard
          absent={streak.current === 0}
          label="Current streak"
          hue={streak.current > 0 ? hueFor("/achievements") : undefined}
          size="hero"
          tone={streak.current > 0 ? "accent" : "default"}
          value={`${streak.current} days`}
          whenAbsent="Start today's streak"
          hint={
            streak.current > 0 && !streak.activeToday
              ? "Log something today to keep it"
              : undefined
          }
        />
      }
      href="/achievements"
      icon={Flame}
      stats={[
        <StatCard
          key="longest-streak"
          label="Longest streak"
          value={`${streak.longest} days`}
        />,
        <StatCard
          key="unlocked"
          label="Unlocked"
          tone={unlocked.length > 0 ? "success" : "default"}
          value={`${unlocked.length}/${ACHIEVEMENT_COUNT}`}
        />,
      ]}
      title="Achievements"
    >
      <div className="grid gap-8" id="achievement-catalog">
        {categories.map((category) => (
          <section aria-labelledby={`${category}-achievements`} key={category}>
            <h3
              className={`text-xl font-semibold capitalize ${HUE_TEXT[ACHIEVEMENT_CATEGORY_HUES[category]]}`}
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
    </PageTemplate>
  );
}
