import { test } from "node:test";
import assert from "node:assert/strict";
import { toResponse, validateBody } from "./masterDataSchema.js";

const SIMPLE_TABLE = {
  fields: [{ key: "name", column: "name", required: true, type: "string" }],
};

const DELIVERY_CENTER_TABLE = {
  hasCode: true,
  fields: [
    { key: "name", column: "name", required: true, type: "string" },
    { key: "locationType", column: "location_type", required: true, type: "enum", values: ["onshore", "offshore"] },
    { key: "city", column: "city", required: true, type: "string" },
    { key: "country", column: "country", required: true, type: "string" },
  ],
};

test("toResponse maps snake_case db columns to camelCase fields (simple table)", () => {
  const row = {
    id: "1",
    name: "SAP",
    created_by: "Arshad Ghani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Ghani",
    updated_at: "2026-01-02T00:00:00Z",
  };
  assert.deepEqual(toResponse(SIMPLE_TABLE, row), {
    id: "1",
    name: "SAP",
    createdBy: "Arshad Ghani",
    createdAt: "2026-01-01T00:00:00Z",
    updatedBy: "Arshad Ghani",
    updatedAt: "2026-01-02T00:00:00Z",
  });
});

test("toResponse includes code for a hasCode table", () => {
  const row = {
    id: "1",
    code: "DC-001",
    name: "Khobar Delivery Center",
    location_type: "onshore",
    city: "Khobar",
    country: "Kingdom of Saudi Arabia",
    created_by: "Arshad Ghani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Ghani",
    updated_at: "2026-01-01T00:00:00Z",
  };
  const response = toResponse(DELIVERY_CENTER_TABLE, row);
  assert.equal(response.code, "DC-001");
  assert.equal(response.locationType, "onshore");
  assert.equal(response.city, "Khobar");
});

test("validateBody accepts a valid create payload", () => {
  assert.doesNotThrow(() => validateBody(SIMPLE_TABLE, { name: "SAP" }));
});

test("validateBody rejects a missing name on create", () => {
  assert.throws(() => validateBody(SIMPLE_TABLE, {}), (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, "validation_error");
    assert.ok(err.details.name);
    return true;
  });
});

test("validateBody rejects a blank name", () => {
  assert.throws(() => validateBody(SIMPLE_TABLE, { name: "   " }));
});

test("validateBody partial mode does not require name when omitted", () => {
  assert.doesNotThrow(() => validateBody(SIMPLE_TABLE, {}, { partial: true }));
});

test("validateBody partial mode still validates name when present", () => {
  assert.throws(() => validateBody(SIMPLE_TABLE, { name: "" }, { partial: true }));
});

test("validateBody rejects an invalid enum value", () => {
  assert.throws(
    () =>
      validateBody(DELIVERY_CENTER_TABLE, {
        name: "Khobar Delivery Center",
        locationType: "hybrid",
        city: "Khobar",
        country: "Kingdom of Saudi Arabia",
      }),
    (err) => {
      assert.ok(err.details.locationType);
      return true;
    }
  );
});

test("validateBody accepts a valid enum value", () => {
  assert.doesNotThrow(() =>
    validateBody(DELIVERY_CENTER_TABLE, {
      name: "Khobar Delivery Center",
      locationType: "onshore",
      city: "Khobar",
      country: "Kingdom of Saudi Arabia",
    })
  );
});

test("validateBody requires all fields on create, not just name", () => {
  assert.throws(() => validateBody(DELIVERY_CENTER_TABLE, { name: "Khobar Delivery Center" }), (err) => {
    assert.ok(err.details.locationType);
    assert.ok(err.details.city);
    assert.ok(err.details.country);
    return true;
  });
});

test("validateBody partial mode only validates fields present in the body", () => {
  assert.doesNotThrow(() => validateBody(DELIVERY_CENTER_TABLE, { city: "Riyadh" }, { partial: true }));
});
