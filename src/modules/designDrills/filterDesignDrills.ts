import type {
  DesignDrill,
  DesignDrillCategory,
  DesignDrillDifficulty,
} from "@/src/modules/designDrills/types";

export interface DesignDrillFilters {
  bookmarkedOnly: boolean;
  category: DesignDrillCategory | "all";
  difficulty: DesignDrillDifficulty | "all";
  query: string;
  tag: string | null;
}

export function filterDesignDrills(
  drills: DesignDrill[],
  filters: DesignDrillFilters,
  isBookmarked: (drillId: string) => boolean,
): DesignDrill[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return drills.filter((drill) => {
    if (filters.category !== "all" && drill.category !== filters.category)
      return false;
    if (filters.difficulty !== "all" && drill.difficulty !== filters.difficulty)
      return false;
    if (filters.bookmarkedOnly && !isBookmarked(drill.id)) return false;
    if (filters.tag && !drill.tags.includes(filters.tag)) return false;
    if (!query) return true;

    return [drill.title, drill.prompt, ...drill.tags]
      .join(" ")
      .toLocaleLowerCase()
      .includes(query);
  });
}
