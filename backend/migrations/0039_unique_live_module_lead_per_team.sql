-- FEAT-45: a team holds one live Module Lead seat (a position whose name starts with
-- "Module Lead"). The API checks this on create, edit and restore under a per-team lock and
-- gives the friendly message; this partial unique index is the backstop for two writes that
-- race past that check. TEAM-087, TEAM-088 and TEAM-089 already hold eight vacant seats each
-- and are left out, so they stay untouched and may add seats freely. Keep the list in step
-- with MODULE_LEAD_EXEMPT_TEAMS in backend/src/moduleLeadSeat.js.
-- Additive only. Existing live data already satisfies it (85 teams have exactly one). The
-- violation is mapped to a 422 in masterDataRouter.js. Reverse: drop index
-- public.ux_positions_team_module_lead_live.
create unique index ux_positions_team_module_lead_live on public.positions (team_code)
  where deleted_at is null
    and name like 'Module Lead%'
    and team_code not in ('TEAM-087', 'TEAM-088', 'TEAM-089');
