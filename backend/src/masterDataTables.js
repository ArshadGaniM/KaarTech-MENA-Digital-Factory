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
    // FEAT-12 (Entity Relationship page): the single source-of-truth
    // identity field for a table with no `hasCode` trigger — caller-
    // supplied and DB-enforced-unique, not auto-generated. Purely
    // descriptive metadata; nothing in masterDataRouter.js/masterDataSchema.js
    // reads this field, only backend/src/entityRelationships.js does.
    identityField: "employeeId",
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
    // No `hasCode`/`identityField` — deliberately no single identity field
    // (a cost record is identified by its FK to Resources, not its own
    // key). See entityRelationships.js's identityOf(): this intentionally
    // falls through to identity type "none", same reasoning as
    // project_assignments below.
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
    // No `hasCode`/`identityField` — deliberately no single identity field,
    // same reasoning as resource_cost above (identified by its FKs, not
    // its own key). entityRelationships.js's identityOf() falls through
    // to identity type "none" for this table intentionally.
    // Dropped the placeholder `name` column (migration 0016) — same
    // reasoning as resource_cost (0013): the list query's ORDER BY needs
    // an explicit override since it no longer has one to fall back on.
    sortColumn: "employee_id",
    // employeeName/positionName are NOT stored columns — they're live
    // joins against resources/positions at read time (see
    // masterDataSchema.js's lookupJoinSql/lookupSelectSql/toResponse).
    // This is the first table needing two lookup entries at once;
    // buildLookupPlan already maps generically over `table.lookups ?? []`,
    // aliasing each `lookup_${index}`, so this is a plain two-entry array.
    lookups: [
      {
        table: "resources",
        localColumn: "employee_id",
        foreignColumn: "employee_id",
        projections: [{ key: "employeeName", column: "name" }],
      },
      {
        table: "positions",
        localColumn: "position_code",
        foreignColumn: "code",
        projections: [{ key: "positionName", column: "name" }],
      },
    ],
    fields: [
      {
        key: "employeeId",
        column: "employee_id",
        required: true,
        type: "number",
        // Enforced FK, same mechanism as resource_cost.employeeId ->
        // resources.employee_id: validateReferences() 422s if no
        // matching, non-deleted Resources row exists.
        references: { table: "resources", column: "employee_id" },
      },
      {
        key: "positionId",
        column: "position_code",
        required: true,
        type: "string",
        // This was originally planned as an unvalidated placeholder
        // (matching modules.practiceId) because Positions didn't exist
        // yet — Positions now exists (FEAT-9), so this is a real
        // enforced FK, same mechanism as positions.teamCode ->
        // teams.code. References positions' own auto-generated `code`
        // column, not `id`. The column is named `position_code` (per
        // the naming-the-column-after-what-it-stores convention,
        // matching department_code/team_code) even though the JSON/API
        // key stays `positionId`.
        references: { table: "positions", column: "code" },
      },
    ],
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
  {
    route: "projects",
    tableName: "projects",
    resourceName: "project",
    // See resources.identityField's comment — same reasoning.
    identityField: "projectId",
    // No `name` column (unlike every hasCode table) — all three business
    // fields are manually entered, none auto-generated, so there's no
    // "name" to fall back on for the default sort.
    sortColumn: "project_id",
    // No `references`/`lookups` — no reference table was named for
    // projectProfitCenterCode, so this table has zero FK relationships,
    // unlike every other table added since FEAT-5.
    fields: [
      {
        key: "projectId",
        column: "project_id",
        required: true,
        type: "string",
        // Caller-supplied, DB-enforced-unique identifier — same pattern
        // as resources.employeeId (migration 0012), not an auto-generated
        // `code` (no hasCode here).
      },
      { key: "projectName", column: "project_name", required: true, type: "string" },
      {
        key: "projectProfitCenterCode",
        column: "project_profit_center_code",
        required: true,
        type: "string",
      },
    ],
  },
  {
    route: "project-assignments",
    tableName: "project_assignments",
    resourceName: "project_assignment",
    // No `name`/`hasCode` — the closest thing to an identifier here is the
    // combination of projectId/teamId/date range, none of which is a
    // single sortable business key either, so this falls back to the same
    // "sort by the first required FK field" convention resource_deployment
    // established.
    sortColumn: "project_id",
    // FEAT-11: the first table needing a CHAINED/transitive lookup — the
    // department fields aren't a direct column on this table at all, they
    // come from the *linked Team's own* department_code, so `via: "teams"`
    // joins the `departments` lookup off the `teams` lookup's own alias
    // (see masterDataSchema.js's buildLookupPlan) instead of off
    // project_assignments directly. `via` targets must be declared earlier
    // in this array — teams' own entry comes first, department's second.
    lookups: [
      {
        table: "projects",
        localColumn: "project_id",
        foreignColumn: "project_id",
        projections: [
          { key: "projectName", column: "project_name" },
          { key: "projectProfitCenterCode", column: "project_profit_center_code" },
        ],
      },
      {
        table: "teams",
        localColumn: "team_code",
        foreignColumn: "code",
        projections: [{ key: "teamName", column: "name" }],
      },
      {
        table: "departments",
        via: "teams",
        // department_code is a column on `teams` (not on
        // project_assignments) — this is the transitive hop.
        localColumn: "department_code",
        foreignColumn: "code",
        projections: [
          { key: "departmentId", column: "code" },
          { key: "departmentName", column: "name" },
        ],
      },
    ],
    fields: [
      {
        key: "projectId",
        column: "project_id",
        required: true,
        type: "string",
        // Pick-list only per the owner's spec (no manual entry) — enforced
        // the same way as every other FK field: validateReferences() 422s
        // if no matching, non-deleted Projects row exists. There is no
        // separate app-layer mechanism for "reject a syntactically valid
        // but not-in-the-pick-list value" beyond this FK check, since a
        // value failing FK validation IS exactly "not in the pick list".
        references: { table: "projects", column: "project_id" },
      },
      {
        key: "teamId",
        column: "team_code",
        required: true,
        type: "string",
        // Pick-list only, same reasoning as projectId above. References
        // teams' own auto-generated `code` column, not `id`.
        references: { table: "teams", column: "code" },
      },
      {
        key: "projectAssignmentStartDate",
        column: "project_assignment_start_date",
        required: true,
        // Deliberately NOT "Start Date" — the owner specified this exact
        // label/field name, distinguishing it from a generic date field.
        type: "date",
      },
      {
        key: "projectAssignmentEndDate",
        column: "project_assignment_end_date",
        required: true,
        type: "date",
      },
    ],
    // FEAT-11: the first table needing cross-field validation — a rule
    // that can only be checked once both dates are known, unlike every
    // per-field check validateBody already does. See
    // masterDataSchema.js's validateCrossFields for how a PATCH that only
    // sends one of the two dates is still checked against the other's
    // real, currently-stored value.
    crossFieldValidations: [
      {
        type: "dateRange",
        startKey: "projectAssignmentStartDate",
        endKey: "projectAssignmentEndDate",
        message: "projectAssignmentEndDate must not be earlier than projectAssignmentStartDate.",
      },
    ],
  },
];
