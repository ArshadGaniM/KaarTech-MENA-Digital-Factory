-- FEAT-21: a resource can be deployed to several positions, each with its own
-- allocation percentage (e.g. two positions at 50/50); a resource's live rows
-- must not exceed 100 in total (enforced in the app, since rows are entered
-- one at a time). Existing rows were each a resource's only deployment, so
-- they backfill to 100. The default only serves the backfill and is dropped
-- so new rows must state their own percentage.
alter table public.resource_deployment
  add column allocation_percentage numeric(5,2) not null default 100;

alter table public.resource_deployment
  alter column allocation_percentage drop default;

alter table public.resource_deployment
  add constraint ck_resource_deployment_allocation_percentage
  check (allocation_percentage > 0 and allocation_percentage <= 100);
