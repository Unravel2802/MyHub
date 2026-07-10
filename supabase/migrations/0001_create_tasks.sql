-- Task Engine: tasks table
-- See specs/task-module-spec.md

create type task_status as enum ('inbox', 'todo', 'in_progress', 'done');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status task_status not null default 'inbox',
  position numeric not null default 0,
  due_date date,
  parent_task_id uuid references tasks (id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_parent_task_id_idx on tasks (parent_task_id);
create index tasks_status_idx on tasks (status) where deleted_at is null;

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_set_updated_at
  before update on tasks
  for each row
  execute function set_updated_at();
