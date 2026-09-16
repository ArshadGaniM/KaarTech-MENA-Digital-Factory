-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Renames skill_sets -> competencies (user-requested terminology change),
-- including the objects Postgres doesn't rename automatically.

alter table public.skill_sets rename to competencies;

alter index skill_sets_pkey rename to competencies_pkey;
alter index ix_skill_sets_name rename to ix_competencies_name;

alter table public.competencies
  rename constraint skill_sets_created_by_length to competencies_created_by_length;
alter table public.competencies
  rename constraint skill_sets_updated_by_length to competencies_updated_by_length;

alter trigger trg_skill_sets_updated_at on public.competencies
  rename to trg_competencies_updated_at;
