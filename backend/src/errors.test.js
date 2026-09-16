import { test } from "node:test";
import assert from "node:assert/strict";
import { notFound, validationError, ApiError } from "./errors.js";

test("notFound builds a 404 ApiError with a machine-readable code", () => {
  const err = notFound("team_member", "abc-123");
  assert.ok(err instanceof ApiError);
  assert.equal(err.status, 404);
  assert.equal(err.code, "team_member_not_found");
  assert.match(err.message, /abc-123/);
});

test("validationError builds a 422 ApiError carrying field details", () => {
  const err = validationError({ email: "invalid" });
  assert.equal(err.status, 422);
  assert.equal(err.code, "validation_error");
  assert.deepEqual(err.details, { email: "invalid" });
});
