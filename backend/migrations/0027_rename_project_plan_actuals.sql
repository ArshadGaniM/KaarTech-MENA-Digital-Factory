-- The owner renamed the "project plan" to the "initiative plan". Migration 0026
-- is immutable, so this renames the table it created, and its constraints, to
-- match the API route and code. Rows are untouched.
alter table public.project_plan_actuals rename to initiative_plan_actuals;
alter index public.project_plan_actuals_pkey rename to initiative_plan_actuals_pkey;
alter table public.initiative_plan_actuals rename constraint ck_project_plan_actuals_start_week to ck_initiative_plan_actuals_start_week;
alter table public.initiative_plan_actuals rename constraint ck_project_plan_actuals_end_week to ck_initiative_plan_actuals_end_week;
alter table public.initiative_plan_actuals rename constraint ck_project_plan_actuals_poc to ck_initiative_plan_actuals_poc;
alter table public.initiative_plan_actuals rename constraint ck_project_plan_actuals_order to ck_initiative_plan_actuals_order;
