-- FEAT-22: a position records the competencies it needs, as a comma-separated
-- list of names that must exist in the competencies table (checked by the app,
-- like the other references). Optional; existing positions stay empty.
alter table public.positions
  add column competencies text;
