# Task Engine — Module Spec

## 1. Purpose
This module is designed for just one user (me). It will help me to organizing my works, organizing tasks, and it will be based on Kanban project management board.

## 2. Data Model

### Tasks table
| Column | Type | Notes |
|---|---|---|
| id | uuid | primary key |
| title | text | required |
| status | enum | inbox, todo, in_progress, done |
| position | numeric/int | ordering within a Kaban column | 
| due_date | date | changeable |
| parent_task_id | uuid, nullable | self-referencing FK for subtasks |
| deleted_at | timestamptz, nullable | soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

No tags for tasks (for now)
## 3. Statuses & Transitions
Inbox → Todo → In Progress → Done.
A task can move "freely" (either forward, backward, or skip a column) → drag and drop tasks

## 4. Subtasks Rules
A subtask can have its own subtasks (multi-level nesting, but maximum of 3 levels), completing all subtasks will auto-complete the parent, but when a new subtask is created,
the status of the parent tasks will return to incomplete.
Deleting a parent will soft-delete its children too. \
Auto-complete and soft-delete cascade recursively through the full ancestor/descendant chain, not just one level.
Display: subtasks will be nested inside the parent cared
## 5. Recurring Tasks
[Out of scope for MVP? If in scope: separate RecurrenceRule table or generator job — which?]

No recurring tasks in MVP — deferred to a future sprint.

## 6. Store Shape (useTaskStore)
States: tasks[], isLoading, error, selected column filters \
Actions: createTask, reorderTask, updateTask, deleteTask, updateStatus

## 7. Optimistic UI Behavior
Drag the task in a box (dnd kit) and put it in a column.
Desire user flow: quick task create → automatically go to inbox → choose what task to do (maybe for that week? that day?) → to do (and the rest is just normal work flow) \
DB failure → show a message create task failed, please try again later for user while send the error message to the backend for debug → snap back to original column

## 8. Events Emitted
Candidate events: task.created, task.updated, task.completed, task.deleted — payload shape TBD in src/lib/events.ts, needs Architect sign-off.

## 9. Out of Scope (explicitly)
[What this spec does NOT cover, to prevent scope creep — e.g. no notifications,
 no recurring tasks yet, no drag-and-drop library chosen yet]

No recurring tasks yet, no notifications yet