import type { Streak } from "@/src/modules/momentum/streaks";
import { hueFor, hueVar } from "@/src/components/moduleHues";

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
        <span
          className={isAlive && streak.activeToday ? "pulse-glow hue-glow" : ""}
          style={
            isAlive && streak.activeToday
              ? { ["--hue" as string]: hueVar(hueFor("/achievements")) }
              : undefined
          }
        >
          🔥
        </span>{" "}
        {isAlive ? `${streak.current}-day streak` : "Start a streak"}
      </p>
      {isAlive && !streak.activeToday ? (
        <p className="mt-1 text-xs text-muted">Alive, not yet fed today</p>
      ) : null}
    </div>
  );
}
