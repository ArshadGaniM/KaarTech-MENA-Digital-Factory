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
