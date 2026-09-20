-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- FEAT-10: Projects is a brand-new master-data table (not an existing
-- placeholder getting upgraded), created with its full real shape in one
-- shot, same reasoning as Positions (0015) — the table starts empty so
-- there's no existing-row backfill concern.
--
-- Unlike every hasCode table (practices/delivery_centers/departments/
-- teams/positions), Projects has NO auto-generated business code: all
-- three business fields (projectId, projectName, projectProfitCenterCode)
-- are manually entered by the caller, confirmed explicitly by the owner.
-- projectId follows the same pattern as resources.employeeId (migration
-- 0012): a caller-supplied, DB-enforced-unique identifier, not the uuid
-- `id` primary key every table has regardless. No FK/lookup fields — no
-- reference table was named for projectProfitCenterCode, so it's a plain
-- string column.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  project_name text not null,
  project_profit_center_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint projects_created_by_length check (char_length(created_by) <= 255),
  constraint projects_updated_by_length check (char_length(updated_by) <= 255)
);

create trigger trg_projects_updated_at before update on public.projects
  for each row execute function set_updated_at();

alter table public.projects enable row level security;

-- No `name` column here (unlike every hasCode table) — sortColumn is
-- overridden to project_id in masterDataTables.js, so this indexes the
-- actual sort/lookup column rather than a column that doesn't exist.
create index ix_projects_project_id on public.projects (project_id) where deleted_at is null;

-- Caller-supplied identifier, enforced unique at the DB level — same
-- mechanism as resources.employee_id (migration 0012's
-- resources_employee_id_unique).
alter table public.projects
  add constraint projects_project_id_unique unique (project_id);
