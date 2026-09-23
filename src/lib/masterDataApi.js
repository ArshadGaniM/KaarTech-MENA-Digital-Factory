const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// columns drives what MasterDataTable renders — kept in display order,
// separate from the backend's field list since this is presentation-only
// (labels, column order) rather than validation. Every table spreads this
// same array so a future column (or a label change) is one edit, not one
// per table.
const AUDIT_COLUMNS = [
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created At" },
  { key: "updatedBy", label: "Updated By" },
  { key: "updatedAt", label: "Updated At" },
  { key: "markedDeleted", label: "Marked Deleted" },
];

// FEAT-14: singularLabel drives the "Add <Entity>" button text (e.g. "Add
// Practice", not "Add Practices") — kept explicit per table rather than a
// strip-the-trailing-s heuristic, since "Competencies"/"Resource Cost"
// don't follow that pattern.
export const MASTER_DATA_TABLES = [
  {
    route: "practices",
    label: "Practices",
    singularLabel: "Practice",
    columns: [
      { key: "code", label: "Practice ID" },
      { key: "name", label: "Practice Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "delivery-centers",
    label: "Delivery Centers",
    singularLabel: "Delivery Center",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Name" },
      { key: "locationType", label: "Onshore/Offshore" },
      { key: "city", label: "City" },
      { key: "country", label: "Country" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "competencies",
    label: "Competencies",
    singularLabel: "Competency",
    // FEAT-15: competencies has neither hasCode nor identityField either
    // (identity: "none", same as resource-cost/resource-deployment/
    // project-assignments) — gate finding, debugger: without this column
    // the Delete popup has nothing visible to match against for this table.
    columns: [{ key: "id", label: "Record ID" }, { key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "modules",
    label: "Modules",
    singularLabel: "Module",
    columns: [
      { key: "code", label: "Module ID" },
      { key: "moduleCode", label: "Module Code" },
      { key: "name", label: "Module Name" },
      { key: "practiceId", label: "Practice" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "resources",
    label: "Resources",
    singularLabel: "Resource",
    columns: [
      { key: "employeeId", label: "Employee ID" },
      { key: "name", label: "Employee Name" },
      { key: "orgChart", label: "Employee Org Chart" },
      { key: "employmentStatus", label: "Employee Employment/Project Status" },
      { key: "employmentType", label: "Employee Employment Type" },
      { key: "region", label: "Employee Region" },
      { key: "subDivision", label: "Employee Sub Division" },
      { key: "position", label: "Employee Position" },
      { key: "onsiteLocation", label: "Employee Onsite Location" },
      { key: "offshoreLocation", label: "Employee Offshore Location" },
      { key: "locationType", label: "Employee Location Type" },
      { key: "designation", label: "Employee Designation" },
      { key: "skill", label: "Employee Skill" },
      { key: "geBatch", label: "Employee GE Batch" },
      { key: "kaarExperience", label: "Employee Kaar Experience" },
      { key: "sapExperience", label: "Employee Sap Experience" },
      { key: "totalExperience", label: "Employee Total Experience" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "departments",
    label: "Departments",
    singularLabel: "Department",
    columns: [
      { key: "code", label: "Department Code" },
      { key: "name", label: "Department Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "resource-cost",
    label: "Resource Cost",
    singularLabel: "Resource Cost",
    columns: [
      // FEAT-15: this table has no business code (identity: "none") — the
      // internal row id is the only thing a "Delete by Code or ID" popup
      // can match against, so it has to be visible somewhere.
      { key: "id", label: "Record ID" },
      { key: "employeeId", label: "Employee ID" },
      { key: "employeeName", label: "Employee Name" },
      { key: "employeeDesignation", label: "Employee Designation" },
      { key: "offshoreCost", label: "Offshore Cost" },
      { key: "onsiteCost", label: "Onsite Cost" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "teams",
    label: "Teams",
    singularLabel: "Team",
    columns: [
      { key: "code", label: "Team ID" },
      { key: "name", label: "Team Name" },
      { key: "departmentCode", label: "Department Code" },
      { key: "departmentName", label: "Department Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "resource-deployment",
    label: "Resource Deployment",
    singularLabel: "Resource Deployment",
    columns: [
      // FEAT-15: see resource-cost's `id` column above — same reasoning.
      { key: "id", label: "Record ID" },
      { key: "employeeId", label: "Employee ID" },
      { key: "employeeName", label: "Employee Name" },
      { key: "positionId", label: "Position ID" },
      { key: "positionName", label: "Position Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "positions",
    label: "Positions",
    singularLabel: "Position",
    columns: [
      { key: "code", label: "Position ID" },
      { key: "name", label: "Position Name" },
      { key: "teamCode", label: "Team Code" },
      { key: "teamName", label: "Team Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "projects",
    label: "Projects",
    singularLabel: "Project",
    columns: [
      { key: "projectId", label: "Project ID" },
      { key: "projectName", label: "Project Name" },
      { key: "projectProfitCenterCode", label: "Profit Center Code" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "project-assignments",
    label: "Project Assignments",
    singularLabel: "Project Assignment",
    columns: [
      // FEAT-15: see resource-cost's `id` column above — same reasoning.
      { key: "id", label: "Record ID" },
      { key: "projectId", label: "Project ID" },
      { key: "projectName", label: "Project Name" },
      { key: "projectProfitCenterCode", label: "Profit Center Code" },
      { key: "teamId", label: "Team Code" },
      { key: "teamName", label: "Team Name" },
      { key: "departmentId", label: "Department ID" },
      { key: "departmentName", label: "Department Name" },
      { key: "projectAssignmentStartDate", label: "Project Assignment Start Date" },
      { key: "projectAssignmentEndDate", label: "Project Assignment End Date" },
      ...AUDIT_COLUMNS,
    ],
  },
];

export async function fetchMasterDataTable(route) {
  const res = await fetch(`${BACKEND_URL}/v1/${route}?limit=100`);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Failed to load ${route}`);
  }
  if (payload === null) {
    throw new Error(`${route} returned a malformed response.`);
  }
  return payload.data;
}

// FEAT-14: creates a record via the generic "Add <Entity>" form. Every
// write route requires the internal API key (see backend/README.md) —
// this app has no user-login system yet, so there is no way to keep this
// key out of the browser bundle once the browser itself needs to write;
// this is an accepted limitation of the current no-auth stage (CLAUDE.md
// §20), not an oversight. On a 422, the thrown error carries `details`
// (the same field->message map the backend returns) so the form can show
// per-field errors instead of one generic message.
export async function createRecord(route, body) {
  const res = await fetch(`${BACKEND_URL}/v1/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': import.meta.env.VITE_INTERNAL_API_KEY || '',
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const error = new Error(payload?.error?.message || `Failed to create ${route} record`);
    error.details = payload?.error?.details ?? {};
    throw error;
  }
  return payload?.data;
}

// FEAT-15: marks a record deleted via the backend's existing DELETE
// route (already a soft delete — sets `deleted_at`, never removes the
// row; see backend/src/masterDataRouter.js). Same auth as createRecord.
export async function deleteRecord(route, id) {
  const res = await fetch(`${BACKEND_URL}/v1/${route}/${id}`, {
    method: 'DELETE',
    headers: {
      'x-internal-api-key': import.meta.env.VITE_INTERNAL_API_KEY || '',
    },
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.error?.message || `Failed to delete ${route} record`);
  }
}
