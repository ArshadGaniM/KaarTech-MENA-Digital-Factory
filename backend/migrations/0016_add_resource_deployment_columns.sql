-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- FEAT-7: Resource Deployment gets its real schema. This is the first
-- master-data table needing TWO FK relationships at once — employee_id
-- (FK to resources.employee_id, same mechanism as resource_cost.employeeId,
-- migration 0013) and position_code (FK to positions.code, same mechanism
-- as positions.teamCode -> teams.code, migration 0015). employeeName and
-- positionName are intentionally NOT columns here — they're live lookups
-- against resources/positions at read time (see masterDataTables.js's
-- `lookups` descriptor, a two-entry array for this table), so there is
-- nothing to add/backfill for them.
--
-- resource_deployment was confirmed empty (0 rows) before this ran (see
-- system-engineer FEAT-7 output), so both required columns need no
-- sentinel default/backfill step, and the placeholder `name` column can
-- be dropped outright in the same migration rather than via database.md's
-- two-phase deprecate/remove path (that path exists to protect readers of
-- live data, which does not apply to an empty placeholder table) — same
-- reasoning 0013 used for resource_cost.

alter table public.resource_deployment
  add column employee_id integer not null,
  add column position_code text not null;

alter table public.resource_deployment
  drop column name;

-- Defense-in-depth: the app layer (validateReferences) rejects a bad
-- employeeId/positionId before the INSERT/UPDATE ever runs, but real FK
-- constraints are added too, per database.md and precedent (0013/0015).
-- Relies on resources.employee_id's and positions.code's own unique
-- indexes, which is what makes each FK meaningful. Named per database.md's
-- fk_<table>_<ref_table> convention.
alter table public.resource_deployment
  add constraint fk_resource_deployment_resources
  foreign key (employee_id) references public.resources (employee_id);

alter table public.resource_deployment
  add constraint fk_resource_deployment_positions
  foreign key (position_code) references public.positions (code);

-- database.md: "add an index on foreign keys" — also serves as the
-- join-performance index for the employeeName/positionName lookups'
-- LEFT JOINs.
create index ix_resource_deployment_employee_id on public.resource_deployment (employee_id);
create index ix_resource_deployment_position_code on public.resource_deployment (position_code);
