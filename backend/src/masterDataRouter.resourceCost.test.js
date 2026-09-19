import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { pool } from "./db.js";
import { createMasterDataRouter } from "./masterDataRouter.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";

// Integration tests for FEAT-5 (Resource Cost real schema): exercises the
// actual resource_cost table descriptor (from masterDataTables.js, not a
// re-typed copy) through the real Express request/response cycle —
// routing, express.json() body parsing, requireInternalApiKey, and the
// shared error middleware — so validateReferences/lookup-JOIN/sortColumn
// wiring is proven end-to-end at the HTTP layer, not just as isolated
// function calls (see masterDataSchema.test.js for those).
//
// Deviation from the ideal (documented per CLAUDE.md's "no laziness" —
// this is a real constraint, not a shortcut): the Test Architect's plan
// called for these to run against a real Postgres connection. No
// DATABASE_URL / live Postgres is reachable from this pipeline stage's
// sandbox (no test DB is provisioned for this repo yet, and every
// existing backend test in this repo is DB-mocked, not DB-live — there is
// no precedent to follow here either). pool.query is mocked per-test
// instead, keyed on the exact SQL each route is known to issue (verified
// by direct Read of masterDataRouter.js above) — this still proves the
// route wiring, request validation, status codes, and response-shape
// mapping are correct; it does not prove the raw SQL itself executes
// correctly against a real Postgres server. That residual gap should be
// closed by the Tester stage (7) if a test database becomes available,
// or otherwise accepted as a known limitation of this pipeline run.

const resourceCostTable = MASTER_DATA_TABLES.find((t) => t.route === "resource-cost");
const RESOURCE_COST_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

let server;
let baseUrl;

before(async () => {
  process.env.INTERNAL_API_KEY = "test-secret";
  const app = express();
  app.use(express.json());
  app.use(`/v1/${resourceCostTable.route}`, createMasterDataRouter(resourceCostTable));
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
    id: RESOURCE_COST_ID,
    employee_id: 42,
    offshore_cost: null,
    onsite_cost: null,
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

test("POST /v1/resource-cost rejects a non-existent employeeId with a 422, not a raw 500, and never inserts", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [] };
    if (sql.startsWith("insert into resource_cost")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 999999 }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.employeeId);
  assert.equal(insertCalled, false);
});

test("POST /v1/resource-cost with a valid employeeId inserts and resolves lookup fields as null from the bare `returning *` row", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.startsWith("insert into resource_cost")) {
      return { rows: [baseRow({ offshore_cost: 1000 })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, offshoreCost: 1000 }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.employeeId, 42);
  assert.equal(body.data.offshoreCost, 1000);
  // insert's `returning *` never carries the joined lookup columns —
  // toResponse must treat that the same as "no match found" (null), never
  // a stale/leaked `undefined`.
  assert.equal(body.data.employeeName, null);
  assert.equal(body.data.employeeDesignation, null);
});

test("GET /v1/resource-cost/:id resolves employeeName/employeeDesignation via the live lookup join", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where resource_cost.id = $1")) {
      return {
        rows: [baseRow({ lookup_0_name: "Jane Doe", lookup_0_designation: "Senior Consultant" })],
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.employeeName, "Jane Doe");
  assert.equal(body.data.employeeDesignation, "Senior Consultant");
});

test("GET /v1/resource-cost/:id yields employeeName/employeeDesignation === null when the linked resource is soft-deleted", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where resource_cost.id = $1")) {
      // The router's LEFT JOIN excludes a soft-deleted resources row (its
      // "and lookup_0.deleted_at is null" predicate), so the joined
      // columns come back null rather than the resource's old data.
      return { rows: [baseRow({ lookup_0_name: null, lookup_0_designation: null })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`);
  const body = await res.json();
  assert.equal(body.data.employeeName, null);
  assert.equal(body.data.employeeDesignation, null);
});

test("GET /v1/resource-cost (list) orders by employee_id, not the dropped name column — locks in the sortColumn regression fix", async (t) => {
  let listSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("from resource_cost") && sql.includes("order by")) {
      listSql = sql;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost`);
  assert.equal(res.status, 200);
  assert.match(listSql, /order by \(resource_cost\.deleted_at is not null\), resource_cost\.employee_id asc/);
  assert.doesNotMatch(listSql, /resource_cost\.name asc/);
});

test("PATCH /v1/resource-cost/:id can set offshoreCost without touching onsiteCost (independently optional)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from resource_cost where id")) {
      return { rows: [baseRow({ onsite_cost: 800 })] };
    }
    if (sql.startsWith("update resource_cost set")) {
      return { rows: [baseRow({ offshore_cost: 1200, onsite_cost: 800 })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ offshoreCost: 1200 }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.offshoreCost, 1200);
  assert.equal(body.data.onsiteCost, 800);
});

test("PATCH /v1/resource-cost/:id rejects setting employeeId to a non-existent Resources row (422, no update executed)", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [] };
    if (sql.startsWith("update resource_cost set")) {
      updateCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query (existing-row lookup/update must not run once validateReferences rejects): ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 999999 }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.employeeId);
  assert.equal(updateCalled, false);
});

test("POST /v1/resource-cost maps a foreign_key_violation (23503) from the INSERT itself to a 422, not a raw 500", async (t) => {
  // Simulates the narrow race validateReferences can't close: the FK check
  // passes, then the referenced resources row is removed before the INSERT
  // runs, so Postgres itself rejects it via fk_resource_cost_resources.
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.startsWith("insert into resource_cost")) {
      const err = new Error("insert or update on table violates foreign key constraint");
      err.code = "23503";
      err.constraint = "fk_resource_cost_resources";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42 }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.employeeId);
});

test("POST /v1/resource-cost without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ employeeId: 42 }),
  });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("PATCH /v1/resource-cost/:id without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offshoreCost: 1000 }),
  });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("DELETE /v1/resource-cost/:id without the internal API key is rejected with 401 before any query runs", async (t) => {
  let queryCalled = false;
  t.mock.method(pool, "query", async () => {
    queryCalled = true;
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`, { method: "DELETE" });

  assert.equal(res.status, 401);
  assert.equal(queryCalled, false);
});

test("DELETE /v1/resource-cost/:id soft-deletes the row and returns 204", async (t) => {
  let updateSql;
  t.mock.method(pool, "query", async (sql) => {
    updateSql = sql;
    return { rows: [{ id: RESOURCE_COST_ID }] };
  });

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 204);
  assert.match(updateSql, /update resource_cost set deleted_at = now\(\)/);
  assert.match(updateSql, /where id = \$1 and deleted_at is null/);
});

test("DELETE /v1/resource-cost/:id on an already-deleted (or nonexistent) row returns 404", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  const res = await fetch(`${baseUrl}/v1/resource-cost/${RESOURCE_COST_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "resource_cost_not_found");
});
