-- Every competency belongs to one practice (owner, 1 Nov 2026). The column is
-- required, so the 29 existing competencies are mapped first, from the owner's
-- own list, and the migration stops (nothing changes) if any row is left
-- without one. practices.code is the reference: the pick-list in the app shows
-- the live practices and the API rejects a missing or unknown one.
alter table public.competencies add column practice_code text;

update public.competencies c
set practice_code = m.practice_code
from (values
  ('ABAP', 'PRAC-006'),
  ('AI', 'PRAC-007'),
  ('Basis', 'PRAC-010'),
  ('BI', 'PRAC-007'),
  ('BTP', 'PRAC-006'),
  ('BW', 'PRAC-007'),
  ('CPI', 'PRAC-006'),
  ('CRM', 'PRAC-003'),
  ('ECP', 'PRAC-004'),
  ('EHS', 'PRAC-005'),
  ('EPPM', 'PRAC-003'),
  ('FICO', 'PRAC-001'),
  ('FM', 'PRAC-001'),
  ('Full Stack', 'PRAC-008'),
  ('GRC', 'PRAC-010'),
  ('MM', 'PRAC-002'),
  ('MRO', 'PRAC-005'),
  ('PM', 'PRAC-005'),
  ('PP', 'PRAC-005'),
  ('QM', 'PRAC-005'),
  ('SAC', 'PRAC-007'),
  ('SD', 'PRAC-003'),
  ('SF EC', 'PRAC-004'),
  ('Solman', 'PRAC-010'),
  ('SRM', 'PRAC-002'),
  ('Syniti', 'PRAC-007'),
  ('Talent', 'PRAC-004'),
  ('TT', 'PRAC-004'),
  ('Webdynpro', 'PRAC-006')
) as m(name, practice_code)
where c.name = m.name;

alter table public.competencies alter column practice_code set not null;

alter table public.competencies
  add constraint fk_competencies_practices
  foreign key (practice_code) references public.practices (code);

create index ix_competencies_practice_code on public.competencies (practice_code) where deleted_at is null;
