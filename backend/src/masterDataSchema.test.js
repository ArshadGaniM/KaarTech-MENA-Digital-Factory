import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  toResponse,
  validateBody,
  validateActor,
  validateReferences,
  lookupJoinSql,
  lookupSelectSql,
} from "./masterDataSchema.js";
import { isUniqueViolation, duplicateFieldError } from "./errors.js";
import { pool } from "./db.js";

const SIMPLE_TABLE = {
  fields: [{ key: "name", column: "name", required: true, type: "string" }],
};

const TABLE_WITH_OPTIONAL_FIELD = {
  fields: [
    { key: "name", column: "name", required: true, type: "string" },
    { key: "notes", column: "notes", required: false, type: "string" },
  ],
};

const RESOURCE_LIKE_TABLE = {
  fields: [
    { key: "employeeId", column: "employee_id", required: true, type: "number" },
    { key: "sapExperience", column: "sap_experience", required: false, type: "number" },
    { key: "skill", column: "skill", required: false, type: "string", maxLength: 20000 },
  ],
};

// Mirrors resource_cost's real descriptor in masterDataTables.js (FEAT-5):
// employeeId is a validated FK reference (unlike modules.practiceId), and
// employeeName/employeeDesignation are live-lookup fields, never stored
// columns — see lookupJoinSql/lookupSelectSql/toResponse below.
const RESOURCE_COST_TABLE = {
  tableName: "resource_cost",
  sortColumn: "employee_id",
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
      references: { table: "resources", column: "employee_id" },
    },
    { key: "offshoreCost", column: "offshore_cost", required: false, type: "number" },
    { key: "onsiteCost", column: "onsite_cost", required: false, type: "number" },
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

test("validateBody accepts an explicit null for a non-required field (clearing it)", () => {
  assert.doesNotThrow(() =>
    validateBody(TABLE_WITH_OPTIONAL_FIELD, { name: "SAP", notes: null }, { partial: true })
  );
});

test("validateBody rejects an explicit null for a required field", () => {
  assert.throws(() => validateBody(SIMPLE_TABLE, { name: null }), (err) => {
    assert.ok(err.details.name);
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

test("validateBody accepts a valid number field", () => {
  assert.doesNotThrow(() => validateBody(RESOURCE_LIKE_TABLE, { employeeId: 42 }, { partial: true }));
});

test("validateBody rejects a non-number value for a number field", () => {
  assert.throws(() => validateBody(RESOURCE_LIKE_TABLE, { employeeId: "42" }), (err) => {
    assert.ok(err.details.employeeId);
    return true;
  });
});

test("validateBody rejects NaN/Infinity for a number field", () => {
  assert.throws(() => validateBody(RESOURCE_LIKE_TABLE, { employeeId: Infinity }), (err) => {
    assert.ok(err.details.employeeId);
    return true;
  });
});

test("validateBody skips length/enum checks for a number field", () => {
  // A number field should never hit the string-length branch, even at 0.
  assert.doesNotThrow(() => validateBody(RESOURCE_LIKE_TABLE, { employeeId: 0 }, { partial: true }));
});

test("validateBody accepts an explicit null for a non-required number field (clearing it)", () => {
  assert.doesNotThrow(() =>
    validateBody(RESOURCE_LIKE_TABLE, { sapExperience: null }, { partial: true })
  );
});

test("validateBody honors a field's maxLength override", () => {
  assert.doesNotThrow(() =>
    validateBody(RESOURCE_LIKE_TABLE, { skill: "x".repeat(20000) }, { partial: true })
  );
  assert.throws(
    () => validateBody(RESOURCE_LIKE_TABLE, { skill: "x".repeat(20001) }, { partial: true }),
    (err) => {
      assert.ok(err.details.skill);
      return true;
    }
  );
});

test("duplicateFieldError names the field whose unique constraint was violated", () => {
  const err = duplicateFieldError(
    { constraint: "resources_employee_id_unique" },
    [{ key: "employeeId", column: "employee_id" }]
  );
  assert.equal(err.status, 422);
  assert.ok(err.details.employeeId);
});

test("isUniqueViolation matches Postgres error code 23505 only", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "23502" }), false);
  assert.equal(isUniqueViolation({}), false);
});
