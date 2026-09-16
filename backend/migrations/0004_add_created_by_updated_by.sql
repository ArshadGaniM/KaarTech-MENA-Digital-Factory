-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Adds "created by" / "modified by" (CLAUDE.md's own wording — mapped to
-- updated_by to stay consistent with the existing updated_at naming) as a
-- minimum-prerequisite column pair for every master data table, alongside
-- the existing created_at/updated_at. All 6 tables were empty at the time
-- this ran, so NOT NULL needed no backfill.

alter table public.practices
  add column created_by text not null,
  add column updated_by text not null;

alter table public.delivery_centers
  add column created_by text not null,
  add column updated_by text not null;

alter table public.skill_sets
  add column created_by text not null,
  add column updated_by text not null;

alter table public.modules
  add column created_by text not null,
  add column updated_by text not null;

alter table public.resources
  add column created_by text not null,
  add column updated_by text not null;

alter table public.departments
  add column created_by text not null,
  add column updated_by text not null;
