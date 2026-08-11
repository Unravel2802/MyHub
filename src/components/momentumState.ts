"use client";

import { useMomentumStore } from "@/src/modules/momentum/useMomentumStore";
import type { ActivityGrid } from "@/src/modules/momentum/activityGrid";
import type { Streak } from "@/src/modules/momentum/streaks";

// Momentum is SHELL-LEVEL state, and this file is where that becomes explicit.
//
// AppShell mounts `useMomentumStore` once, on every page, because the streak
// indicator lives in the nav rail. So by the time any page renders, the streak
// and activity grid are already fetched and already subscribed to updates.
//
// That put two pages in an awkward spot. Architecture rule 1 says a module
// never imports another module's internals, and this repo's own refinement of
// it (useMomentumStore.ts) says cross-module reads go through the other
// module's REPOSITORY, never its store. But Dashboard and Roadmap were both
// importing `useMomentumStore` directly — and routing them through
// MomentumRepository instead would have been worse, not better: a second fetch
// of data the shell already has, and a snapshot that stops reacting when an
// achievement unlocks.
//
// The honest reading is that those pages weren't reaching into a sibling
// module at all — they were reading state the SHELL owns and mounts. So the
// shell exposes it, here, and the boundary rule (eslint.config.mjs) can then
// say plainly: modules import no other module's store, no exceptions. Shell ->
// module imports stay allowed, exactly as AppShell's own note describes.
//
// Selectors, not the whole store: a component that only needs the streak
// shouldn't re-render when the activity grid refetches.

/** The current streak. Already loaded — AppShell fetched it. */
export function useStreak(): Streak {
  return useMomentumStore((state) => state.streak);
}

/** The contribution grid backing `<ActivityHeatmap />`. */
export function useActivityGrid(): ActivityGrid {
  return useMomentumStore((state) => state.activityGrid);
}
