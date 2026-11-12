-- A team may now be on several projects at the same time (migration 0040), so the rule
-- that no two live assignments of one team share a day (migration 0029) is dropped. The
-- API now checks that the shares on any one day add up to at most 100, under a per-team
-- lock, and 0040 keeps a team from holding one project twice on one day.
alter table public.project_assignments
  drop constraint ex_project_assignments_team_no_overlap;
