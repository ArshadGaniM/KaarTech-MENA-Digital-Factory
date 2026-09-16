-- Applied to Supabase via the Supabase MCP tool (apply_migration,
-- name: create_master_data_tables). Committed here for reproducibility —
-- per database.md, never edit this file after merge; add a new migration
-- instead. See 0002_improve_master_data_indexes.sql for the immediate
-- follow-up that replaced this file's deleted_at indexes.

create table public.practices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.delivery_centers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.skill_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- set_updated_at() already exists in this project (created for
-- team_members) — reused here, not redefined.
create trigger trg_practices_updated_at before update on public.practices
  for each row execute function set_updated_at();
create trigger trg_delivery_centers_updated_at before update on public.delivery_centers
  for each row execute function set_updated_at();
create trigger trg_skill_sets_updated_at before update on public.skill_sets
  for each row execute function set_updated_at();
create trigger trg_modules_updated_at before update on public.modules
  for each row execute function set_updated_at();
create trigger trg_resources_updated_at before update on public.resources
  for each row execute function set_updated_at();
create trigger trg_departments_updated_at before update on public.departments
  for each row execute function set_updated_at();

-- RLS enabled, zero policies — matches the existing team_members table.
-- Access control is entirely at the application layer (the backend
-- connects with a role that bypasses RLS); this is not PostgREST-facing.
alter table public.practices enable row level security;
alter table public.delivery_centers enable row level security;
alter table public.skill_sets enable row level security;
alter table public.modules enable row level security;
alter table public.resources enable row level security;
alter table public.departments enable row level security;

create index ix_practices_deleted_at on public.practices (deleted_at);
create index ix_delivery_centers_deleted_at on public.delivery_centers (deleted_at);
create index ix_skill_sets_deleted_at on public.skill_sets (deleted_at);
create index ix_modules_deleted_at on public.modules (deleted_at);
create index ix_resources_deleted_at on public.resources (deleted_at);
create index ix_departments_deleted_at on public.departments (deleted_at);
