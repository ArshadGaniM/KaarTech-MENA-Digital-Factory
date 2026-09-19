-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Teams gets its real schema: an auto-generated, immutable business code
-- (TEAM-001, TEAM-002, ...), same pattern as departments (0007) and
-- practices (0009); name stays as-is (already exists, now user-editable
-- instead of a placeholder); and a required department_code column, a
-- pick-list FK to departments.code (NOT departments.id) enforced at the
-- app layer via masterDataSchema.js's validateReferences() and here at
-- the DB layer as defense-in-depth, mirroring resource_cost's employee_id
-- FK (migration 0013). departmentName is intentionally NOT a column here
-- — it's a live lookup against departments at read time (see
-- masterDataTables.js's `lookups` descriptor), so there's nothing to
-- add/backfill for it.
--
-- teams was confirmed empty (0 rows) before this ran, so the required
-- department_code column needs no sentinel default/backfill step (same
-- justification as 0013's employee_id add).

alter table public.teams
  add column code text,
  add column department_code text not null;

create sequence public.teams_code_seq;

create or replace function public.set_team_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is null then
    new.code := 'TEAM-' || lpad(nextval('teams_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_teams_code before insert on public.teams
  for each row execute function public.set_team_code();

create unique index ix_teams_code on public.teams (code);

-- Defense-in-depth: the app layer (validateReferences) rejects a bad
-- departmentCode before the INSERT/UPDATE ever runs, but a real FK
-- constraint is added too, per database.md and tech-lead's direction.
-- Relies on departments.code's own unique index (migration 0007), which
-- is what makes this FK meaningful. Named per database.md's
-- fk_<table>_<ref_table> convention (per FEAT-5's architecture-critic
-- finding, applied consistently here from the start).
alter table public.teams
  add constraint fk_teams_departments
  foreign key (department_code) references public.departments (code);

-- database.md: "add an index on foreign keys" — also serves as the
-- join-performance index for the departmentName lookup's LEFT JOIN.
create index ix_teams_department_code on public.teams (department_code);
