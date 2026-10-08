"use client";

import { format, parseISO } from "date-fns";
import type { LeetCodeDayGroup } from "@/src/modules/leetcode/leetcodeBoard";
import { difficultyLabels } from "@/src/modules/leetcode/components/leetcodeUi";
import { LEETCODE_DIFFICULTY_HUES } from "@/src/modules/leetcode/leetcodeHues";
import { Badge } from "@/src/components/ui/Badge";
import { cn } from "@/src/lib/cn";
import type { HueName } from "@/src/components/moduleHues";
import { HUE_BORDER_LEFT } from "@/src/components/ui/hueClasses";

interface LeetCodeDayHeaderProps {
  collapsed: boolean;
  group: LeetCodeDayGroup;
  isToday: boolean;
  moduleHue: HueName;
  onToggle: () => void;
  showFullDate: boolean;
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="grid justify-items-end gap-0.5">
      <span className="text-[0.65rem] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-semibold tabular-nums text-body">{value}</span>
    </span>
  );
}

export function LeetCodeDayHeader({
  collapsed,
  group,
  isToday,
  moduleHue,
  onToggle,
  showFullDate,
}: LeetCodeDayHeaderProps) {
  const fullDate =
    showFullDate && group.date !== null
      ? format(parseISO(group.date), "EEE, MMM d")
      : null;
  const toReview = group.byStatus.to_review + group.byStatus.needs_revisit;

  return (
    <tr>
      <td
        className={cn(
          "border-l-2 bg-surface-subtle px-3 py-3",
          isToday ? HUE_BORDER_LEFT[moduleHue] : "border-l-border",
        )}
        colSpan={6}
      >
        <button
          aria-expanded={!collapsed}
          className="grid w-full gap-3 text-left md:grid-cols-[minmax(11rem,1fr)_auto_auto] md:items-center"
          onClick={onToggle}
          type="button"
        >
          <span className="grid gap-0.5">
            <span className="font-semibold text-foreground">{group.label}</span>
            {fullDate ? (
              <span className="text-xs text-muted">{fullDate}</span>
            ) : null}
          </span>

          <span className="flex flex-wrap gap-1.5">
            {(
              Object.keys(group.byDifficulty) as Array<
                keyof typeof group.byDifficulty
              >
            )
              .filter((difficulty) => group.byDifficulty[difficulty] > 0)
              .map((difficulty) => (
                <Badge
                  hue={LEETCODE_DIFFICULTY_HUES[difficulty]}
                  key={difficulty}
                >
                  {group.byDifficulty[difficulty]}{" "}
                  {difficultyLabels[difficulty]}
                </Badge>
              ))}
          </span>

          <span className="flex flex-wrap justify-start gap-x-4 gap-y-2 md:justify-end">
            <Stat label="Problems" value={group.problems.length} />
            <Stat label="Solved" value={group.byStatus.solved} />
            <Stat label="To review" value={toReview} />
            {group.date !== null ? (
              <Stat label="Time" value={formatTime(group.timeMin)} />
            ) : null}
          </span>
        </button>
      </td>
    </tr>
  );
}
