-- FEAT-23: tell the backend whenever data the Control Center shows changes,
-- so open pages can refresh without polling. One statement-level trigger per
-- table sends a single NOTIFY per statement; the backend listens on the
-- control_center_changed channel (src/changeFeed.js).
create or replace function public.notify_control_center_changed()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  perform pg_notify('control_center_changed', tg_table_name);
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['departments', 'teams', 'positions', 'competencies', 'resource_deployment', 'project_assignments', 'projects', 'resources']
  loop
    execute format('drop trigger if exists trg_control_center_notify on public.%I', t);
    execute format(
      'create trigger trg_control_center_notify after insert or update or delete on public.%I
         for each statement execute function public.notify_control_center_changed()', t);
  end loop;
end;
$$;
