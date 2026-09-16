-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Three new master data tables (resource_cost, teams,
-- resource_deployment), created directly with the full shape the
-- original 6 tables accumulated across migrations 0001/0002/0004/0006
-- (id/name/timestamps/deleted_at/created_by/updated_by, the updated_at
-- trigger, RLS-enabled-no-policies, the partial name index, and the
-- actor length constraints) rather than replaying that history — they
-- have no real columns of their own yet, same starting point Practices/
-- Competencies/etc. had before their own follow-up migrations.

create table public.resource_cost (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint resource_cost_created_by_length check (char_length(created_by) <= 255),
  constraint resource_cost_updated_by_length check (char_length(updated_by) <= 255)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint teams_created_by_length check (char_length(created_by) <= 255),
  constraint teams_updated_by_length check (char_length(updated_by) <= 255)
);

create table public.resource_deployment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint resource_deployment_created_by_length check (char_length(created_by) <= 255),
  constraint resource_deployment_updated_by_length check (char_length(updated_by) <= 255)
);

create trigger trg_resource_cost_updated_at before update on public.resource_cost
  for each row execute function set_updated_at();
create trigger trg_teams_updated_at before update on public.teams
  for each row execute function set_updated_at();
create trigger trg_resource_deployment_updated_at before update on public.resource_deployment
  for each row execute function set_updated_at();

alter table public.resource_cost enable row level security;
alter table public.teams enable row level security;
alter table public.resource_deployment enable row level security;

create index ix_resource_cost_name on public.resource_cost (name) where deleted_at is null;
create index ix_teams_name on public.teams (name) where deleted_at is null;
create index ix_resource_deployment_name on public.resource_deployment (name) where deleted_at is null;
