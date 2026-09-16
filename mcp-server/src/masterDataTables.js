// Mirrors backend/src/masterDataTables.js — kept as a separate copy because
// this package has no workspace link to the backend, but the two lists must
// stay in sync. slug is the tool-name suffix (add_<slug>, update_<slug>,
// delete_<slug>); route matches the backend's REST path segment.
export const MASTER_DATA_TABLES = [
  { slug: "practice", route: "practices", label: "Practice" },
  { slug: "delivery_center", route: "delivery-centers", label: "Delivery Center" },
  { slug: "skill_set", route: "skill-sets", label: "Skill Set" },
  { slug: "module", route: "modules", label: "Module" },
  { slug: "resource", route: "resources", label: "Resource" },
  { slug: "department", route: "departments", label: "Department" },
];
