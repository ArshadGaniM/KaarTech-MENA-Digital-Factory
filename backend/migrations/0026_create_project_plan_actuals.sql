-- FEAT-28: actual progress against the (locked, read-only) project plan. One row
-- per plan activity, keyed by the plan's own Sl. No ("1.0" for a group, "1a" for
-- an activity). The plan itself is never stored or edited here; this table only
-- holds what actually happened, for the plan-versus-actual view.
create table public.project_plan_actuals (
  activity_key text primary key,
  actual_start_week integer,
  actual_end_week integer,
  actual_poc integer not null default 0,
  created_by text not null default 'Arshad Gani',
  updated_by text not null default 'Arshad Gani',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_project_plan_actuals_start_week check (actual_start_week between 1 and 65),
  constraint ck_project_plan_actuals_end_week check (actual_end_week between 1 and 65),
  constraint ck_project_plan_actuals_poc check (actual_poc between 0 and 100),
  constraint ck_project_plan_actuals_order check (actual_end_week is null or (actual_start_week is not null and actual_end_week >= actual_start_week))
);

alter table public.project_plan_actuals enable row level security;
