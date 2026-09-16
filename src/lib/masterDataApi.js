const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export const MASTER_DATA_TABLES = [
  { route: "practices", label: "Practices" },
  { route: "delivery-centers", label: "Delivery Centers" },
  { route: "skill-sets", label: "Skill Sets" },
  { route: "modules", label: "Modules" },
  { route: "resources", label: "Resources" },
  { route: "departments", label: "Departments" },
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
