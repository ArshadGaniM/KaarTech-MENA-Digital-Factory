import { test } from "node:test";
import assert from "node:assert/strict";
import { notFound, validationError, ApiError, isExclusionViolation, positionOverlapRaceError } from "./errors.js";

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

test("isExclusionViolation recognises only Postgres 23P01", () => {
  assert.equal(isExclusionViolation({ code: "23P01" }), true);
  assert.equal(isExclusionViolation({ code: "23505" }), false);
  assert.equal(isExclusionViolation(null), false);
});

test("positionOverlapRaceError is a 422 on the unique key that names the group and the thing held, with no database detail", () => {
  const position = positionOverlapRaceError({ uniqueKey: "positionId", groupKey: "employeeId" });
  assert.equal(position.status, 422);
  assert.deepEqual(Object.keys(position.details), ["positionId"]);
  assert.match(position.details.positionId, /employeeId already holds this position on some of these dates/);
  const project = positionOverlapRaceError({ uniqueKey: "projectId", groupKey: "teamId", uniqueNoun: "project" });
  assert.match(project.details.projectId, /teamId already holds this project on some of these dates/);
});
