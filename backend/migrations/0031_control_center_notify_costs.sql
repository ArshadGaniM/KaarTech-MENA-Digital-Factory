-- The Control Center now shows costs, so a change to an Actual Resource Cost
-- or a Planned Resource Cost must refresh open pages too. Same statement-level
-- trigger as 0023 (notify_control_center_changed() already exists).
do $$
declare
  t text;
begin
  foreach t in array array['resource_cost', 'planned_resource_costs']
  loop
    execute format('drop trigger if exists trg_control_center_notify on public.%I', t);
    execute format(
      'create trigger trg_control_center_notify after insert or update or delete on public.%I
         for each statement execute function public.notify_control_center_changed()', t);
  end loop;
end;
$$;
