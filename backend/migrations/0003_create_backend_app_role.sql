-- Applied to Supabase directly via the Supabase MCP tool (execute_sql for
-- the bypassrls grant, apply_migration for everything else — Supabase's
-- managed Postgres rejects `alter role postgres ...` from any non-superuser
-- connection with "only superusers can alter privileged roles", which is
-- what forced this dedicated-role approach instead of reusing `postgres`).
--
-- Production's DATABASE_URL previously pointed nowhere (never configured
-- on Render at all, so the driver fell back to localhost and every query
-- failed with ECONNREFUSED). Rather than hand the backend the `postgres`
-- superuser's credentials, it gets its own least-privilege role scoped to
-- exactly the tables it touches, matching the "backend connects with a
-- role that bypasses RLS" design already documented in 0001.
--
-- The actual password is NOT in this file — it was generated at
-- deploy time and set directly as Render's DATABASE_URL env var.
-- Rotate by re-running: alter role backend_app with password '<new>';
-- then updating DATABASE_URL on Render to match.

-- Replace CHANGE_ME with a real generated password before running this
-- against a fresh environment; the production value is never committed.
create role backend_app with login password 'CHANGE_ME';

grant usage on schema public to backend_app;

grant select, insert, update, delete on
  public.team_members,
  public.practices,
  public.delivery_centers,
  public.skill_sets,
  public.modules,
  public.resources,
  public.departments
to backend_app;

alter default privileges in schema public
  grant select, insert, update, delete on tables to backend_app;

-- Required because all 7 tables have RLS enabled with zero policies: a
-- non-bypassrls role gets zero rows/zero permitted writes on every one of
-- them, which is what actually caused the 42501 insufficient_privilege
-- error seen when this role was first tried without this grant.
alter role backend_app with bypassrls;
