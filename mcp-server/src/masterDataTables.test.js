import { test } from "node:test";
import assert from "node:assert/strict";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { fieldSchema } from "./index.js";

// FEAT-5: resource_cost's mirrored tool-field descriptor. Pure data
// assertions — no network, no MCP transport (index.js's stdio connect is
// guarded so importing it here for fieldSchema is side-effect free).

function resourceCostTable() {
  const table = MASTER_DATA_TABLES.find((t) => t.slug === "resource_cost");
  assert.ok(table, "resource_cost entry must exist in the mcp-server mirror");
  return table;
}

test("resource_cost's writable fields are exactly employeeId/offshoreCost/onsiteCost", () => {
  const fieldKeys = resourceCostTable().fields.map((f) => f.key).sort();
  assert.deepEqual(fieldKeys, ["employeeId", "offshoreCost", "onsiteCost"]);
});

test("resource_cost never exposes employeeName/employeeDesignation as a writable MCP field (live lookup only)", () => {
  const fieldKeys = resourceCostTable().fields.map((f) => f.key);
  assert.ok(!fieldKeys.includes("employeeName"));
  assert.ok(!fieldKeys.includes("employeeDesignation"));
});

test("resource_cost's employeeId is required and numeric", () => {
  const employeeId = resourceCostTable().fields.find((f) => f.key === "employeeId");
  assert.equal(employeeId.type, "number");
  assert.equal(employeeId.required, true);
});

test("resource_cost's offshoreCost and onsiteCost are both independently optional", () => {
  const table = resourceCostTable();
  const offshoreCost = table.fields.find((f) => f.key === "offshoreCost");
  const onsiteCost = table.fields.find((f) => f.key === "onsiteCost");
  assert.equal(offshoreCost.required, false);
  assert.equal(onsiteCost.required, false);
});

test("resource_cost's employeeId label documents that the FK IS validated (unlike modules.practiceId)", () => {
  const employeeId = resourceCostTable().fields.find((f) => f.key === "employeeId");
  assert.match(employeeId.label, /validated|rejects/i);
});

// --- fieldSchema (index.js's type -> zod mapping, applied to resource_cost's fields) ---

test("fieldSchema maps a number-type field to a zod number that rejects a string employeeId", () => {
  const employeeId = resourceCostTable().fields.find((f) => f.key === "employeeId");
  const schema = fieldSchema(employeeId);
  assert.equal(schema.safeParse(12345).success, true);
  assert.equal(schema.safeParse("12345").success, false);
});

test("fieldSchema maps a number-type field to a zod schema that rejects NaN/Infinity", () => {
  const offshoreCost = resourceCostTable().fields.find((f) => f.key === "offshoreCost");
  const schema = fieldSchema(offshoreCost);
  assert.equal(schema.safeParse(500).success, true);
  assert.equal(schema.safeParse(Infinity).success, false);
});

// FEAT-8: team's mirrored tool-field descriptor. Same enforced-FK/lookup
// shape as resource_cost.employeeId, applied to a second reference field
// (departmentCode -> departments.code) — mirrors resourceCostTable()'s
// assertions above rather than inventing a new pattern.

function teamTable() {
  const table = MASTER_DATA_TABLES.find((t) => t.slug === "team");
  assert.ok(table, "team entry must exist in the mcp-server mirror");
  return table;
}

test("team's writable fields are exactly name/departmentCode", () => {
  const fieldKeys = teamTable().fields.map((f) => f.key).sort();
  assert.deepEqual(fieldKeys, ["departmentCode", "name"]);
});

test("team never exposes code or departmentName as a writable MCP field (auto-generated / live lookup only)", () => {
  const fieldKeys = teamTable().fields.map((f) => f.key);
  assert.ok(!fieldKeys.includes("code"));
  assert.ok(!fieldKeys.includes("departmentName"));
});

test("team's hasCode flag is set so add_team/update_team's tool description reflects the auto-generated code", () => {
  assert.equal(teamTable().hasCode, true);
});

test("team's name and departmentCode are both required strings", () => {
  const table = teamTable();
  const name = table.fields.find((f) => f.key === "name");
  const departmentCode = table.fields.find((f) => f.key === "departmentCode");
  assert.equal(name.type, "string");
  assert.equal(name.required, true);
  assert.equal(departmentCode.type, "string");
  assert.equal(departmentCode.required, true);
});

test("team's departmentCode label documents that the FK IS validated (matches resource_cost's employeeId label style)", () => {
  const departmentCode = teamTable().fields.find((f) => f.key === "departmentCode");
  assert.match(departmentCode.label, /validated|rejects/i);
});

test("fieldSchema maps team's string-type fields to zod strings that reject a non-string value", () => {
  const departmentCode = teamTable().fields.find((f) => f.key === "departmentCode");
  const schema = fieldSchema(departmentCode);
  assert.equal(schema.safeParse("DEPT-001").success, true);
  assert.equal(schema.safeParse(12345).success, false);
});

