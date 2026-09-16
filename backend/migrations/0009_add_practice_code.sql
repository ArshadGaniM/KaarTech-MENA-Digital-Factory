-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Practices get an auto-generated, immutable business code (PRAC-001,
-- PRAC-002, ...), same pattern as delivery_centers (0005) and
-- departments (0007). Practice Name is the existing `name` column.

alter table public.practices
  add column code text;

create sequence public.practices_code_seq;

create or replace function public.set_practice_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is null then
    new.code := 'PRAC-' || lpad(nextval('practices_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_practices_code before insert on public.practices
  for each row execute function public.set_practice_code();

create unique index ix_practices_code on public.practices (code);
