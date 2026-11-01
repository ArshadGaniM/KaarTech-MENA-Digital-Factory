-- The Organization Structure page groups teams by practice, so renaming or
-- adding a practice must refresh open pages too. Same statement-level trigger
-- as 0023 (notify_control_center_changed() already exists). Competencies,
-- teams, positions and deployments are already covered by 0023.
drop trigger if exists trg_control_center_notify on public.practices;
create trigger trg_control_center_notify after insert or update or delete on public.practices
  for each statement execute function public.notify_control_center_changed();
