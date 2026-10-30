import { test } from "node:test";
import assert from "node:assert/strict";
import { MASTER_DATA_TABLES as MIRROR } from "./masterDataTables.js";
import { MASTER_DATA_TABLES as BACKEND } from "../../backend/src/masterDataTables.js";

// The mcp-server keeps its own copy of the backend's table descriptors (it
// is a separate package, see masterDataTables.js). Nothing else detects the
// copies drifting, so compare the parts that drive tool behaviour: the
// route set, hasCode (tool descriptions), and each field's key/required/
// type/maxLength/enum values (zod validation).

const shape = (f) => ({
  key: f.key,
  required: Boolean(f.required),
  type: f.type,
  maxLength: f.maxLength ?? null,
  values: f.values ?? null,
});

test("the mirror covers exactly the backend's set of routes", () => {
  assert.deepEqual(
    MIRROR.map((t) => t.route).sort(),
    BACKEND.map((t) => t.route).sort()
  );
});

for (const backendTable of BACKEND) {
  test(`${backendTable.route}: mirror fields and hasCode match the backend descriptor`, () => {
    const mirrorTable = MIRROR.find((t) => t.route === backendTable.route);
    assert.ok(mirrorTable, `${backendTable.route} missing from the mcp-server mirror`);
    assert.equal(Boolean(mirrorTable.hasCode), Boolean(backendTable.hasCode));
    assert.deepEqual(mirrorTable.fields.map(shape), backendTable.fields.map(shape));
  });
}

test("departments mirror exposes optional input/output capped at 2,000 characters (FEAT-20)", () => {
  const departments = MIRROR.find((t) => t.route === "departments");
  for (const key of ["input", "output"]) {
    const field = departments.fields.find((f) => f.key === key);
    assert.ok(field, `${key} missing`);
    assert.equal(field.required, false);
    assert.equal(field.maxLength, 2000);
  }
});
