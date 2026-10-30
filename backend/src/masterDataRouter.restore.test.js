import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer } from "./masterDataRouter.testHelpers.js";

// FEAT-19: POST /v1/<table>/:id/restore (undo of DELETE). Exercised on
// teams (has an enforced FK to departments — the interesting case, since a
// restored child must not point at a still-deleted parent) and departments
// (no FK — proves no reference query is issued when there is nothing to
// check). pool.query is mocked per-test, same as every other HTTP-layer
// test in this directory (see masterDataRouter.testHelpers.js).

const teamsTable = MASTER_DATA_TABLES.find((t) => t.route === "teams");
const departmentsTable = MASTER_DATA_TABLES.find((t) => t.route === "departments");
const TEAM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let teamsServer;
let teamsBaseUrl;
let departmentsServer;
let departmentsBaseUrl;

before(async () => {
  ({ server: teamsServer, baseUrl: teamsBaseUrl } = await startTestServer(teamsTable));
  ({ server: departmentsServer, baseUrl: departmentsBaseUrl } = await startTestServer(departmentsTable));
});

after(async () => {
  await stopTestServer(teamsServer);
  await stopTestServer(departmentsServer);
});

function teamRow(overrides = {}) {
  return {
    id: TEAM_ID,
    name: "Platform Team",
    code: "TEAM-001",
    department_code: "DEPT-001",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: "2026-02-01T00:00:00Z",
    ...overrides,
  };
}

function restore(baseUrl, route, { headers = { "x-internal-api-key": "test-secret" }, body } = {}) {
  return fetch(`${baseUrl}/v1/${route}/${TEAM_ID}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test("POST /v1/teams/:id/restore without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await restore(teamsBaseUrl, "teams", { headers: {} });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("POST /v1/teams/:id/restore clears deleted_at and returns the row as markedDeleted: No", async (t) => {
  let updateSql;
  let updateParams;
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.includes("deleted_at is not null") && sql.startsWith("select")) return { rows: [teamRow()] };
    if (sql.includes("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("update teams")) {
      updateSql = sql;
      updateParams = params;
      return { rows: [teamRow({ deleted_at: null })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.id, TEAM_ID);
  assert.equal(body.data.markedDeleted, "No");
  assert.match(updateSql, /set deleted_at = null, updated_by = \$1/);
  assert.match(updateSql, /where id = \$2 and deleted_at is not null/);
  assert.deepEqual(updateParams, ["Arshad Gani", TEAM_ID]);
});

test("POST /v1/teams/:id/restore records the caller-supplied updatedBy", async (t) => {
  let updateParams;
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select") && sql.includes("deleted_at is not null")) return { rows: [teamRow()] };
    if (sql.includes("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("update teams")) {
      updateParams = params;
      return { rows: [teamRow({ deleted_at: null, updated_by: "Aisha Al Marri" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(teamsBaseUrl, "teams", { body: { updatedBy: "  Aisha Al Marri  " } });

  assert.equal(res.status, 200);
  assert.equal(updateParams[0], "Aisha Al Marri");
});

test("POST /v1/teams/:id/restore on a row that is not deleted (or doesn't exist) returns 404 and never updates", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("update")) updateCalled = true;
    return { rows: [] };
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "team_not_found");
  assert.equal(updateCalled, false);
});

test("POST /v1/teams/:id/restore is refused with a 422 while the referenced department is itself still deleted", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select") && sql.includes("deleted_at is not null") && sql.includes("from teams")) {
      return { rows: [teamRow()] };
    }
    // validateReferences only counts a *live* referenced row
    if (sql.includes("select 1 from departments where code")) return { rows: [] };
    if (sql.startsWith("update")) updateCalled = true;
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.departmentCode);
  assert.equal(updateCalled, false);
});

test("POST /v1/teams/:id/restore returns 404 if the row was restored by someone else between the check and the update", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select") && sql.includes("deleted_at is not null")) return { rows: [teamRow()] };
    if (sql.includes("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("update teams")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 404);
});

test("POST /v1/departments/:id/restore (no FK) restores without issuing any reference check", async (t) => {
  let referenceChecked = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select 1")) referenceChecked = true;
    if (sql.startsWith("select") && sql.includes("deleted_at is not null")) {
      return { rows: [{ id: TEAM_ID, name: "Design Services", code: "DEPT-002", deleted_at: "2026-02-01T00:00:00Z" }] };
    }
    if (sql.startsWith("update departments")) {
      return { rows: [{ id: TEAM_ID, name: "Design Services", code: "DEPT-002", deleted_at: null }] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(departmentsBaseUrl, "departments");

  assert.equal(res.status, 200);
  assert.equal(referenceChecked, false);
});
