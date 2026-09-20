import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEntityRelationships } from "./entityRelationships.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";

// FEAT-12: pure data-transformation tests — no HTTP, no DB. Exercised both
// against small hand-built fixtures (to pin exact shape/edge cases) and
// against the real MASTER_DATA_TABLES (to prove it doesn't crash on any
// live table's actual descriptor, including chained lookups).

test("a hasCode table gets an auto-generated identity, no identityField needed", () => {
  const [entry] = buildEntityRelationships([
    { route: "practices", tableName: "practices", resourceName: "practice", hasCode: true, fields: [] },
  ]);
  assert.deepEqual(entry.identity, { type: "auto-generated", field: "code" });
});

test("a table with identityField and no hasCode gets a caller-supplied-unique identity", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "resources",
      tableName: "resources",
      resourceName: "resource",
      identityField: "employeeId",
      fields: [{ key: "employeeId", column: "employee_id", required: true, type: "number" }],
    },
  ]);
  assert.deepEqual(entry.identity, { type: "caller-supplied-unique", field: "employeeId" });
});

test("a table with neither hasCode nor identityField gets identity type 'none' (e.g. project_assignments)", () => {
  const [entry] = buildEntityRelationships([
    { route: "project-assignments", tableName: "project_assignments", resourceName: "project_assignment", fields: [] },
  ]);
  assert.deepEqual(entry.identity, { type: "none" });
});

test("hasCode takes precedence over identityField if a table somehow declared both (shouldn't happen, but hasCode wins deterministically)", () => {
  const [entry] = buildEntityRelationships([
    { route: "x", tableName: "x", resourceName: "x", hasCode: true, identityField: "foo", fields: [] },
  ]);
  assert.deepEqual(entry.identity, { type: "auto-generated", field: "code" });
});

test("fields with `references` are surfaced as relationships; fields without are not (e.g. modules.practiceId)", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "teams",
      tableName: "teams",
      resourceName: "team",
      fields: [
        { key: "name", column: "name", required: true, type: "string" },
        {
          key: "departmentCode",
          column: "department_code",
          required: true,
          type: "string",
          references: { table: "departments", column: "code" },
        },
      ],
    },
  ]);
  assert.deepEqual(entry.relationships, [
    { field: "departmentCode", referencesTable: "departments", referencesColumn: "code" },
  ]);
});

test("a table with no `references` anywhere has an empty relationships array, not a crash (e.g. modules.practiceId is deliberately unvalidated)", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "modules",
      tableName: "modules",
      resourceName: "module",
      fields: [{ key: "practiceId", column: "practice_id", required: false, type: "string" }],
    },
  ]);
  assert.deepEqual(entry.relationships, []);
});

test("a direct (non-chained) lookup surfaces via: null", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "resource-cost",
      tableName: "resource_cost",
      resourceName: "resource_cost",
      fields: [],
      lookups: [
        {
          table: "resources",
          localColumn: "employee_id",
          foreignColumn: "employee_id",
          projections: [{ key: "employeeName", column: "name" }],
        },
      ],
    },
  ]);
  assert.deepEqual(entry.lookups, [{ key: "employeeName", sourceTable: "resources", via: null }]);
});

test("a chained lookup (lookup.via) surfaces the chain, distinguishing it from the direct lookups on the same table", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "project-assignments",
      tableName: "project_assignments",
      resourceName: "project_assignment",
      fields: [],
      lookups: [
        {
          table: "teams",
          localColumn: "team_code",
          foreignColumn: "code",
          projections: [{ key: "teamName", column: "name" }],
        },
        {
          table: "departments",
          via: "teams",
          localColumn: "department_code",
          foreignColumn: "code",
          projections: [
            { key: "departmentId", column: "code" },
            { key: "departmentName", column: "name" },
          ],
        },
      ],
    },
  ]);
  assert.deepEqual(entry.lookups, [
    { key: "teamName", sourceTable: "teams", via: null },
    { key: "departmentId", sourceTable: "departments", via: "teams" },
    { key: "departmentName", sourceTable: "departments", via: "teams" },
  ]);
});

test("a table with no `lookups` key at all has an empty lookups array, not a crash", () => {
  const [entry] = buildEntityRelationships([
    { route: "practices", tableName: "practices", resourceName: "practice", hasCode: true, fields: [] },
  ]);
  assert.deepEqual(entry.lookups, []);
});

