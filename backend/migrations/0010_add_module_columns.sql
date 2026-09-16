-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- Modules gets:
--   code        - auto-generated, immutable business identifier (MOD-001,
--                  ...), same pattern as delivery_centers/departments/
--                  practices. Displayed as "Module ID".
--   module_code - a second, human-entered code (distinct from the
--                  auto-generated `code`), required on every row.
--   practice_id - a picklist reference to practices.id. Deliberately NOT
--                  a foreign key: the user wants unmapped modules to be
--                  insertable and mapped to a Practice later via
--                  update_module, not rejected at write time. An index
--                  (not a constraint) keeps future lookups by practice
--                  fast without enforcing referential integrity.

alter table public.modules
  add column code text,
  add column module_code text not null default '',
  add column practice_id uuid;

alter table public.modules
  alter column module_code drop default;

create sequence public.modules_code_seq;

create or replace function public.set_module_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is null then
    new.code := 'MOD-' || lpad(nextval('modules_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_modules_code before insert on public.modules
  for each row execute function public.set_module_code();

create unique index ix_modules_code on public.modules (code);
create index ix_modules_practice_id on public.modules (practice_id);
