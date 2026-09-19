import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { pool } from "./db.js";
import { createMasterDataRouter } from "./masterDataRouter.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";

// Integration tests for FEAT-8 (Teams real schema): exercises the actual
// teams table descriptor (from masterDataTables.js, not a re-typed copy)
// through the real Express request/response cycle, mirroring
// masterDataRouter.resourceCost.test.js's structure and its documented
// pool.query-mocked-per-SQL-shape approach (see that file's header comment
// for why: no live test Postgres is reachable from this pipeline sandbox).
//
// Unlike resource_cost, teams keeps its `name` column (never dropped), so
// sortColumn falls back to the router's default "name" — there is no
// sortColumn override to lock in here, only that the default still applies.

const teamsTable = MASTER_DATA_TABLES.find((t) => t.route === "teams");
const TEAM_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let server;
let baseUrl;

before(async () => {
  process.env.INTERNAL_API_KEY = "test-secret";
  const app = express();
  app.use(express.json());
  app.use(`/v1/${teamsTable.route}`, createMasterDataRouter(teamsTable));
  // Mirrors index.js's error middleware exactly (never expose stack traces
  // per api.md; 4xx errors pass their real code/message/details through).
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    const code = err.code || "internal_error";
    const message = status === 500 ? "An unexpected error occurred." : err.message;
    res.status(status).json({ error: { code, message, details: err.details || {} } });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

function baseRow(overrides = {}) {
  return {
    id: TEAM_ID,
    name: "Platform Team",
    code: "TEAM-001",
    department_code: "DEPT-001",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

test("POST /v1/teams rejects a non-existent departmentCode with a 422, not a raw 500, and never inserts", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from departments where code")) return { rows: [] };
    if (sql.startsWith("insert into teams")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Platform Team", departmentCode: "DEPT-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.departmentCode);
  assert.equal(insertCalled, false);
});

test("POST /v1/teams with a valid departmentCode inserts and resolves departmentName as null from the bare `returning *` row", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("insert into teams")) {
      return { rows: [baseRow({ code: null })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Platform Team", departmentCode: "DEPT-001" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.name, "Platform Team");
  assert.equal(body.data.departmentCode, "DEPT-001");
  // insert's `returning *` never carries the joined lookup column —
  // toResponse must treat that the same as "no match found" (null), never
  // a stale/leaked `undefined`.
  assert.equal(body.data.departmentName, null);
});

test("POST /v1/teams rejects an attempt to client-supply `code` — the trigger owns it, not the request body", async (t) => {
  let insertColumns;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("insert into teams")) {
      insertColumns = sql;
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Platform Team", departmentCode: "DEPT-001", code: "TEAM-999" }),
  });

  assert.equal(res.status, 201);
  // The insert's column list only ever comes from table.fields (name,
  // department_code) plus created_by/updated_by — a client-supplied `code`
  // in the body has nowhere to be written, so it's silently ignored rather
  // than erroring, and the DB trigger is what actually sets it.
  assert.doesNotMatch(insertColumns, /\bcode\b(?!_)/);
});

test("GET /v1/teams/:id resolves departmentName via the live lookup join", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where teams.id = $1")) {
      return { rows: [baseRow({ lookup_0_name: "Engineering" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.departmentName, "Engineering");
  assert.equal(body.data.code, "TEAM-001");
});

test("GET /v1/teams/:id yields departmentName === null when the linked department is soft-deleted", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where teams.id = $1")) {
      // The router's LEFT JOIN excludes a soft-deleted departments row (its
      // "and lookup_0.deleted_at is null" predicate), so the joined column
      // comes back null rather than the department's old name.
      return { rows: [baseRow({ lookup_0_name: null })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`);
  const body = await res.json();
  assert.equal(body.data.departmentName, null);
});

test("GET /v1/teams (list) orders by the default name column, unaffected by resource_cost's sortColumn override", async (t) => {
  let listSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("from teams") && sql.includes("order by")) {
      listSql = sql;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams`);
  assert.equal(res.status, 200);
  assert.match(listSql, /order by \(teams\.deleted_at is not null\), teams\.name asc/);
});

test("PATCH /v1/teams/:id can rename the team without touching departmentCode (name stays user-editable anytime)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from teams where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update teams set")) {
      return { rows: [baseRow({ name: "Platform & Infra Team" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Platform & Infra Team" }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.name, "Platform & Infra Team");
  assert.equal(body.data.departmentCode, "DEPT-001");
});

test("PATCH /v1/teams/:id rejects moving a team to a non-existent departmentCode (422, no update executed)", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from teams where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.includes("select 1 from departments where code")) return { rows: [] };
    if (sql.startsWith("update teams set")) {
      updateCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query (existing-row lookup/update must not run once validateReferences rejects): ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ departmentCode: "DEPT-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.departmentCode);
  assert.equal(updateCalled, false);
});

test("POST /v1/teams maps a foreign_key_violation (23503) from the INSERT itself to a 422, not a raw 500", async (t) => {
  // Simulates the narrow race validateReferences can't close: the FK check
  // passes, then the referenced departments row is removed before the
  // INSERT runs, so Postgres itself rejects it via fk_teams_departments.
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from departments where code")) return { rows: [{}] };
    if (sql.startsWith("insert into teams")) {
      const err = new Error("insert or update on table violates foreign key constraint");
      err.code = "23503";
      err.constraint = "fk_teams_departments";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Platform Team", departmentCode: "DEPT-001" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.departmentCode);
});

test("POST /v1/teams without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Platform Team", departmentCode: "DEPT-001" }),
  });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("PATCH /v1/teams/:id without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Renamed" }),
  });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("DELETE /v1/teams/:id without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`, { method: "DELETE" });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("DELETE /v1/teams/:id soft-deletes the row and returns 204", async (t) => {
  let updateSql;
  t.mock.method(pool, "query", async (sql) => {
    updateSql = sql;
    return { rows: [{ id: TEAM_ID }] };
  });

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 204);
  assert.match(updateSql, /update teams set deleted_at = now\(\)/);
  assert.match(updateSql, /where id = \$1 and deleted_at is null/);
});

test("DELETE /v1/teams/:id on an already-deleted (or nonexistent) row returns 404", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  const res = await fetch(`${baseUrl}/v1/teams/${TEAM_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "team_not_found");
});
