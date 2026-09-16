import { test } from "node:test";
import assert from "node:assert/strict";
import { toResponse, validateBody } from "./teamMemberSchema.js";

test("toResponse maps snake_case db columns to camelCase fields", () => {
  const row = {
    id: "1",
    full_name: "Jane Doe",
    role: "Engineer",
    department: "Delivery",
    email: "jane@example.com",
    avatar_url: null,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  };
  assert.deepEqual(toResponse(row), {
    id: "1",
    fullName: "Jane Doe",
    role: "Engineer",
    department: "Delivery",
    email: "jane@example.com",
    avatarUrl: null,
    status: "active",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
  });
});

test("validateBody accepts a minimal valid create payload", () => {
  assert.doesNotThrow(() => validateBody({ fullName: "Jane Doe" }));
});

test("validateBody rejects a missing fullName on create", () => {
  assert.throws(() => validateBody({ email: "jane@example.com" }), (err) => {
    assert.equal(err.status, 422);
    assert.equal(err.code, "validation_error");
    assert.ok(err.details.fullName);
    return true;
  });
});

test("validateBody rejects a blank fullName", () => {
  assert.throws(() => validateBody({ fullName: "   " }));
});

test("validateBody rejects a malformed email", () => {
  assert.throws(() => validateBody({ fullName: "Jane Doe", email: "not-an-email" }), (err) => {
    assert.ok(err.details.email);
    return true;
  });
});

test("validateBody rejects an invalid status value", () => {
  assert.throws(() => validateBody({ fullName: "Jane Doe", status: "retired" }), (err) => {
    assert.ok(err.details.status);
    return true;
  });
});

test("validateBody partial mode does not require fullName when omitted", () => {
  assert.doesNotThrow(() => validateBody({ department: "Delivery" }, { partial: true }));
});

test("validateBody partial mode still validates fullName when present", () => {
  assert.throws(() => validateBody({ fullName: "" }, { partial: true }));
});

test("validateBody allows a null email (clearing the field)", () => {
  assert.doesNotThrow(() => validateBody({ fullName: "Jane Doe", email: null }));
});
