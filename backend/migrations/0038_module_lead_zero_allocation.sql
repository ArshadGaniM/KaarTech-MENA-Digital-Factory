-- FEAT-43: a Module Lead seat takes its allocation_percentage from the server, which
-- sets it to 0 when none of the teams the person leads has a filled seat. The check
-- from migration 0020 (> 0) refuses that, so it is replaced by >= 0. The API, not the
-- database, keeps the minimum of 0.01 for every other position.
-- Replaces a constraint, so the owner approves applying it (CLAUDE.md §21). Existing
-- rows all satisfy the new check (they satisfied the stricter one), and it must be
-- applied before the backend that writes 0 is deployed. Reverse (only while no row
-- holds 0): drop the constraint and re-add it with allocation_percentage > 0.
-- One ALTER TABLE statement, so the swap is atomic.
alter table public.resource_deployment
  drop constraint ck_resource_deployment_allocation_percentage,
  add constraint ck_resource_deployment_allocation_percentage
    check (allocation_percentage >= 0 and allocation_percentage <= 100);
