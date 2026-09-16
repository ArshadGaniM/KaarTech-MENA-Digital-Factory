-- Applied to Supabase via the Supabase MCP tool (apply_migration,
-- name: improve_master_data_indexes). Follow-up to 0001: the
-- deleted_at-only indexes have almost no selectivity (deleted_at is NULL
-- for ~100% of rows in steady state) and don't serve the actual hot
-- query, which filters "deleted_at is null" AND orders by "name". A
-- partial index on name scoped to live rows serves both in one index and
-- is far smaller. Verified with EXPLAIN that the planner picks the new
-- index (Bitmap Index Scan on ix_practices_name) for the list query.

drop index public.ix_practices_deleted_at;
drop index public.ix_delivery_centers_deleted_at;
drop index public.ix_skill_sets_deleted_at;
drop index public.ix_modules_deleted_at;
drop index public.ix_resources_deleted_at;
drop index public.ix_departments_deleted_at;

create index ix_practices_name on public.practices (name) where deleted_at is null;
create index ix_delivery_centers_name on public.delivery_centers (name) where deleted_at is null;
create index ix_skill_sets_name on public.skill_sets (name) where deleted_at is null;
create index ix_modules_name on public.modules (name) where deleted_at is null;
create index ix_resources_name on public.resources (name) where deleted_at is null;
create index ix_departments_name on public.departments (name) where deleted_at is null;
