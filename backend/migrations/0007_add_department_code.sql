-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Departments get an auto-generated, immutable business code (DEPT-001,
-- DEPT-002, ...), same pattern as delivery_centers (0005). Department
-- Name is the existing `name` column — no other new columns needed.

alter table public.departments
  add column code text;

create sequence public.departments_code_seq;

-- security definer: nextval() needs USAGE on the sequence, and this way
-- backend_app never needs a separate GRANT on departments_code_seq to be
-- able to insert rows.
create or replace function public.set_department_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is null then
    new.code := 'DEPT-' || lpad(nextval('departments_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_departments_code before insert on public.departments
  for each row execute function public.set_department_code();

create unique index ix_departments_code on public.departments (code);
