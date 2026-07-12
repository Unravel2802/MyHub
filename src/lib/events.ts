// The prep entry types, spelled out rather than imported from the Prep module:
// src/lib is the shell, and importing a module's internals here would invert the
// dependency the Event Bus exists to prevent.
type PrepType =
  | "algorithm"
  | "system_design"
  | "ml_system_design"
  | "behavioral"
  | "mock_interview";

export type AppEvent =
  | { type: "task.created"; payload: { taskId: string }; timestamp: number }
  | { type: "task.updated"; payload: { taskId: string }; timestamp: number }
  | { type: "task.completed"; payload: { taskId: string }; timestamp: number }
  | { type: "task.deleted"; payload: { taskId: string }; timestamp: number }
  // Fired on every new prep entry so the Dashboard can update running scorecard
  // totals without querying Prep Tracker's tables directly (myhub_plan.md §2.3).
  | {
      type: "prep.logged";
      payload: { entryId: string; prepType: PrepType };
      timestamp: number;
    };

type Listener = (event: AppEvent) => void;

const listeners = new Set<Listener>();

export function emit(event: AppEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}

export function on(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
