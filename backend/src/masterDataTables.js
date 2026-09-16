// Single source of truth for every master data table (CLAUDE.md request).
// route = REST path segment, tableName = Postgres table, resourceName =
// singular noun used in error messages (e.g. "practice_not_found").
export const MASTER_DATA_TABLES = [
  { route: "practices", tableName: "practices", resourceName: "practice" },
  { route: "delivery-centers", tableName: "delivery_centers", resourceName: "delivery_center" },
  { route: "skill-sets", tableName: "skill_sets", resourceName: "skill_set" },
  { route: "modules", tableName: "modules", resourceName: "module" },
  { route: "resources", tableName: "resources", resourceName: "resource" },
  { route: "departments", tableName: "departments", resourceName: "department" },
];
