-- Applied to Supabase via the Supabase MCP tool (apply_migration).
-- First table to get real business columns beyond name: an auto-generated
-- business code (DC-001, DC-002, ...), onshore/offshore classification,
-- and city/country.

alter table public.delivery_centers
  add column code text,
  add column location_type text not null default 'onshore',
  add column city text not null default '',
  add column country text not null default '';

-- Defaults only existed to let ADD COLUMN succeed against zero existing
-- rows — dropped immediately so every future insert must supply a real
-- value instead of silently getting 'onshore'/''.
alter table public.delivery_centers
  alter column location_type drop default,
  alter column city drop default,
  alter column country drop default;

alter table public.delivery_centers
  add constraint delivery_centers_location_type_check
  check (location_type in ('onshore', 'offshore'));

-- code is business-facing (e.g. DC-001), auto-generated on insert, and
-- immutable after that — distinct from the internal uuid primary key,
-- which the app never exposes as "the" identifier for this table.
create sequence public.delivery_centers_code_seq;

-- security definer: nextval() needs USAGE on the sequence, and this way
-- backend_app (or any future least-privilege role) never needs a
-- separate GRANT on delivery_centers_code_seq to be able to insert rows.
create or replace function public.set_delivery_center_code()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.code is null then
    new.code := 'DC-' || lpad(nextval('delivery_centers_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

create trigger trg_delivery_centers_code before insert on public.delivery_centers
  for each row execute function public.set_delivery_center_code();

create unique index ix_delivery_centers_code on public.delivery_centers (code);
