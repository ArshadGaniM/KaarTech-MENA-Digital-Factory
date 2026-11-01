-- A team cannot have two live project assignments that share a day. The API
-- checks this first (validateOverlap, with a per-team lock) and gives a clear
-- message; this exclusion constraint is the backstop for a race. Both ends are
-- inclusive, so an assignment ending on 5 Dec clashes with one starting on 5 Dec.
-- The live data was checked before this was written: one live assignment, no
-- overlap, no empty end date.
create extension if not exists btree_gist with schema public;

alter table public.project_assignments
  add constraint ex_project_assignments_team_no_overlap
  exclude using gist (
    team_code with =,
    daterange(project_assignment_start_date, project_assignment_end_date, '[]') with &&
  ) where (deleted_at is null);
