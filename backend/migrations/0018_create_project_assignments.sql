-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- FEAT-11: Project Assignments is a brand-new master-data table, created
-- with its full real shape in one shot (same reasoning as Positions/0015
-- and Projects/0017 — the table starts empty).
--
-- No `name` column and no `hasCode` trigger — this table has no single
-- business-identifier field of its own; projectId/teamId are both
-- pick-list-only FK references, not caller-supplied or auto-generated
-- identifiers. TWO foreign keys at once (same shape as
-- resource_deployment/0016): project_id -> projects.project_id and
-- team_code -> teams.code. departmentId/departmentName are NOT stored
-- columns here at all — they're resolved via a chained/transitive lookup
-- through teams.department_code (see masterDataTables.js's `via: "teams"`
-- lookup entry), so there is nothing to add a column for.
--
-- project_assignment_start_date/end_date are plain `date` columns (no
-- time-of-day component was specified). A CHECK constraint enforces
-- end >= start at the DB layer too, as defense-in-depth mirroring the
-- app-layer validateCrossFields() check — same "belt and suspenders"
-- reasoning already used for every FK (app-layer validateReferences() +
-- DB-layer FK constraint).

create table public.project_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  team_code text not null,
  project_assignment_start_date date not null,
  project_assignment_end_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint project_assignments_created_by_length check (char_length(created_by) <= 255),
  constraint project_assignments_updated_by_length check (char_length(updated_by) <= 255),
  constraint project_assignments_end_not_before_start
    check (project_assignment_end_date >= project_assignment_start_date)
);

create trigger trg_project_assignments_updated_at before update on public.project_assignments
  for each row execute function set_updated_at();

alter table public.project_assignments enable row level security;

create index ix_project_assignments_project_id on public.project_assignments (project_id) where deleted_at is null;
create index ix_project_assignments_team_code on public.project_assignments (team_code) where deleted_at is null;

-- Defense-in-depth, same reasoning/precedent as every prior FK'd table
-- (0013/0014/0015/0016). Relies on projects.project_id's own unique index
-- (0017) and teams.code's own unique index (0014).
alter table public.project_assignments
  add constraint fk_project_assignments_projects
  foreign key (project_id) references public.projects (project_id);

alter table public.project_assignments
  add constraint fk_project_assignments_teams
  foreign key (team_code) references public.teams (code);
