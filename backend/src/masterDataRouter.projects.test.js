import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import {
  startTestServer,
  stopTestServer,
  registerAuthGateTests,
  registerDeleteTests,
} from "./masterDataRouter.testHelpers.js";

// Integration tests for FEAT-10 (Projects, a brand-new table): unlike every
// table added since FEAT-5, this one has NO `references`/`lookups` fields —
// all three business fields (projectId, projectName, projectProfitCenterCode)
// are manually entered, none FK-validated. Its closest precedent is
// resources.employeeId (migration 0012): a caller-supplied identifier
// enforced unique at the DB level via a unique_violation (23505), not a
// foreign_key_violation (23503) — the first dedicated test file to exercise
// duplicateFieldError()/isUniqueViolation() end to end.

const projectsTable = MASTER_DATA_TABLES.find((t) => t.route === "projects");
const PROJECT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(projectsTable));
});

after(async () => {
  await stopTestServer(server);
});

function baseRow(overrides = {}) {
  return {
    id: PROJECT_ID,
    project_id: "PRJ-1001",
    project_name: "Digital Factory Rollout",
    project_profit_center_code: "PC-500",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

test("POST /v1/projects with all three required fields inserts and returns 201", async (t) => {
  let insertColumns;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("insert into projects")) {
      insertColumns = sql;
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({
      projectId: "PRJ-1001",
      projectName: "Digital Factory Rollout",
      projectProfitCenterCode: "PC-500",
    }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.projectId, "PRJ-1001");
  assert.equal(body.data.projectName, "Digital Factory Rollout");
  assert.equal(body.data.projectProfitCenterCode, "PC-500");
  // No `references`/`lookups` on this table — the insert's column list is
  // just the three business columns plus created_by/updated_by, no FK
  // pre-check query runs before it (unlike every FK'd table's tests).
  assert.match(insertColumns, /project_id, project_name, project_profit_center_code/);
});

test("POST /v1/projects missing a required field is rejected with 422 and never inserts", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("insert into projects")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ projectId: "PRJ-1001", projectName: "Digital Factory Rollout" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.projectProfitCenterCode);
  assert.equal(insertCalled, false);
});

test("POST /v1/projects maps a unique_violation (23505) on a duplicate projectId to a 422 naming the field, not a raw 500", async (t) => {
  // projectId is caller-supplied and DB-enforced-unique (projects_project_id_unique,
  // migration 0017) — same mechanism as resources.employee_id (migration 0012),
  // the first precedent for isUniqueViolation()/duplicateFieldError() but
  // without a dedicated test file of its own.
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("insert into projects")) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      err.constraint = "projects_project_id_unique";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({
      projectId: "PRJ-1001",
      projectName: "Digital Factory Rollout",
      projectProfitCenterCode: "PC-500",
    }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.projectId);
});

test("GET /v1/projects/:id returns the project with no lookup columns attached (this table has none)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where projects.id = $1")) {
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects/${PROJECT_ID}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.projectId, "PRJ-1001");
  assert.equal(body.data.projectProfitCenterCode, "PC-500");
});

test("GET /v1/projects (list) orders by project_id, not the default `name` column this table doesn't have", async (t) => {
  let listSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("from projects") && sql.includes("order by")) {
      listSql = sql;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects`);
  assert.equal(res.status, 200);
  assert.match(
    listSql,
    /order by \(projects\.deleted_at is not null\), projects\.project_id asc/
  );
  assert.doesNotMatch(listSql, /projects\.name asc/);
});

test("PATCH /v1/projects/:id can update projectName without touching projectId or projectProfitCenterCode", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from projects where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update projects set")) {
      return { rows: [baseRow({ project_name: "Digital Factory Rollout — Phase 2" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ projectName: "Digital Factory Rollout — Phase 2" }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.projectName, "Digital Factory Rollout — Phase 2");
  assert.equal(body.data.projectId, "PRJ-1001");
  assert.equal(body.data.projectProfitCenterCode, "PC-500");
});

test("PATCH /v1/projects/:id maps a unique_violation (23505) on projectId to a 422 naming the field, not a raw 500", async (t) => {
  // Unlike teams/positions (whose FK-checked fields are never part of a
  // unique constraint), projectId is a full `table.fields` entry included
  // in PATCH's SET clause — so the same UPDATE that renames a project can
  // just as easily collide with another row's projectId as the INSERT can.
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from projects where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update projects set")) {
      const err = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      err.constraint = "projects_project_id_unique";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/projects/${PROJECT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ projectId: "PRJ-1001" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.projectId);
});

registerAuthGateTests({
  getBaseUrl: () => baseUrl,
  route: "projects",
  getId: () => PROJECT_ID,
  postBody: {
    projectId: "PRJ-1001",
    projectName: "Digital Factory Rollout",
    projectProfitCenterCode: "PC-500",
  },
  patchBody: { projectName: "Renamed" },
});

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "projects",
  getId: () => PROJECT_ID,
  tableName: "projects",
  resourceName: "project",
});
