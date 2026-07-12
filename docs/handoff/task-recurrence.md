# Handoff — Task Engine weekly recurrence (Claude Code → Codex)

Published contract. Everything below is decided; none of it is yours to redesign. If something
here is wrong or missing, **flag it — do not patch around it** (`AGENTS.md`, capacity amendment).

## What's already landed

| File                                           | State                                                      |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `supabase/migrations/0002_task_recurrence.sql` | Done — apply it in the Supabase SQL editor before testing  |
| `src/modules/task/types.ts`                    | Done — `Task` gained the recurrence fields, plus `Weekday` |
| `src/modules/task/taskRecurrence.ts`           | Done — pure decision logic, no DB                          |
| `src/modules/task/taskRecurrence.test.ts`      | Done — 9 unit tests, all passing                           |
| `TaskRepository.createTask`                    | Done — accepts `description`, `recursWeekly`, `weekday`    |
| `TaskRepository.getTasks`                      | Done — now excludes templates                              |
| `useTaskStore.createTask`                      | Done — templates are kept out of `tasks[]`                 |

## The model, in one paragraph

A task row with `recurs_weekly = true` is a **template**: a rule, not a work item. It never
appears on the board and is never completed. Each week it generates an **instance** — an ordinary
task carrying `recurrence_template_id` and `occurrence_date` — and _that_ is what you drag,
complete, and see. The split exists because completing a recurring task would otherwise destroy
the rule that regenerates it. Instances land in `todo` (a fixed schedule block is already triaged;
`inbox` means "needs a decision") with `due_date` set to the occurrence date, which is how the
Dashboard will later query "this week's schedule blocks".

## Your work

### 1. `TaskRepository.regenerateWeeklyInstances(today)` — currently throws `not implemented`

The step-by-step contract is in the doc comment above the stub. The two things that will bite you
if you skip them:

- **`existingKeys` must include soft-deleted instances.** A deleted instance means "I'm not doing
  it this week" — if you filter `deleted_at is null` when building that set, next page load
  resurrects the block the user just dismissed, _and_ the insert dies on the unique index.
- **A Postgres unique violation (`23505`) on `tasks_one_instance_per_occurrence` is success, not
  failure.** It means a concurrent load already created that occurrence. Skip the row; do not
  surface an error banner.

### 2. `TaskRepository.getTemplates()` — currently throws `not implemented`

`recurs_weekly = true`, `deleted_at is null`. Straightforward.

### 3. Wire regeneration into `useTaskStore.fetchTasks`

Call `regenerateWeeklyInstances()` before `getTasks()`. Regeneration failing should **not** blank
the board: log it, set `error`, and still render whatever `getTasks()` returns. A missing weekly
block is an annoyance; an empty board looks like data loss.

> **Contract gap closed (Codex flagged this — correctly).** The store exposed no way to read or
> delete templates, so the "manage recurring rules" surface below was unbuildable without a
> component reaching into the repository, which the architecture forbids. `useTaskStore` now has
> `templates: Task[]`, `fetchTemplates()`, and `deleteTemplate(id)`, and `createTask` with
> `recursWeekly` now files the new rule into `templates` instead of dropping it. Those three are
> **implemented, not stubs** — they only need `TaskRepository.getTemplates()` underneath them.
> **Rebase onto this commit before you start**; it touches `useTaskStore.ts`, which your plan also
> edits.

### 4. UI (yours by default)

- Quick-capture form: a "repeats weekly" checkbox plus a weekday select (0 = Sunday, matching
  `Date.getDay()`), feeding `createTask({ recursWeekly: true, weekday })`.
- A surface to see and delete recurring rules, backed by `getTemplates()`. Deleting a template
  should stop future generation; existing instances stay (they're real work you may still do).
- On a task card, mark instances visibly as recurring — otherwise "why did this come back?" is
  confusing.

### 5. Tests

Unit tests for the repository/store wiring above (`taskRecurrence.ts` itself is already covered —
don't re-test the date math). Extend `tests/ui/supabaseTasksMock.ts` for the instance rows.

## Not yours (Claude Code is doing these)

- Migration `0003`: replacing the application-side descendant loop in `collectDescendantIds` with
  a recursive CTE, per `myhub_plan.md` §2.3.
- Row Level Security. There is none today, and the anon key currently grants public read/write to
  `tasks`. This gets worse the moment Job CRM stores rejections and interview notes.
