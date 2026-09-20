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

// Integration tests for FEAT-9 (Positions): exercises the actual
// positions table descriptor (from masterDataTables.js, not a re-typed
// copy) through the real Express request/response cycle. Server
// bootstrap, the 401-without-a-key tests, and the DELETE tests are shared
// via masterDataRouter.testHelpers.js — mirrors masterDataRouter.teams.test.js's
// structure, since Positions reuses the exact same hasCode + references +
// lookups shape teams introduced (teamCode -> teams.code instead of
// departmentCode -> departments.code).

const positionsTable = MASTER_DATA_TABLES.find((t) => t.route === "positions");
const POSITION_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(positionsTable));
});

after(async () => {
  await stopTestServer(server);
});

function baseRow(overrides = {}) {
  return {
    id: POSITION_ID,
    name: "Software Engineer",
    code: "POS-001",
    team_code: "TEAM-001",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

test("POST /v1/positions rejects a non-existent teamCode with a 422, not a raw 500, and never inserts", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from teams where code")) return { rows: [] };
    if (sql.startsWith("insert into positions")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Software Engineer", teamCode: "TEAM-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.teamCode);
  assert.equal(insertCalled, false);
});

test("POST /v1/positions rejects a soft-deleted team's teamCode with a 422 (validateReferences filters deleted_at is null)", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    // validateReferences' query includes "and deleted_at is null", so a
    // soft-deleted team's code never matches — same rows: [] result as a
    // genuinely nonexistent code, proving the filter rather than assuming it.
    if (sql.includes("select 1 from teams where code") && sql.includes("deleted_at is null")) {
      return { rows: [] };
    }
    if (sql.startsWith("insert into positions")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Software Engineer", teamCode: "TEAM-DELETED" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.teamCode);
  assert.equal(insertCalled, false);
});

test("POST /v1/positions with a valid teamCode inserts and resolves teamName as null from the bare `returning *` row", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into positions")) {
      return { rows: [baseRow({ code: null })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Software Engineer", teamCode: "TEAM-001" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.name, "Software Engineer");
  assert.equal(body.data.teamCode, "TEAM-001");
  // insert's `returning *` never carries the joined lookup column —
  // toResponse must treat that the same as "no match found" (null), never
  // a stale/leaked `undefined`.
  assert.equal(body.data.teamName, null);
});

test("POST /v1/positions rejects an attempt to client-supply `code` — the trigger owns it, not the request body", async (t) => {
  let insertColumns;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into positions")) {
      insertColumns = sql;
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Software Engineer", teamCode: "TEAM-001", code: "POS-999" }),
  });

  assert.equal(res.status, 201);
  // The insert's column list only ever comes from table.fields (name,
  // team_code) plus created_by/updated_by — a client-supplied `code` in
  // the body has nowhere to be written, so it's silently ignored rather
  // than erroring, and the DB trigger is what actually sets it.
  assert.doesNotMatch(insertColumns, /\bcode\b(?!_)/);
});

test("GET /v1/positions/:id resolves teamName via the live lookup join", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where positions.id = $1")) {
      return { rows: [baseRow({ lookup_0_name: "Platform Team" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions/${POSITION_ID}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.teamName, "Platform Team");
  assert.equal(body.data.code, "POS-001");
});

test("GET /v1/positions/:id yields teamName === null when the linked team is soft-deleted", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where positions.id = $1")) {
      // The router's LEFT JOIN excludes a soft-deleted teams row (its
      // "and lookup_0.deleted_at is null" predicate), so the joined column
      // comes back null rather than the team's old name.
      return { rows: [baseRow({ lookup_0_name: null })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions/${POSITION_ID}`);
  const body = await res.json();
  assert.equal(body.data.teamName, null);
});

test("GET /v1/positions/:id yields teamName === null when the linked team is missing entirely", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where positions.id = $1")) {
      return { rows: [baseRow()] }; // no lookup_0_name key at all
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions/${POSITION_ID}`);
  const body = await res.json();
  assert.equal(body.data.teamName, null);
});

test("GET /v1/positions (list) orders by the default name column", async (t) => {
  let listSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("from positions") && sql.includes("order by")) {
      listSql = sql;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions`);
  assert.equal(res.status, 200);
  assert.match(listSql, /order by \(positions\.deleted_at is not null\), positions\.name asc/);
});

test("PATCH /v1/positions/:id can rename the position without touching teamCode (name stays user-editable anytime)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from positions where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update positions set")) {
      return { rows: [baseRow({ name: "Senior Software Engineer" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions/${POSITION_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Senior Software Engineer" }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.name, "Senior Software Engineer");
  assert.equal(body.data.teamCode, "TEAM-001");
});

test("PATCH /v1/positions/:id rejects moving a position to a non-existent teamCode (422, no update executed)", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from positions where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.includes("select 1 from teams where code")) return { rows: [] };
    if (sql.startsWith("update positions set")) {
      updateCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query (existing-row lookup/update must not run once validateReferences rejects): ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions/${POSITION_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ teamCode: "TEAM-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.teamCode);
  assert.equal(updateCalled, false);
});

test("POST /v1/positions maps a foreign_key_violation (23503) from the INSERT itself to a 422, not a raw 500", async (t) => {
  // Simulates the narrow race validateReferences can't close: the FK check
  // passes, then the referenced teams row is removed before the INSERT
  // runs, so Postgres itself rejects it via fk_positions_teams.
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into positions")) {
      const err = new Error("insert or update on table violates foreign key constraint");
      err.code = "23503";
      err.constraint = "fk_positions_teams";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/positions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ name: "Software Engineer", teamCode: "TEAM-001" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.teamCode);
});

registerAuthGateTests({
  getBaseUrl: () => baseUrl,
  route: "positions",
  getId: () => POSITION_ID,
  postBody: { name: "Software Engineer", teamCode: "TEAM-001" },
  patchBody: { name: "Renamed" },
});

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "positions",
  getId: () => POSITION_ID,
  tableName: "positions",
  resourceName: "position",
});
