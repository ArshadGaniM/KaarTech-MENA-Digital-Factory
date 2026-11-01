-- Range rules belong in a check constraint as well as in the API (database.md):
-- the same limits the descriptor enforces for Planned Resource Cost.
alter table public.planned_resource_costs
  add constraint ck_planned_resource_costs_designation_length check (char_length(designation) <= 100),
  add constraint ck_planned_resource_costs_grade_length check (char_length(grade) <= 20),
  add constraint ck_planned_resource_costs_offshore_cost_max check (offshore_cost <= 1000000),
  add constraint ck_planned_resource_costs_onsite_cost_max check (onsite_cost <= 1000000);
