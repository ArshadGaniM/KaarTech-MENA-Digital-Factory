-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- FEAT-9: Positions is a brand-new master-data table (not an existing
-- placeholder getting upgraded, unlike FEAT-5/FEAT-8), so it's created
-- with its full real shape in one shot rather than a base-table-now/
-- real-columns-later split: the base shape every table gets (0011's
-- id/name/timestamps/deleted_at/created_by/updated_by, the updated_at
-- trigger, RLS-enabled-no-policies, the partial name index, and the
-- actor length constraints), PLUS an auto-generated immutable `code`
-- (POS-001, POS-002, ... via sequence + trigger, same hasCode pattern as
-- departments/practices/teams — see 0007/0009/0014), PLUS a required
-- team_code column that is a pick-list FK to teams.code (NOT teams.id),
-- enforced at the app layer via masterDataSchema.js's validateReferences()
-- and here at the DB layer as defense-in-depth, mirroring teams'
-- department_code -> departments.code FK (migration 0014). teamName is
-- intentionally NOT a column here — it's a live lookup against teams at
-- read time (see masterDataTables.js's `lookups` descriptor), so there's
-- nothing to store for it. Combining all of this into one migration is
-- safe specifically because the table starts empty — there is no
-- existing-row backfill concern the way 0014's two-phase-style add-on to
-- an already-populated table would have had.

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  team_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by text not null,
  updated_by text not null,
  constraint positions_created_by_length check (char_length(created_by) <= 255),
  constraint positions_updated_by_length check (char_length(updated_by) <= 255)
);

create trigger trg_positions_updated_at before update on public.positions
  for each row execute function set_updated_at();

alter table public.positions enable row level security;

create index ix_positions_name on public.positions (name) where deleted_at is null;

-- hasCode pattern (0007/0009/0014): auto-generated, immutable business
-- id, assigned on insert only (`if new.code is null`) so it can never be
-- overwritten by a later update.
create sequence public.positions_code_seq;

create or replace function public.set_position_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is null then
    new.code := 'POS-' || lpad(nextval('positions_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_positions_code before insert on public.positions
  for each row execute function public.set_position_code();

create unique index ix_positions_code on public.positions (code);

-- Defense-in-depth: the app layer (validateReferences) rejects a bad
-- teamCode before the INSERT/UPDATE ever runs, but a real FK constraint
-- is added too, per database.md and precedent (0013/0014). Relies on
-- teams.code's own unique index (ix_teams_code, migration 0014), which is
-- what makes this FK meaningful. Named per database.md's
-- fk_<table>_<ref_table> convention.
alter table public.positions
  add constraint fk_positions_teams
  foreign key (team_code) references public.teams (code);

-- database.md: "add an index on foreign keys" — also serves as the
-- join-performance index for the teamName lookup's LEFT JOIN.
create index ix_positions_team_code on public.positions (team_code);
