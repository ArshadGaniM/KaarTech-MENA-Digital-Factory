-- A team can now be on several projects at once. Each project assignment holds a share
-- of the team, in percent, and on any one day the live assignments of a team may not add
-- up to more than 100. Every assignment that exists today is the team's only project, so
-- it takes 100. This migration only adds: the column (filled with 100 for the rows that
-- exist), its range check, and the constraint that a team does not hold the same project
-- twice on one day. The old rule (migration 0029) is dropped in 0041.
alter table public.project_assignments
  add column allocation_percentage numeric(5, 2) not null default 100;

alter table public.project_assignments
  add constraint ck_project_assignments_allocation_percentage_range
  check (allocation_percentage >= 0.01 and allocation_percentage <= 100);

-- The same project may be assigned to a team again later, but never twice on one day.
-- The btree_gist extension is already on (migration 0029).
alter table public.project_assignments
  add constraint ex_project_assignments_team_project_no_overlap
  exclude using gist (
    team_code with =,
    project_id with =,
    daterange(project_assignment_start_date, project_assignment_end_date, '[]') with &&
  ) where (deleted_at is null);
