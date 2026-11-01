-- FEAT-41: the Forecast tab needs what a month really looked like when it was
-- lived in, not what the deployment dates say about it afterwards. The backend
-- saves one row per month, team and seat type (a Consultant or Lead Consultant
-- position) and refreshes the current month's rows while it runs, so a month's
-- last write is how it ended. Adds a table only, so it is safe to apply before
-- the backend that writes to it deploys. Reverse: drop table analytics_snapshots.
create table public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  team_code text not null,
  position_name text not null,
  department_name text,
  practice_name text,
  seats integer not null,
  filled_seats integer not null,
  available_hours numeric not null,
  allocated_hours numeric not null,
  utilized_hours numeric not null,
  onsite_cost numeric not null,
  offshore_cost numeric not null,
  taken_at timestamptz not null default now(),
  constraint ck_analytics_snapshots_month_format check (month ~ '^[12][0-9]{3}-(0[1-9]|1[0-2])$'),
  constraint ck_analytics_snapshots_seats_range check (seats >= 0 and filled_seats between 0 and seats),
  constraint ck_analytics_snapshots_hours_range check (available_hours >= 0 and allocated_hours >= 0 and utilized_hours >= 0)
);

create unique index ux_analytics_snapshots_month_team_code_position_name
  on public.analytics_snapshots (month, team_code, position_name);

alter table public.analytics_snapshots enable row level security;
