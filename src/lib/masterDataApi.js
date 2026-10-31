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
      { key: "input", label: "Input" },
      { key: "output", label: "Output" },
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
      { key: "allocationPercentage", label: "Allocation %" },
      { key: "employeeTotalAllocation", label: "Employee Total %" },
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
      { key: "competencies", label: "Competencies" },
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

// Paginated (CLAUDE.md §10: offset-based, `total` in the response) — this
// is what the visible table view fetches a page at a time. Returns
// { rows, total } rather than a bare array so a caller can compute page
// count without a second request.
// `query` (FEAT-24) filters on any cell, exact or near-miss, across the whole
// table — not just the page on screen.
export async function fetchMasterDataTable(route, { limit = 20, offset = 0, query = '' } = {}) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (query.trim() !== '') params.set('q', query.trim());
  const url = `${BACKEND_URL}/v1/${route}?${params}`;
  const res = await fetch(url);
  let parseError = null;
  const payload = await res.json().catch((err) => {
    parseError = err;
    return null;
  });
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Failed to load ${route}`);
  }
  if (payload === null) {
    // Include the request (route/offset) and the underlying parse
    // failure's own message — a generic "malformed response" with
    // neither is effectively undebuggable once this is called in a loop
    // (fetchAllMasterDataTableRows, up to MAX_PAGES times per call): a
    // failure on page 14 of 28 looked identical to one on page 1 (gate
    // finding, silent-failure-hunter).
    throw new Error(
      `${route} returned a malformed response at offset ${offset} (limit ${limit})` +
        (parseError ? `: ${parseError.message}` : ".")
    );
  }
  // A non-finite/negative `total` would otherwise propagate into
  // totalPages (Math.ceil/Math.max with NaN stays NaN, not the intended
  // fallback) and into fetchAllMasterDataTableRows's loop-termination
  // check, where it could never satisfy `offset >= total` (gate finding,
  // code-reviewer) — reject here, once, for every caller.
  const total = Number.isFinite(payload.total) && payload.total >= 0 ? payload.total : null;
  if (total === null) {
    throw new Error(`${route} returned a malformed response: invalid total "${payload.total}".`);
  }
  // Absent on a backend that predates activeTotal; callers must not treat it as zero or fall back to total.
  const activeTotal = Number.isFinite(payload.activeTotal) && payload.activeTotal >= 0 ? payload.activeTotal : undefined;
  return { rows: payload.data, total, activeTotal };
}

// Pages through the backend's own max page size until every row has been
// collected. For callers that need the *complete* active dataset rather
// than one visible page — an FK pick-list (every valid option must be
// selectable, not just the first page's worth) and the "Delete by Code or
// ID" search (a record outside the table's current page must still be
// findable). The backend caps `limit` at 100 regardless of what's
// requested, so this is the only way either of those stays correct once a
// table holds more than 100 rows.
//
// MAX_PAGES is a hard backstop (gate finding, security-auditor): a
// malformed or inconsistent `total` from the backend (non-numeric,
// negative, or one that never catches up to `offset`) would otherwise
// loop forever, fetching pages and hanging the tab — this caps it at
// 100,000 rows, far past any real table, and fails loudly instead.
const MAX_PAGES = 1000;

// The first page is fetched alone (total is unknown until then); every
// remaining page is fetched in parallel rather than one-at-a-time, since
// once `total` is known the full set of offsets is known too. Reduces a
// 2,756-row table (resources, ~28 pages) from ~28 sequential round-trips
// to 2 — one, then the rest at once (gate finding, code-reviewer: an
// FK pick-list or the Delete search re-does this full fetch on every
// open, so making each one 28x slower than necessary was real, visible
// latency, not a hypothetical).
export async function fetchAllMasterDataTableRows(route) {
  const PAGE_SIZE = 100;
  const { rows: firstRows, total } = await fetchMasterDataTable(route, { limit: PAGE_SIZE, offset: 0 });
  if (firstRows.length === 0 || PAGE_SIZE >= total) return firstRows;

  const remainingPages = Math.ceil(total / PAGE_SIZE) - 1;
  if (remainingPages >= MAX_PAGES) {
    throw new Error(`${route} has more pages than expected — aborting after ${MAX_PAGES * PAGE_SIZE} rows.`);
  }

  const restOffsets = Array.from({ length: remainingPages }, (_, i) => (i + 1) * PAGE_SIZE);
  const restPages = await Promise.all(
    restOffsets.map((offset) => fetchMasterDataTable(route, { limit: PAGE_SIZE, offset }))
  );
  return [firstRows, ...restPages.map((page) => page.rows)].flat();
}

// FEAT-14: shared by the generic Add/Edit/Restore write calls. Every
// write route requires the internal API key (see backend/README.md) —
// this app has no user-login system yet, so there is no way to keep this
// key out of the browser bundle once the browser itself needs to write;
// this is an accepted limitation of the current no-auth stage (CLAUDE.md
// §20), not an oversight. On a 422, the thrown error carries `details`
// (the same field->message map the backend returns) so the form can show
// per-field errors instead of one generic message.
async function writeRecord(method, path, body, failureMessage) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': import.meta.env.VITE_INTERNAL_API_KEY || '',
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    // The HTTP status goes in the fallback so a gateway 502/504 (an HTML
    // body, no backend message) isn't indistinguishable from a real
    // refusal (gate finding, silent-failure-hunter).
    const error = new Error(payload?.error?.message || `${failureMessage} (HTTP ${res.status}).`);
    error.details = payload?.error?.details ?? {};
    throw error;
  }
  // A 2xx that carries no readable record means the write can't be
  // confirmed — don't let the form close and the table reload as if it
  // had saved (same stance as fetchMasterDataTable's malformed-response
  // error).
  if (payload?.data === undefined) {
    throw new Error(`${failureMessage}: the server's response (HTTP ${res.status}) could not be read.`);
  }
  return payload.data;
}

export function createRecord(route, body) {
  return writeRecord('POST', `/v1/${route}`, body, `Failed to create ${route} record`);
}

// FEAT-19: PATCH — only the keys in `body` change; an explicit null clears
// an optional field (see backend/src/masterDataRouter.js's PATCH handler).
export function updateRecord(route, id, body) {
  return writeRecord('PATCH', `/v1/${route}/${id}`, body, `Failed to update ${route} record`);
}

// FEAT-19: undo of deleteRecord — the backend refuses (422) if the row
// references another row that is itself still deleted.
export function restoreRecord(route, id) {
  return writeRecord('POST', `/v1/${route}/${id}/restore`, {}, `Failed to restore ${route} record`);
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
    throw new Error(payload?.error?.message || `Failed to delete ${route} record (HTTP ${res.status}).`);
  }
}
