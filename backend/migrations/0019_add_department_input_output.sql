-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Departments gets two optional free-text columns, `input` and `output`
-- (FEAT-20). Nullable with no default so every existing row stays valid
-- as-is; purely additive, so the previously deployed backend (which only
-- reads/writes the columns it knows about) keeps working until the new
-- one ships. Table-level grants (migration 0003) already cover new columns.

alter table public.departments
  add column input text,
  add column output text;
