import { test } from "node:test";
import assert from "node:assert/strict";
import { toResponse, validateBody } from "./masterDataSchema.js";

test("toResponse maps snake_case db columns to camelCase fields", () => {
  const row = {
    id: "1",
    name: "SAP",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };
  assert.deepEqual(toResponse(row), {
    id: "1",
    name: "SAP",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  });
});

test("validateBody accepts a valid create payload", () => {
  assert.doesNotThrow(() => validateBody({ name: "SAP" }));
});

test("validateBody rejects a missing name on create", () => {
  assert.throws(() => validateBody({}), (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, "validation_error");
    assert.ok(err.details.name);
    return true;
  });
});

test("validateBody rejects a blank name", () => {
  assert.throws(() => validateBody({ name: "   " }));
});

test("validateBody partial mode does not require name when omitted", () => {
  assert.doesNotThrow(() => validateBody({}, { partial: true }));
});

test("validateBody partial mode still validates name when present", () => {
  assert.throws(() => validateBody({ name: "" }, { partial: true }));
});
