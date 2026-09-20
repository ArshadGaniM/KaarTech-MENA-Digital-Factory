// Mirrors backend/src/masterDataTables.js — kept as a separate copy because
// this package has no workspace link to the backend, but the two lists must
// stay in sync. slug is the tool-name suffix (add_<slug>, update_<slug>,
// delete_<slug>); route matches the backend's REST path segment.
//
// fields describes each table's own business columns (beyond name), used
// to build each add_/update_ tool's zod input shape. Same shape as the
// backend's field list: key (camelCase JSON field), label (for the tool
// description), and for enum fields, values.
export const MASTER_DATA_TABLES = [
  {
    slug: "practice",
    route: "practices",
    label: "Practice",
    hasCode: true,
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "delivery_center",
    route: "delivery-centers",
    label: "Delivery Center",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      {
        key: "locationType",
        label: "onshore/offshore classification",
        required: true,
        type: "enum",
        values: ["onshore", "offshore"],
      },
      { key: "city", label: "city", required: true, type: "string" },
      { key: "country", label: "country", required: true, type: "string" },
    ],
  },
  {
    slug: "competency",
    route: "competencies",
    label: "Competency",
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "module",
    route: "modules",
    label: "Module",
    hasCode: true,
    fields: [
      { key: "moduleCode", label: "module code (manually assigned, distinct from the auto-generated id)", required: true, type: "string" },
      { key: "name", label: "name", required: true, type: "string" },
      {
        key: "practiceId",
        label: "the linked Practice's id (from the Practices table) — optional, not validated against Practices, can be set later via update_module",
        required: false,
        type: "string",
      },
    ],
  },
  {
    slug: "resource",
    route: "resources",
    label: "Resource",
    fields: [
      {
        key: "employeeId",
        label: "employee ID — caller-supplied, not auto-generated, must be unique",
        required: true,
        type: "number",
      },
      { key: "name", label: "name", required: true, type: "string" },
      { key: "orgChart", label: "org chart", required: false, type: "string" },
      { key: "employmentStatus", label: "employment/project status", required: true, type: "string" },
      { key: "employmentType", label: "employment type", required: true, type: "string" },
      { key: "region", label: "region", required: false, type: "string" },
      { key: "subDivision", label: "sub division", required: true, type: "string" },
      { key: "position", label: "position", required: true, type: "string" },
      { key: "onsiteLocation", label: "onsite location", required: false, type: "string" },
      { key: "offshoreLocation", label: "offshore location", required: false, type: "string" },
      {
        key: "locationType",
        label: "onsite/offshore classification",
        required: true,
        type: "enum",
        values: ["Onsite", "Offshore"],
      },
      { key: "designation", label: "designation", required: true, type: "string" },
      {
        key: "skill",
        label: "skill (a long comma-separated list, up to 20000 characters)",
        required: false,
        type: "string",
        maxLength: 20000,
      },
      { key: "geBatch", label: "GE batch", required: true, type: "string" },
      { key: "kaarExperience", label: "Kaar experience, in years", required: true, type: "number" },
      { key: "sapExperience", label: "SAP experience, in years", required: false, type: "number" },
      { key: "totalExperience", label: "total experience, in years", required: true, type: "number" },
    ],
  },
  {
    slug: "department",
    route: "departments",
    label: "Department",
    hasCode: true,
    fields: [{ key: "name", label: "name", required: true, type: "string" }],
  },
  {
    slug: "resource_cost",
    route: "resource-cost",
    label: "Resource Cost",
    // employeeName/employeeDesignation are NOT writable here — they're a
    // live lookup against the Resources table's current data, returned
    // by the backend's GET responses but never accepted on add_/update_.
    fields: [
      {
        key: "employeeId",
        label:
          "employee ID — must match an existing Resources.employeeId; the backend rejects the " +
          "request with a validation error if no such Resource exists (unlike modules.practiceId, " +
          "this reference IS validated)",
        required: true,
        type: "number",
      },
      { key: "offshoreCost", label: "offshore cost (optional — independent of onsiteCost)", required: false, type: "number" },
      { key: "onsiteCost", label: "onsite cost (optional — independent of offshoreCost)", required: false, type: "number" },
    ],
  },
  {
    slug: "team",
    route: "teams",
    label: "Team",
    hasCode: true,
    // departmentName is NOT writable here — it's a live lookup against
    // the Departments table's current data, returned by the backend's
    // GET responses but never accepted on add_/update_.
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      {
        key: "departmentCode",
        label:
          "the linked Department's business code (from the Departments table's own auto-generated " +
          "code, e.g. DEPT-001) — must match an existing, non-deleted Department; the backend rejects " +
          "the request with a validation error if no such Department exists",
        required: true,
        type: "string",
      },
    ],
  },
  {
    slug: "resource_deployment",
    route: "resource-deployment",
    label: "Resource Deployment",
    // employeeName/positionName are NOT writable here — they're live
    // lookups against the Resources/Positions tables' current data,
    // returned by the backend's GET responses but never accepted on
    // add_/update_.
    fields: [
      {
        key: "employeeId",
        label:
          "employee ID — must match an existing Resources.employeeId; the backend rejects the " +
          "request with a validation error if no such Resource exists",
        required: true,
        type: "number",
      },
      {
        key: "positionId",
        label:
          "the linked Position's business code (from the Positions table's own auto-generated " +
          "code, e.g. POS-001) — must match an existing, non-deleted Position; the backend rejects " +
          "the request with a validation error if no such Position exists",
        required: true,
        type: "string",
      },
    ],
  },
  {
    slug: "position",
    route: "positions",
    label: "Position",
    hasCode: true,
    // teamName is NOT writable here — it's a live lookup against the
    // Teams table's current data, returned by the backend's GET
    // responses but never accepted on add_/update_.
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      {
        key: "teamCode",
        label:
          "the linked Team's business code (from the Teams table's own auto-generated code, " +
          "e.g. TEAM-001) — must match an existing, non-deleted Team; the backend rejects the " +
          "request with a validation error if no such Team exists",
        required: true,
        type: "string",
      },
    ],
  },
  {
    slug: "project",
    route: "projects",
    label: "Project",
    // No hasCode — unlike every other business-identifier table, none of
    // Project's fields are auto-generated: all three are manually entered
    // by the caller. No FK/lookup fields either — no reference table was
    // named for projectProfitCenterCode.
    fields: [
      {
        key: "projectId",
        label: "project ID — caller-supplied, not auto-generated, must be unique",
        required: true,
        type: "string",
      },
      { key: "projectName", label: "project name", required: true, type: "string" },
      {
        key: "projectProfitCenterCode",
        label: "profit center code (plain string, no FK validation)",
        required: true,
        type: "string",
      },
    ],
  },
];
