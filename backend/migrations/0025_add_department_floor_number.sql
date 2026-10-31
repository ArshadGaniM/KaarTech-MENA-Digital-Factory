-- FEAT-25: every department sits on one floor of the Control Center
-- building. The floor number is data, not code: 1 is the ground floor and
-- higher numbers are higher up. It is required, a whole number from 1 to 1000,
-- and no two live departments may share one, so a new department cannot be
-- created without a free floor.
alter table public.departments
  add column floor_number integer;

-- Floors as the owner laid them out, ground floor first. Any other row
-- (for example a soft-deleted department) is parked above them so the
-- column can be made required without clashing (101 and up).
update public.departments d
set floor_number = m.floor_number
from (values
  ('DEPT-013', 1),
  ('DEPT-005', 2),
  ('DEPT-008', 3),
  ('DEPT-012', 4),
  ('DEPT-011', 5),
  ('DEPT-010', 6),
  ('DEPT-004', 7),
  ('DEPT-003', 8),
  ('DEPT-009', 9),
  ('DEPT-002', 10),
  ('DEPT-007', 11),
  ('DEPT-006', 12),
  ('DEPT-001', 13)
) as m(code, floor_number)
where d.code = m.code;

update public.departments d
set floor_number = 100 + o.n
from (
  select id, row_number() over (order by code) as n
  from public.departments
  where floor_number is null
) o
where d.id = o.id;

alter table public.departments
  alter column floor_number set not null,
  add constraint ck_departments_floor_number_range check (floor_number between 1 and 1000);

-- Live rows only, so deleting a department frees its floor. The index name
-- carries the column name: the API's unique-violation handler uses it to
-- tell the caller which field clashed.
create unique index ux_departments_floor_number_live
  on public.departments (floor_number)
  where deleted_at is null;
