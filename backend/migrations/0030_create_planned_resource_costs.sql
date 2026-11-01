-- Planned Resource Cost: a monthly cost in USD for each employee designation,
-- split by offshore and onsite. Planned costs are kept per designation, not per
-- person: the Control Center applies a designation's cost to every resource with
-- that designation when no actual cost exists (Actual Resource Cost, which is
-- kept per resource in resource_cost). The 33 rows below are the owner's own
-- list, loaded as given. Grades repeat on purpose (Engineer and Intern are both
-- K1) and K26 is deliberately absent, so grade is not unique. Designation is the
-- business key, unique among live rows.
create table public.planned_resource_costs (
  id uuid primary key default gen_random_uuid(),
  designation text not null,
  grade text not null,
  offshore_cost numeric not null,
  onsite_cost numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint ck_planned_resource_costs_created_by_length check (char_length(created_by) <= 255),
  constraint ck_planned_resource_costs_updated_by_length check (char_length(updated_by) <= 255),
  constraint ck_planned_resource_costs_offshore_cost_range check (offshore_cost >= 0),
  constraint ck_planned_resource_costs_onsite_cost_range check (onsite_cost >= 0)
);

create trigger trg_planned_resource_costs_updated_at before update on public.planned_resource_costs
  for each row execute function set_updated_at();

alter table public.planned_resource_costs enable row level security;

create unique index ux_planned_resource_costs_designation_live
  on public.planned_resource_costs (designation) where deleted_at is null;

insert into public.planned_resource_costs (designation, grade, offshore_cost, onsite_cost, created_by, updated_by)
select d, g, o, s, 'Arshad Gani', 'Arshad Gani'
from (values
  ('Vice President', 'K32', 4750, 8500),
  ('Associate Vice President', 'K31', 4500, 8000),
  ('Executive Director', 'K30', 4250, 7500),
  ('Senior Director', 'K29', 4000, 7000),
  ('Director', 'K28', 3500, 6500),
  ('Associate Director', 'K27', 3000, 6000),
  ('Senior Manager', 'K25', 2800, 5500),
  ('Manager', 'K24', 2200, 4000),
  ('Associate Manager', 'K23', 1800, 3300),
  ('Senior Principal Consultant', 'K22', 2800, 5500),
  ('Senior Principal Engineer', 'K21', 2800, 5500),
  ('Principal Consultant', 'K20', 2200, 4000),
  ('Principal Engineer', 'K19', 2200, 4000),
  ('Principal Data Engineer', 'K18', 2200, 4000),
  ('Principal Data Scientist', 'K17', 2200, 4000),
  ('Senior Consultant', 'K16', 1800, 3300),
  ('Senior Data Engineer', 'K15', 1800, 3300),
  ('Senior Analyst', 'K14', 1800, 3300),
  ('Senior Engineer', 'K13', 1800, 3300),
  ('Senior Executive', 'K12', 1800, 3300),
  ('Senior Data Scientist - I', 'K11', 1800, 3300),
  ('Senior Data Scientist - II', 'K10', 1800, 3300),
  ('Consultant', 'K9', 1500, 2400),
  ('Data Engineer', 'K8', 1500, 2400),
  ('Data Architect', 'K7', 1500, 2400),
  ('Associate', 'K6', 1000, 1750),
  ('Associate Engineer', 'K5', 1000, 1750),
  ('Associate Data Engineer', 'K4', 1000, 1750),
  ('Associate Data Scientist', 'K3', 1000, 1750),
  ('Analyst', 'K2', 1000, 1750),
  ('Engineer', 'K1', 1000, 1750),
  ('Executive', 'K0', 1000, 1750),
  ('Intern', 'K1', 600, 1200)
) as v(d, g, o, s);