test("runs against the real MASTER_DATA_TABLES without crashing, and covers every table exactly once", () => {
  const entries = buildEntityRelationships(MASTER_DATA_TABLES);
  assert.equal(entries.length, MASTER_DATA_TABLES.length);
  const routes = entries.map((e) => e.route).sort();
  assert.deepEqual(routes, MASTER_DATA_TABLES.map((t) => t.route).sort());
});

test("the real project-assignments entry has identity type 'none' and a chained departmentId/departmentName lookup", () => {
  const entries = buildEntityRelationships(MASTER_DATA_TABLES);
  const projectAssignments = entries.find((e) => e.route === "project-assignments");
  assert.deepEqual(projectAssignments.identity, { type: "none" });
  const departmentLookups = projectAssignments.lookups.filter((l) => l.via === "teams");
  assert.deepEqual(
    departmentLookups.map((l) => l.key).sort(),
    ["departmentId", "departmentName"]
  );
});

test("the real resource-deployment entry has two relationships (employeeId, positionId)", () => {
  const entries = buildEntityRelationships(MASTER_DATA_TABLES);
  const resourceDeployment = entries.find((e) => e.route === "resource-deployment");
  assert.deepEqual(
    resourceDeployment.relationships.map((r) => r.field).sort(),
    ["employeeId", "positionId"]
  );
});

// FEAT-14: `fields` — the writable field list an "Add <Entity>" form
// builds itself from.

test("fields lists exactly table.fields' keys, in order — auto-generated code and lookup projections never appear (they're not in table.fields to begin with)", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "practices",
      tableName: "practices",
      resourceName: "practice",
      hasCode: true,
      fields: [{ key: "name", column: "name", required: true, type: "string" }],
    },
  ]);
  assert.deepEqual(entry.fields, [{ key: "name", type: "string", required: true }]);
});

test("a required field with maxLength/values surfaces them; a plain field omits both keys entirely rather than sending them as null/undefined", () => {
  const [entry] = buildEntityRelationships([
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
      ],
    },
  ]);
  assert.deepEqual(entry.fields[0], { key: "name", type: "string", required: true });
  assert.deepEqual(entry.fields[1], {
    key: "locationType",
    type: "enum",
    required: true,
    values: ["onshore", "offshore"],
  });
  assert.ok(!("maxLength" in entry.fields[0]));
  assert.ok(!("values" in entry.fields[0]));
});

test("a references field resolves the target table's REST route by tableName, for the Add form's pick-list fetch", () => {
  const entries = buildEntityRelationships([
    { route: "teams", tableName: "teams", resourceName: "team", hasCode: true, fields: [] },
    {
      route: "positions",
      tableName: "positions",
      resourceName: "position",
      hasCode: true,
      fields: [
        {
          key: "teamCode",
          column: "team_code",
          required: true,
          type: "string",
          references: { table: "teams", column: "code" },
        },
      ],
    },
  ]);
  const positions = entries.find((e) => e.route === "positions");
  assert.deepEqual(positions.fields[0].references, { table: "teams", route: "teams" });
});

test("a references field pointing at a table not present in the full list resolves route to null rather than crashing", () => {
  const [entry] = buildEntityRelationships([
    {
      route: "modules",
      tableName: "modules",
      resourceName: "module",
      fields: [
        {
          key: "practiceId",
          column: "practice_id",
          required: false,
          type: "string",
          references: { table: "practices", column: "id" },
        },
      ],
    },
  ]);
  assert.deepEqual(entry.fields[0].references, { table: "practices", route: null });
});

test("the real project-assignments entry's fields resolve both FK routes correctly, matching real routes not table names", () => {
  const entries = buildEntityRelationships(MASTER_DATA_TABLES);
  const projectAssignments = entries.find((e) => e.route === "project-assignments");
  const projectIdField = projectAssignments.fields.find((f) => f.key === "projectId");
  const teamIdField = projectAssignments.fields.find((f) => f.key === "teamId");
  assert.deepEqual(projectIdField.references, { table: "projects", route: "projects" });
  assert.deepEqual(teamIdField.references, { table: "teams", route: "teams" });
});
