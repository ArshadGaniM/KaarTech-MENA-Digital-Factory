import { test } from "node:test";
import assert from "node:assert/strict";
import { toResponse, validateBody, validateActor } from "./masterDataSchema.js";

const SIMPLE_TABLE = {
  fields: [{ key: "name", column: "name", required: true, type: "string" }],
};

const TABLE_WITH_OPTIONAL_FIELD = {
  fields: [
    { key: "name", column: "name", required: true, type: "string" },
    { key: "notes", column: "notes", required: false, type: "string" },
  ],
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
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-02T00:00:00Z",
    deleted_at: null,
  };
  assert.deepEqual(toResponse(SIMPLE_TABLE, row), {
    id: "1",
    name: "SAP",
    createdBy: "Arshad Gani",
    createdAt: "2026-01-01T00:00:00Z",
    updatedBy: "Arshad Gani",
    updatedAt: "2026-01-02T00:00:00Z",
    markedDeleted: "No",
  });
});

test("toResponse reports markedDeleted: 'Yes' for a soft-deleted row", () => {
  const row = {
    id: "1",
    name: "SAP",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-02T00:00:00Z",
    deleted_at: "2026-01-03T00:00:00Z",
  };
  assert.equal(toResponse(SIMPLE_TABLE, row).markedDeleted, "Yes");
});

test("toResponse treats a missing deleted_at the same as null (not deleted)", () => {
  const row = {
    id: "1",
    name: "SAP",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-02T00:00:00Z",
  };
  assert.equal(toResponse(SIMPLE_TABLE, row).markedDeleted, "No");
});

test("toResponse includes code for a hasCode table", () => {
  const row = {
    id: "1",
    code: "DC-001",
    name: "Khobar Delivery Center",
    location_type: "onshore",
    city: "Khobar",
    country: "Kingdom of Saudi Arabia",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
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

test("validateBody does not require a non-required field on create when omitted", () => {
  assert.doesNotThrow(() => validateBody(TABLE_WITH_OPTIONAL_FIELD, { name: "SAP" }));
});

test("validateBody still validates a non-required field when present but blank", () => {
  assert.throws(() => validateBody(TABLE_WITH_OPTIONAL_FIELD, { name: "SAP", notes: "" }), (err) => {
    assert.ok(err.details.notes);
    return true;
  });
});

test("validateBody rejects a field longer than 255 characters", () => {
  assert.throws(() => validateBody(SIMPLE_TABLE, { name: "x".repeat(256) }), (err) => {
    assert.ok(err.details.name);
    return true;
  });
});

test("validateBody accepts a field exactly at the 255-character limit", () => {
  assert.doesNotThrow(() => validateBody(SIMPLE_TABLE, { name: "x".repeat(255) }));
});

test("validateActor accepts a normal actor name", () => {
  assert.doesNotThrow(() => validateActor("Arshad Gani"));
});

test("validateActor rejects an actor name longer than 255 characters", () => {
  assert.throws(() => validateActor("x".repeat(256)), (err) => {
    assert.equal(err.status, 422);
    assert.ok(err.details.updatedBy);
    return true;
  });
});
