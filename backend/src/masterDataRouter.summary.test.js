import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer } from "./masterDataRouter.testHelpers.js";

// GET /v1/<table>/summary feeds the Dashboard charts: grouped counts of
// live rows, optionally narrowed by equality filters on other groupable
// fields. pool.query is mocked (no database in the sandbox), so these prove
// route wiring, validation and the SQL's shape, not Postgres execution.

const resourcesTable = MASTER_DATA_TABLES.find((t) => t.route === "resources");

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(resourcesTable));
});

after(async () => {
  await stopTestServer(server);
});

test("GET /v1/resources/summary groups live rows and returns their total", async (t) => {
  let sql;
  let params;
  t.mock.method(pool, "query", async (text, values) => {
    sql = text;
    params = values;
    return { rows: [{ value: "Offshore", count: 7 }, { value: "Onsite", count: 3 }, { value: null, count: 1 }] };
  });

  const res = await fetch(`${baseUrl}/v1/resources/summary?groupBy=locationType`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body, {
    data: [{ value: "Offshore", count: 7 }, { value: "Onsite", count: 3 }, { value: null, count: 1 }],
    total: 11,
  });
  assert.match(sql, /resources\.deleted_at is null/);
  assert.match(sql, /group by resources\.location_type/);
  assert.deepEqual(params, []);
});

test("GET /v1/resources/summary binds filter values as parameters, never into the SQL text", async (t) => {
  let sql;
  let params;
  t.mock.method(pool, "query", async (text, values) => {
    sql = text;
    params = values;
    return { rows: [] };
  });

  const res = await fetch(
    `${baseUrl}/v1/resources/summary?groupBy=designation&locationType=${encodeURIComponent("Offshore' or '1'='1")}`
  );

  assert.equal(res.status, 200);
  assert.match(sql, /resources\.location_type = \$1/);
  assert.doesNotMatch(sql, /1'='1/);
  assert.deepEqual(params, ["Offshore' or '1'='1"]);
});

test("GET /v1/resources/summary rejects a missing or unknown groupBy with 422 and runs no query", async (t) => {
  let called = false;
  t.mock.method(pool, "query", async () => {
    called = true;
    return { rows: [] };
  });

  for (const query of ["", "?groupBy=nope", "?groupBy=id"]) {
    const res = await fetch(`${baseUrl}/v1/resources/summary${query}`);
    const body = await res.json();
    assert.equal(res.status, 422, query);
    assert.ok(body.error.details.groupBy, query);
  }
  assert.equal(called, false);
});

test("GET /v1/resources/summary refuses long free-text fields such as skill", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  const res = await fetch(`${baseUrl}/v1/resources/summary?groupBy=skill`);

  assert.equal(res.status, 422);
});

test("GET /v1/resources/summary rejects an unknown or repeated filter instead of ignoring it", async (t) => {
  let called = false;
  t.mock.method(pool, "query", async () => {
    called = true;
    return { rows: [] };
  });

  const unknown = await fetch(`${baseUrl}/v1/resources/summary?groupBy=designation&locationTyp=Offshore`);
  assert.equal(unknown.status, 422);
  assert.ok((await unknown.json()).error.details.locationTyp);

  const repeated = await fetch(`${baseUrl}/v1/resources/summary?groupBy=designation&locationType=Onsite&locationType=Offshore`);
  assert.equal(repeated.status, 422);
  assert.equal(called, false);
});

test("GET /v1/resources/summary passes a database failure to the error handler as a safe 500", async (t) => {
  t.mock.method(pool, "query", async () => {
    throw new Error("connection refused 10.0.0.5");
  });

  const res = await fetch(`${baseUrl}/v1/resources/summary?groupBy=designation`);
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5/);
});

test("GET /v1/resources/summary is not captured by the /:id route", async (t) => {
  t.mock.method(pool, "query", async (text) => {
    if (/where resources\.id = \$1/.test(text)) throw new Error("summary was routed to /:id");
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/resources/summary?groupBy=designation`);

  assert.equal(res.status, 200);
});
