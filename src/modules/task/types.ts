export type TaskStatus = "inbox" | "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  position: number;
  dueDate: string | null;
  parentTaskId: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
