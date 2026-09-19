import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { pool } from "./db.js";
import { createMasterDataRouter } from "./masterDataRouter.js";

// Shared harness for a master-data table's HTTP-layer integration tests
// (see masterDataRouter.resourceCost.test.js and masterDataRouter.teams.test.js
// for the first two callers). Extracted once a second near-identical test
// file made the duplication real rather than premature (CLAUDE.md §1) —
// FEAT-9/FEAT-7 are queued to add a third and fourth table on this same
// enforced-FK/lookup pattern, so this pays for itself immediately.
//
// Deviation from the ideal, carried over from the first two callers: no
// DATABASE_URL/live Postgres is reachable from this pipeline's sandbox, so
// pool.query is mocked per-test rather than run against a real connection.
// This still proves route wiring, request validation, status codes, and
// response-shape mapping; it does not prove the raw SQL executes correctly
// against a real Postgres server.

export async function startTestServer(table) {
  process.env.INTERNAL_API_KEY = "test-secret";
  const app = express();
  app.use(express.json());
  app.use(`/v1/${table.route}`, createMasterDataRouter(table));
  // Mirrors index.js's error middleware exactly (never expose stack traces
  // per api.md; 4xx errors pass their real code/message/details through).
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    const code = err.code || "internal_error";
    const message = status === 500 ? "An unexpected error occurred." : err.message;
    res.status(status).json({ error: { code, message, details: err.details || {} } });
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

export async function stopTestServer(server) {
  await new Promise((resolve) => server.close(resolve));
}

// Registers the three "no internal API key" 401 tests every write-capable
// master-data route needs (POST/PATCH/DELETE) — FEAT-5's gate found these
// missing for PATCH/DELETE, so every table using this harness gets all
// three for free rather than relying on each new test file remembering to
// add them.
export function registerAuthGateTests({ getBaseUrl, route, getId, postBody, patchBody }) {
  test(`POST /v1/${route} without the internal API key is rejected with 401 before any query runs`, async (t) => {
    let queryCalled = false;
    t.mock.method(pool, "query", async () => {
      queryCalled = true;
      return { rows: [] };
    });

    const res = await fetch(`${getBaseUrl()}/v1/${route}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postBody),
    });

    assert.equal(res.status, 401);
    assert.equal(queryCalled, false);
  });

  test(`PATCH /v1/${route}/:id without the internal API key is rejected with 401 before any query runs`, async (t) => {
    let queryCalled = false;
    t.mock.method(pool, "query", async () => {
      queryCalled = true;
      return { rows: [] };
    });

    const res = await fetch(`${getBaseUrl()}/v1/${route}/${getId()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchBody),
    });

    assert.equal(res.status, 401);
    assert.equal(queryCalled, false);
  });

  test(`DELETE /v1/${route}/:id without the internal API key is rejected with 401 before any query runs`, async (t) => {
    let queryCalled = false;
    t.mock.method(pool, "query", async () => {
      queryCalled = true;
      return { rows: [] };
    });

    const res = await fetch(`${getBaseUrl()}/v1/${route}/${getId()}`, { method: "DELETE" });

    assert.equal(res.status, 401);
    assert.equal(queryCalled, false);
  });
}

// Registers the DELETE (soft-delete) success/404 tests every master-data
// route shares verbatim — same reasoning as registerAuthGateTests above.
export function registerDeleteTests({ getBaseUrl, route, getId, tableName, resourceName }) {
  test(`DELETE /v1/${route}/:id soft-deletes the row and returns 204`, async (t) => {
    let updateSql;
    t.mock.method(pool, "query", async (sql) => {
      updateSql = sql;
      return { rows: [{ id: getId() }] };
    });

    const res = await fetch(`${getBaseUrl()}/v1/${route}/${getId()}`, {
      method: "DELETE",
      headers: { "x-internal-api-key": "test-secret" },
    });

    assert.equal(res.status, 204);
    assert.match(updateSql, new RegExp(`update ${tableName} set deleted_at = now\\(\\)`));
    assert.match(updateSql, /where id = \$1 and deleted_at is null/);
  });

  test(`DELETE /v1/${route}/:id on an already-deleted (or nonexistent) row returns 404`, async (t) => {
    t.mock.method(pool, "query", async () => ({ rows: [] }));

    const res = await fetch(`${getBaseUrl()}/v1/${route}/${getId()}`, {
      method: "DELETE",
      headers: { "x-internal-api-key": "test-secret" },
    });

    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.error.code, `${resourceName}_not_found`);
  });
}
