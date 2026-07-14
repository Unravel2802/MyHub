// Union members spelled out rather than imported from their owning module:
// src/lib is the shell, and importing a module's internals here would invert the
// dependency the Event Bus exists to prevent.
type PrepType =
  | "algorithm"
  | "system_design"
  | "ml_system_design"
  | "behavioral"
  | "mock_interview"
  | "resume_deep_dive";

type ApplicationStage =
  | "researching"
  | "applied"
  | "oa"
  | "phone_screen"
  | "onsite"
  | "offer"
  | "rejected"
  | "withdrawn";

export type AppEvent =
  | { type: "task.created"; payload: { taskId: string }; timestamp: number }
  | { type: "task.updated"; payload: { taskId: string }; timestamp: number }
  | { type: "task.completed"; payload: { taskId: string }; timestamp: number }
  // Fired when a task leaves "done" — reopened from the archive, dragged out of
  // the Done column, or its status set back. Distinct from task.updated (which
  // fires on any edit) because this is the only transition that can REMOVE a
  // day of activity, and Momentum has to recompute the streak when it happens.
  // Without it the streak could only ever grow.
  | { type: "task.uncompleted"; payload: { taskId: string }; timestamp: number }
  | { type: "task.deleted"; payload: { taskId: string }; timestamp: number }
  // Fired on every new prep entry so the Dashboard can update running scorecard
  // totals without querying Prep Tracker's tables directly (myhub_plan.md Part A §A.2).
  | {
      type: "prep.logged";
      payload: { entryId: string; prepType: PrepType };
      timestamp: number;
    }
  // Fired on every Applications.stage transition — not on every update, only when
  // `stage` actually changes value (myhub_plan.md Part A §A.2).
  | {
      type: "application.stage_changed";
      payload: {
        applicationId: string;
        fromStage: ApplicationStage;
        toStage: ApplicationStage;
      };
      timestamp: number;
    }
  // Fired when an Interviews row's `completed` flips false -> true (not on every
  // update to a completed interview). The Dashboard uses this to surface a
  // "log a post-mortem" reminder within the roadmap's 24-hour window (§11.2).
  | {
      type: "interview.completed";
      payload: { interviewId: string; applicationId: string };
      timestamp: number;
    }
  // Fired on every new outreach entry. Added in Wave 2 Phase 5: Momentum needs
  // to know an outreach conversation happened today (it counts as an active day
  // for the streak), and the Dashboard's weekly cadence panel had been reading
  // outreach without an event to refresh on.
  | {
      type: "outreach.logged";
      payload: { entryId: string };
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
