const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// columns drives what MasterDataTable renders — kept in display order,
// separate from the backend's field list since this is presentation-only
// (labels, column order) rather than validation.
const AUDIT_COLUMNS = [
  { key: "createdBy", label: "Created By" },
  { key: "createdAt", label: "Created" },
  { key: "updatedBy", label: "Modified By" },
  { key: "updatedAt", label: "Modified" },
];

export const MASTER_DATA_TABLES = [
  {
    route: "practices",
    label: "Practices",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
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
    route: "skill-sets",
    label: "Skill Sets",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "modules",
    label: "Modules",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "resources",
    label: "Resources",
    columns: [{ key: "name", label: "Name" }, ...AUDIT_COLUMNS],
  },
  {
    route: "departments",
    label: "Departments",
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
