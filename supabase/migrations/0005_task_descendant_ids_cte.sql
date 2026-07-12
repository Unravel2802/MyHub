-- Task Engine: recursive descendant lookup via a CTE
-- See myhub_plan.md §2.3: "Use a recursive CTE to resolve the descendant set;
-- don't loop application-side."
--
-- Replaces TaskRepository's collectDescendantIds, which walked the tree one
-- level at a time via repeated round-trips. That was correct but did N queries
-- for an N-level-deep subtree; this does one.

create function task_descendant_ids(root_id uuid)
returns table (id uuid)
language sql
stable
as $$
  with recursive descendants as (
    select tasks.id
    from tasks
    where tasks.parent_task_id = root_id
      and tasks.deleted_at is null

    union all

    select tasks.id
    from tasks
    inner join descendants on tasks.parent_task_id = descendants.id
    where tasks.deleted_at is null
  )
  select descendants.id from descendants;
$$;

-- The base case filters on parent_task_id, so it needs the same rows the
-- existing tasks_parent_task_id_idx (migration 0001) already serves — no new
-- index required.
