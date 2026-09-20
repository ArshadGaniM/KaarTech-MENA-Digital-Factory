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
    // Dropped the placeholder `name` column (migration 0013) — the list
    // query's ORDER BY needs an explicit override since it no longer has
    // one to fall back on (see masterDataRouter.js's `sortColumn` usage).
    sortColumn: "employee_id",
    // employeeName/employeeDesignation are NOT stored columns — they're a
    // live join against resources at read time, so this table never has
    // its own copy of Resources' data to drift out of sync. See
    // masterDataSchema.js's lookupJoinSql/lookupSelectSql/toResponse.
    lookups: [
      {
        table: "resources",
        localColumn: "employee_id",
        foreignColumn: "employee_id",
        projections: [
          { key: "employeeName", column: "name" },
          { key: "employeeDesignation", column: "designation" },
        ],
      },
    ],
    fields: [
      {
        key: "employeeId",
        column: "employee_id",
        required: true,
        type: "number",
        // Unlike modules.practiceId (deliberately unvalidated), this FK
        // is enforced: masterDataSchema.js's validateReferences() rejects
        // the request with a 422 if no matching, non-deleted Resources
        // row exists. `references.table`/`.column` come from this fixed
        // descriptor only, never from request input, so interpolating
        // them into SQL is safe (same reasoning as tableName/column above).
        references: { table: "resources", column: "employee_id" },
      },
      // Independently optional — a resource is typically Onsite or
      // Offshore (per its own Resources.locationType), but that's not
      // enforced here; either, both, or neither may be set.
      { key: "offshoreCost", column: "offshore_cost", required: false, type: "number" },
      { key: "onsiteCost", column: "onsite_cost", required: false, type: "number" },
    ],
  },
  {
    route: "teams",
    tableName: "teams",
    resourceName: "team",
    hasCode: true,
    // departmentName is NOT a stored column — it's a live lookup against
    // departments at read time (see lookupJoinSql/lookupSelectSql/
    // toResponse above), same mechanism as resource_cost's
    // employeeName/employeeDesignation.
    lookups: [
      {
        table: "departments",
        localColumn: "department_code",
        foreignColumn: "code",
        projections: [{ key: "departmentName", column: "name" }],
      },
    ],
    fields: [
      { key: "name", column: "name", required: true, type: "string" },
      {
        key: "departmentCode",
        column: "department_code",
        required: true,
        type: "string",
        // Enforced FK, same mechanism as resource_cost.employeeId ->
        // resources.employee_id: validateReferences() 422s if no
        // matching, non-deleted Departments row exists. References
        // departments' own auto-generated `code` column, not `id`.
        references: { table: "departments", column: "code" },
      },
    ],
  },
  {
    route: "resource-deployment",
    tableName: "resource_deployment",
    resourceName: "resource_deployment",
    fields: [{ key: "name", column: "name", required: true, type: "string" }],
  },
  {
    route: "positions",
    tableName: "positions",
    resourceName: "position",
    hasCode: true,
    // teamName is NOT a stored column — it's a live lookup against teams
    // at read time (see lookupJoinSql/lookupSelectSql/toResponse above),
    // same mechanism as teams.departmentName.
    lookups: [
      {
        table: "teams",
        localColumn: "team_code",
        foreignColumn: "code",
        projections: [{ key: "teamName", column: "name" }],
      },
    ],
    fields: [
      { key: "name", column: "name", required: true, type: "string" },
      {
        key: "teamCode",
        column: "team_code",
        required: true,
        type: "string",
        // Enforced FK, same mechanism as teams.departmentCode ->
        // departments.code: validateReferences() 422s if no matching,
        // non-deleted Teams row exists. References teams' own
        // auto-generated `code` column, not `id`.
        references: { table: "teams", column: "code" },
      },
    ],
  },
];
