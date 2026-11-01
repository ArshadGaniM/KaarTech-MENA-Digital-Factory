-- database.md asks for the set_updated_at() trigger on every table with
-- updated_at, and says created_by and updated_by are plain `text not null`.
-- The router always sets both actors, so the personal-name defaults from 0026
-- only hid writes from other paths.
create trigger trg_initiative_plan_actuals_updated_at
  before update on public.initiative_plan_actuals
  for each row execute function set_updated_at();

alter table public.initiative_plan_actuals alter column created_by drop default;
alter table public.initiative_plan_actuals alter column updated_by drop default;
