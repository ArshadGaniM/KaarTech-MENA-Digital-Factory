// Single source of truth for every master data table (CLAUDE.md request).
// route = REST path segment, tableName = Postgres table, resourceName =
// singular noun used in error messages (e.g. "practice_not_found").
//
// fields describes the table's real business columns beyond the universal
// id/created_at/updated_at/deleted_at/created_by/updated_by shape every
// table has:
//   key      - camelCase name used in request/response JSON
//   column   - snake_case Postgres column name
//   required - validated on create; on update, only enforced if the key
//              is present in the request body (partial update semantics)
//   type     - "string" (default) or "enum" (checked against `values`)
//
// hasCode marks a table whose primary key isn't what the app treats as
// "the" identifier — delivery_centers additionally exposes an
// auto-generated, immutable business code (DC-001, ...) via a DB trigger.
export const MASTER_DATA_TABLES = [
  {
    route: "practices",
    tableName: "practices",
    resourceName: "practice",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "delivery-centers",
    tableName: "delivery_centers",
    resourceName: "delivery_center",
    hasCode: true,
    fields: [
      { key: "name", column: "name", required: true, type: "string" },
      {
        key: "locationType",
        column: "location_type",
        required: true,
        type: "enum",
        values: ["onshore", "offshore"],
      },
      { key: "city", column: "city", required: true, type: "string" },
      { key: "country", column: "country", required: true, type: "string" },
    ],
  },
  {
    route: "skill-sets",
    tableName: "skill_sets",
    resourceName: "skill_set",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "modules",
    tableName: "modules",
    resourceName: "module",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "resources",
    tableName: "resources",
    resourceName: "resource",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "departments",
    tableName: "departments",
    resourceName: "department",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
];
