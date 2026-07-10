export type AppEvent =
  | { type: "task.created"; payload: { taskId: string }; timestamp: number }
  | { type: "task.updated"; payload: { taskId: string }; timestamp: number }
  | { type: "task.completed"; payload: { taskId: string }; timestamp: number }
  | { type: "task.deleted"; payload: { taskId: string }; timestamp: number };

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
