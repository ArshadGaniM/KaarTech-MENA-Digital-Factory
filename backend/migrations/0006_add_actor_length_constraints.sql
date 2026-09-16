-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Defense-in-depth for the app-layer 255-char cap on created_by/updated_by
-- (backend/src/masterDataSchema.js's validateBody/validateActor) —
-- database-specialist gate finding: those columns were unbounded text
-- with no length guard anywhere.

alter table public.practices
  add constraint practices_created_by_length check (char_length(created_by) <= 255),
  add constraint practices_updated_by_length check (char_length(updated_by) <= 255);

alter table public.delivery_centers
  add constraint delivery_centers_created_by_length check (char_length(created_by) <= 255),
  add constraint delivery_centers_updated_by_length check (char_length(updated_by) <= 255);

alter table public.skill_sets
  add constraint skill_sets_created_by_length check (char_length(created_by) <= 255),
  add constraint skill_sets_updated_by_length check (char_length(updated_by) <= 255);

alter table public.modules
  add constraint modules_created_by_length check (char_length(created_by) <= 255),
  add constraint modules_updated_by_length check (char_length(updated_by) <= 255);

alter table public.resources
  add constraint resources_created_by_length check (char_length(created_by) <= 255),
  add constraint resources_updated_by_length check (char_length(updated_by) <= 255);

alter table public.departments
  add constraint departments_created_by_length check (char_length(created_by) <= 255),
  add constraint departments_updated_by_length check (char_length(updated_by) <= 255);
