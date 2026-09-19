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

export const MASTER_DATA_TABLES = [
  {
    route: "practices",
    label: "Practices",
    columns: [
      { key: "code", label: "Practice ID" },
      { key: "name", label: "Practice Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "delivery-centers",
    label: "Delivery Centers",
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
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "modules",
    label: "Modules",
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
    columns: [
      { key: "code", label: "Department Code" },
      { key: "name", label: "Department Name" },
      ...AUDIT_COLUMNS,
    ],
  },
  {
    route: "resource-cost",
    label: "Resource Cost",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "teams",
    label: "Teams",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "resource-deployment",
    label: "Resource Deployment",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
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
