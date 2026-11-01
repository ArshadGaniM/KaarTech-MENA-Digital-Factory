-- A deployment now has a start date and an end date. A person counts as deployed
-- only from the start to the end (both days included), and goes back to TBD after.
-- The rows that exist today get 1 Aug 2026 to 31 Mar 2027, as the owner decided.
alter table public.resource_deployment
  add column start_date date,
  add column end_date date;

update public.resource_deployment
   set start_date = date '2026-08-01',
       end_date = date '2027-03-31';

alter table public.resource_deployment
  alter column start_date set not null,
  alter column end_date set not null,
  add constraint ck_resource_deployment_dates_order check (end_date >= start_date);

-- One resource may hold a position again later, so "one row per resource and
-- position" becomes "no two live rows for the same resource and position share
-- a day". The old unique index is replaced by an exclusion constraint (the
-- btree_gist extension is already on, migration 0029).
drop index public.ux_resource_deployment_employee_position_live;

alter table public.resource_deployment
  add constraint ex_resource_deployment_position_no_overlap
  exclude using gist (
    employee_id with =,
    position_code with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (deleted_at is null);

-- Reads ask "who is deployed today", so index the dates of live rows.
create index ix_resource_deployment_dates
  on public.resource_deployment (start_date, end_date)
  where deleted_at is null;
