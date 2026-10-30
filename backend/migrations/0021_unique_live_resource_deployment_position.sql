-- FEAT-21 gate (security-auditor, code-reviewer): backstop for the app-level
-- "one row per resource and position" rule. Partial, so a soft-deleted row
-- doesn't block re-adding the same position (restore is re-checked in the app).
create unique index ux_resource_deployment_employee_position_live
  on public.resource_deployment (employee_id, position_code)
  where deleted_at is null;
