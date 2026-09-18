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
//   type     - "string" (default), "enum" (checked against `values`), or
//              "number" (finite JS number, no length/enum checks)
//   maxLength - optional override of the default 255-char cap on a
//               "string" field (e.g. resources.skill, a long free-text
//               comma list that can run past 12,000 characters)
//
// hasCode marks a table whose primary key isn't what the app treats as
// "the" identifier — delivery_centers additionally exposes an
// auto-generated, immutable business code (DC-001, ...) via a DB trigger.
// resources.employeeId is a different case: also "the" identifier, but
// caller-supplied rather than auto-generated (enforced unique at the DB
// level, see migrations/0012), so it's just an ordinary required field.
export const MASTER_DATA_TABLES = [
  {
    route: "practices",
    tableName: "practices",
    resourceName: "practice",
    hasCode: true,
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
    route: "competencies",
    tableName: "competencies",
    resourceName: "competency",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "modules",
    tableName: "modules",
    resourceName: "module",
    hasCode: true,
    fields: [
      { key: "moduleCode", column: "module_code", required: true, type: "string" },
      { key: "name", column: "name", required: true, type: "string" },
      { key: "practiceId", column: "practice_id", required: false, type: "string" },
    ],
  },
  {
    route: "resources",
    tableName: "resources",
    resourceName: "resource",
    fields: [
      { key: "employeeId", column: "employee_id", required: true, type: "number" },
      { key: "name", column: "name", required: true, type: "string" },
      { key: "orgChart", column: "org_chart", required: false, type: "string" },
      { key: "employmentStatus", column: "employment_status", required: true, type: "string" },
      { key: "employmentType", column: "employment_type", required: true, type: "string" },
      { key: "region", column: "region", required: false, type: "string" },
      { key: "subDivision", column: "sub_division", required: true, type: "string" },
      { key: "position", column: "position", required: true, type: "string" },
      { key: "onsiteLocation", column: "onsite_location", required: false, type: "string" },
      { key: "offshoreLocation", column: "offshore_location", required: false, type: "string" },
      {
        key: "locationType",
        column: "location_type",
        required: true,
        type: "enum",
        values: ["Onsite", "Offshore"],
      },
      { key: "designation", column: "designation", required: true, type: "string" },
      { key: "skill", column: "skill", required: false, type: "string", maxLength: 20000 },
      { key: "geBatch", column: "ge_batch", required: true, type: "string" },
      { key: "kaarExperience", column: "kaar_experience", required: true, type: "number" },
      { key: "sapExperience", column: "sap_experience", required: false, type: "number" },
      { key: "totalExperience", column: "total_experience", required: true, type: "number" },
    ],
  },
  {
    route: "departments",
    tableName: "departments",
    resourceName: "department",
    hasCode: true,
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "resource-cost",
    tableName: "resource_cost",
    resourceName: "resource_cost",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "teams",
    tableName: "teams",
    resourceName: "team",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "resource-deployment",
    tableName: "resource_deployment",
    resourceName: "resource_deployment",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
];