// FEAT-9: position's mirrored tool-field descriptor. Third table on the
// enforced-FK/lookup shape (teamCode -> teams.code), same assertions as
// resourceCostTable()/teamTable() above rather than inventing a new pattern.

function positionTable() {
  const table = MASTER_DATA_TABLES.find((t) => t.slug === "position");
  assert.ok(table, "position entry must exist in the mcp-server mirror");
  return table;
}

test("position's writable fields are exactly name/teamCode", () => {
  const fieldKeys = positionTable().fields.map((f) => f.key).sort();
  assert.deepEqual(fieldKeys, ["name", "teamCode"]);
});

test("position never exposes code or teamName as a writable MCP field (auto-generated / live lookup only)", () => {
  const fieldKeys = positionTable().fields.map((f) => f.key);
  assert.ok(!fieldKeys.includes("code"));
  assert.ok(!fieldKeys.includes("teamName"));
});

test("position's hasCode flag is set so add_position/update_position's tool description reflects the auto-generated code", () => {
  assert.equal(positionTable().hasCode, true);
});

test("position's name and teamCode are both required strings", () => {
  const table = positionTable();
  const name = table.fields.find((f) => f.key === "name");
  const teamCode = table.fields.find((f) => f.key === "teamCode");
  assert.equal(name.type, "string");
  assert.equal(name.required, true);
  assert.equal(teamCode.type, "string");
  assert.equal(teamCode.required, true);
});

test("position's teamCode label documents that the FK IS validated (matches team's departmentCode label style)", () => {
  const teamCode = positionTable().fields.find((f) => f.key === "teamCode");
  assert.match(teamCode.label, /validated|rejects/i);
});

test("fieldSchema maps position's string-type fields to zod strings that reject a non-string value", () => {
  const teamCode = positionTable().fields.find((f) => f.key === "teamCode");
  const schema = fieldSchema(teamCode);
  assert.equal(schema.safeParse("TEAM-001").success, true);
  assert.equal(schema.safeParse(12345).success, false);
});

// FEAT-7: resource_deployment's mirrored tool-field descriptor. The first
// table on this enforced-FK/lookup shape with TWO concurrent reference
// fields of two different types (employeeId -> resources.employee_id,
// numeric; positionId -> positions.code, string) — mirrors
// resourceCostTable()/teamTable()/positionTable()'s assertions above,
// extended to check both FK fields independently rather than just one.

function resourceDeploymentTable() {
  const table = MASTER_DATA_TABLES.find((t) => t.slug === "resource_deployment");
  assert.ok(table, "resource_deployment entry must exist in the mcp-server mirror");
  return table;
}

test("resource_deployment's writable fields are exactly employeeId/positionId", () => {
  const fieldKeys = resourceDeploymentTable().fields.map((f) => f.key).sort();
  assert.deepEqual(fieldKeys, ["employeeId", "positionId"]);
});

test("resource_deployment never exposes employeeName/positionName as a writable MCP field (live lookup only)", () => {
  const fieldKeys = resourceDeploymentTable().fields.map((f) => f.key);
  assert.ok(!fieldKeys.includes("employeeName"));
  assert.ok(!fieldKeys.includes("positionName"));
});

test("resource_deployment's employeeId and positionId are both required, with distinct types", () => {
  const table = resourceDeploymentTable();
  const employeeId = table.fields.find((f) => f.key === "employeeId");
  const positionId = table.fields.find((f) => f.key === "positionId");
  assert.equal(employeeId.type, "number");
  assert.equal(employeeId.required, true);
  assert.equal(positionId.type, "string");
  assert.equal(positionId.required, true);
});

test("resource_deployment's employeeId and positionId labels both independently document that their FK IS validated", () => {
  const table = resourceDeploymentTable();
  const employeeId = table.fields.find((f) => f.key === "employeeId");
  const positionId = table.fields.find((f) => f.key === "positionId");
  assert.match(employeeId.label, /validated|rejects/i);
  assert.match(positionId.label, /validated|rejects/i);
});

test("fieldSchema maps resource_deployment's two FK fields to their own distinct zod types (number vs string), not sharing one schema", () => {
  const table = resourceDeploymentTable();
  const employeeIdSchema = fieldSchema(table.fields.find((f) => f.key === "employeeId"));
  const positionIdSchema = fieldSchema(table.fields.find((f) => f.key === "positionId"));

  assert.equal(employeeIdSchema.safeParse(42).success, true);
  assert.equal(employeeIdSchema.safeParse("42").success, false);
  assert.equal(positionIdSchema.safeParse("POS-001").success, true);
  assert.equal(positionIdSchema.safeParse(42).success, false);
});
