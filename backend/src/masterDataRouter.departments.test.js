import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer } from "./masterDataRouter.testHelpers.js";

// FEAT-20: departments gained two optional free-text fields, input and
// output. HTTP-layer tests against the real descriptor (pool.query mocked,
// as everywhere in this directory — see masterDataRouter.testHelpers.js).

const departmentsTable = MASTER_DATA_TABLES.find((t) => t.route === "departments");
const DEPT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(departmentsTable));
});

after(async () => {
  await stopTestServer(server);
});

function row(overrides = {}) {
  return {
    id: DEPT_ID,
    code: "DEPT-013",
    name: "Design Services",
    input: null,
    output: null,
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function send(method, path, body) {
  return fetch(`${baseUrl}/v1/departments${path}`, {
    method,
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify(body),
  });
}

test("POST /v1/departments stores input/output and returns them", async (t) => {
  let insertSql;
  let insertValues;
  t.mock.method(pool, "query", async (sql, values) => {
    insertSql = sql;
    insertValues = values;
    return { rows: [row({ input: "Requirements", output: "Designs" })] };
  });

  const res = await send("POST", "", { name: "Design Services", input: "Requirements", output: "Designs" });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.input, "Requirements");
  assert.equal(body.data.output, "Designs");
  assert.match(insertSql, /insert into departments \(name, input, output, created_by, updated_by\)/);
  assert.deepEqual(insertValues.slice(0, 3), ["Design Services", "Requirements", "Designs"]);
});

test("POST /v1/departments still works with neither input nor output (both optional)", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [row()] }));

  const res = await send("POST", "", { name: "Design Services" });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.input, null);
  assert.equal(body.data.output, null);
});

test("POST /v1/departments rejects an input longer than 2,000 characters with a 422 and never inserts", async (t) => {
  let queried = false;
  t.mock.method(pool, "query", async () => {
    queried = true;
    return { rows: [] };
  });

  const res = await send("POST", "", { name: "Design Services", input: "x".repeat(2001) });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.input);
  assert.equal(queried, false);
});

test("PATCH /v1/departments/:id can set output without touching input, and null clears it", async (t) => {
  let updateValues;
  t.mock.method(pool, "query", async (sql, values) => {
    if (sql.startsWith("select")) return { rows: [row({ input: "Requirements", output: "Old" })] };
    updateValues = values;
    return { rows: [row({ input: "Requirements", output: null })] };
  });

  const res = await send("PATCH", `/${DEPT_ID}`, { output: null });

  assert.equal(res.status, 200);
  // [name, input, output, updated_by, id] — input keeps its current value
  assert.deepEqual(updateValues.slice(0, 3), ["Design Services", "Requirements", null]);
});
