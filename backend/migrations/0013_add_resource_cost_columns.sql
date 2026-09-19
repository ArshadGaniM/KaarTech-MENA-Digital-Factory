-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Resource Cost gets its real schema: employee_id (FK to
-- resources.employee_id, enforced at both the app layer via
-- validateExists and here at the DB layer as defense-in-depth) plus
-- independently-optional offshore_cost/onsite_cost. employeeName/
-- employeeDesignation are intentionally NOT columns here — they are a
-- live lookup against resources at read time (see masterDataTables.js's
-- `lookups` descriptor), so there is nothing to add/backfill for them.
-- resource_cost was confirmed empty (0 rows) before this ran, so the
-- required employee_id column needs no sentinel default/backfill step,
-- and the placeholder `name` column can be dropped outright in the same
-- migration rather than via database.md's two-phase deprecate/remove
-- path (that path exists to protect readers of live data, which does
-- not apply to an empty placeholder table).

alter table public.resource_cost
  add column employee_id integer not null,
  add column offshore_cost numeric,
  add column onsite_cost numeric;

alter table public.resource_cost
  drop column name;

-- Defense-in-depth: the app layer (validateExists) rejects a bad
-- employeeId before the INSERT/UPDATE ever runs, but a real FK
-- constraint is added too, per database.md and tech-lead's direction.
-- Relies on resources.employee_id's own unique constraint (migration
-- 0012), which is what makes this FK meaningful. Named per database.md's
-- fk_<table>_<ref_table> convention (architecture-critic FEAT-5 advisory
-- finding #1), not the earlier `resource_cost_employee_id_fkey` draft.
alter table public.resource_cost
  add constraint fk_resource_cost_resources
  foreign key (employee_id) references public.resources (employee_id);

-- database.md: "add an index on foreign keys" — also serves as the
-- join-performance index for the employeeName/employeeDesignation
-- lookup's LEFT JOIN.
create index ix_resource_cost_employee_id on public.resource_cost (employee_id);
