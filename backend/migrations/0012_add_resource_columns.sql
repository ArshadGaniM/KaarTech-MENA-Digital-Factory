-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Resources gets its real columns, imported from an HR export
-- ("People_Report_5.xlsx"). Unlike every other hasCode table,
-- employee_id is NOT auto-generated — it's supplied by the caller on
-- create and enforced unique at the DB level. `resources` was empty at
-- the time this ran, so NOT NULL columns needed no backfill.

alter table public.resources
  add column employee_id integer not null,
  add column org_chart text,
  add column employment_status text not null default '',
  add column employment_type text not null default '',
  add column region text,
  add column sub_division text not null default '',
  add column position text not null default '',
  add column onsite_location text,
  add column offshore_location text,
  add column location_type text not null default '',
  add column designation text not null default '',
  add column skill text,
  add column ge_batch text not null default '',
  add column kaar_experience numeric not null default 0,
  add column sap_experience numeric,
  add column total_experience numeric not null default 0;

-- Defaults only existed to let ADD COLUMN succeed against zero existing
-- rows — dropped immediately so every future insert must supply a real
-- value instead of silently getting the default.
alter table public.resources
  alter column employment_status drop default,
  alter column employment_type drop default,
  alter column sub_division drop default,
  alter column position drop default,
  alter column location_type drop default,
  alter column designation drop default,
  alter column ge_batch drop default,
  alter column kaar_experience drop default,
  alter column total_experience drop default;

alter table public.resources
  add constraint resources_employee_id_unique unique (employee_id);

alter table public.resources
  add constraint resources_location_type_check
  check (location_type in ('Onsite', 'Offshore'));
