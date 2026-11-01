-- The Control Center finds a team's practice through its main competency's name,
-- and positions list competencies by name, so a live competency name must be
-- unique. Deleting a competency frees its name. The live data was checked first:
-- 29 live competencies, no repeated name. The index name carries the column so
-- the API's unique-violation handler can name the field.
create unique index ux_competencies_name_live on public.competencies (name) where deleted_at is null;
