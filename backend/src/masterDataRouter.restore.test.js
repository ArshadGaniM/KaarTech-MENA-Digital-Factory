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
    if (sql.startsWith("select * from teams where id")) return { rows: [teamRow()] };
    if (sql.startsWith("select 1 from departments where code")) return { rows: [{}] };
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
  // the same live-parent check is repeated inside the UPDATE itself
  assert.match(updateSql, /exists \(select 1 from departments where code = teams\.department_code and deleted_at is null\)/);
  assert.deepEqual(updateParams, ["Arshad Gani", TEAM_ID]);
});

test("POST /v1/teams/:id/restore records the caller-supplied updatedBy", async (t) => {
  let updateParams;
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select * from teams where id")) return { rows: [teamRow()] };
    if (sql.startsWith("select 1 from departments where code")) return { rows: [{}] };
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
    if (sql.startsWith("select * from teams where id")) return { rows: [teamRow()] };
    // validateReferences only counts a *live* referenced row
    if (sql.startsWith("select 1 from departments where code")) return { rows: [] };
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

test("POST /v1/teams/:id/restore on a row that exists but is not deleted returns 409 and never updates", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("update")) updateCalled = true;
    return { rows: [teamRow({ deleted_at: null })] };
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 409);
  assert.equal((await res.json()).error.code, "team_not_deleted");
  assert.equal(updateCalled, false);
});

test("POST /v1/teams/:id/restore returns 409 if someone else restored the row between the check and the update", async (t) => {
  let selects = 0;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from teams where id")) {
      selects += 1;
      return { rows: [teamRow({ deleted_at: selects === 1 ? "2026-02-01T00:00:00Z" : null })] };
    }
    if (sql.startsWith("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("update teams")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 409);
});

test("POST /v1/teams/:id/restore returns 422 if the parent department is deleted between the check and the update", async (t) => {
  let referenceChecks = 0;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from teams where id")) return { rows: [teamRow()] };
    if (sql.startsWith("select 1 from departments where code")) {
      referenceChecks += 1;
      return { rows: referenceChecks === 1 ? [{}] : [] };
    }
    if (sql.startsWith("update teams")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await restore(teamsBaseUrl, "teams");

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.departmentCode);
});

test("POST /v1/departments/:id/restore (no FK) restores without issuing any reference check", async (t) => {
  let referenceChecked = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select 1")) referenceChecked = true;
    if (sql.startsWith("select * from departments where id")) {
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

// Gate finding (security-auditor): a non-string updatedBy used to throw on
// `.trim()` and surface as a 500; every write route now answers 422.
test("a non-string updatedBy is a 422 (not a 500) on restore, POST and PATCH, and never writes", async (t) => {
  let wrote = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from teams where id")) return { rows: [teamRow()] };
    if (sql.startsWith("select 1 from departments")) return { rows: [{}] };
    if (sql.startsWith("update") || sql.startsWith("insert")) wrote = true;
    return { rows: [] };
  });
  const headers = { "Content-Type": "application/json", "x-internal-api-key": "test-secret" };

  for (const [method, path, body] of [
    ["POST", `/${TEAM_ID}/restore`, { updatedBy: 123 }],
    ["POST", "", { name: "T", departmentCode: "DEPT-001", updatedBy: { a: 1 } }],
    ["PATCH", `/${TEAM_ID}`, { name: "T", updatedBy: ["x"] }],
  ]) {
    const res = await fetch(`${teamsBaseUrl}/v1/teams${path}`, { method, headers, body: JSON.stringify(body) });
    assert.equal(res.status, 422, `${method} ${path}`);
    const json = await res.json();
    assert.ok(json.error.details.updatedBy);
  }
  assert.equal(wrote, false);
});

test("POST /v1/departments/:id/restore without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await restore(departmentsBaseUrl, "departments", { headers: {} });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("POST /v1/departments/:id/restore with a wrong internal API key is rejected with 401", async (t) => {
  t.mock.method(pool, "query", async () => {
    throw new Error("no query may run");
  });

  const res = await restore(departmentsBaseUrl, "departments", { headers: { "x-internal-api-key": "wrong" } });

  assert.equal(res.status, 401);
});

test("POST /v1/teams/:id/restore with an over-long updatedBy is a 422 and never updates", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("select * from teams")) return { rows: [teamRow()] };
    if (sql.startsWith("update")) updateCalled = true;
    return { rows: [] };
  });

  const res = await restore(teamsBaseUrl, "teams", { body: { updatedBy: "x".repeat(1000) } });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.updatedBy);
  assert.equal(updateCalled, false);
});

test("POST /v1/departments/:id/restore returns the restored row's input/output (FEAT-20)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    const row = {
      id: TEAM_ID,
      code: "DEPT-002",
      name: "Design Services",
      input: "Briefs",
      output: "Mockups",
      deleted_at: sql.startsWith("update") ? null : "2026-02-01T00:00:00Z",
    };
    return { rows: [row] };
  });

  const res = await restore(departmentsBaseUrl, "departments");

  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.input, "Briefs");
  assert.equal(data.output, "Mockups");
  assert.equal(data.markedDeleted, "No");
});
