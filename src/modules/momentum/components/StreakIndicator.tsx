import type { Streak } from "@/src/modules/momentum/streaks";

export function StreakIndicator({ streak }: { streak: Streak }) {
  const isAlive = streak.current > 0;
  return (
    <div
      aria-label={`${streak.current}-day streak`}
      className={
        isAlive && streak.activeToday ? "text-accent-strong" : "text-muted"
      }
    >
      <p className="text-sm font-semibold">
        {isAlive ? `🔥 ${streak.current}-day streak` : "🔥 Start a streak"}
      </p>
      {isAlive && !streak.activeToday ? (
        <p className="mt-1 text-xs text-muted">Alive, not yet fed today</p>
      ) : null}
    </div>
  );
}
