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
    floor_number: 10,
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

  const res = await send("POST", "", { name: "Design Services", floorNumber: 10, input: "Requirements", output: "Designs" });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.input, "Requirements");
  assert.equal(body.data.output, "Designs");
  assert.match(insertSql, /insert into departments \(name, floor_number, input, output, created_by, updated_by\)/);
  assert.deepEqual(insertValues.slice(0, 4), ["Design Services", 10, "Requirements", "Designs"]);
});

test("POST /v1/departments still works with neither input nor output (both optional)", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [row()] }));

  const res = await send("POST", "", { name: "Design Services", floorNumber: 10 });

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

  const res = await send("POST", "", { name: "Design Services", floorNumber: 10, input: "x".repeat(2001) });

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
  // [name, floor_number, input, output, updated_by, id] — input keeps its current value
  assert.deepEqual(updateValues.slice(0, 4), ["Design Services", 10, "Requirements", null]);
});

// FEAT-25: floorNumber is required, a whole number from 1, and unique among
// live departments.

test("POST /v1/departments without a floorNumber is a 422 and never inserts", async (t) => {
  let queried = false;
  t.mock.method(pool, "query", async () => {
    queried = true;
    return { rows: [] };
  });

  const res = await send("POST", "", { name: "Design Services" });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.floorNumber);
  assert.equal(queried, false);
});

for (const [label, floorNumber, message] of [
  ["a fraction", 2.5, /whole number/],
  ["zero", 0, /at least 1/],
  ["a negative number", -3, /at least 1/],
  ["a string", "two", /must be a number/],
  ["null", null, /floorNumber/],
  ["above the top floor", 1001, /at most 1000/],
  ["a number too big for the database column", 3000000000, /at most 1000/],
]) {
  test(`POST /v1/departments rejects floorNumber ${label} with a 422`, async (t) => {
    t.mock.method(pool, "query", async () => ({ rows: [] }));
    const res = await send("POST", "", { name: "Design Services", floorNumber });
    assert.equal(res.status, 422);
    assert.match((await res.json()).error.details.floorNumber, message);
  });
}

test("POST /v1/departments with a floor already used by a live department is a 422 naming floorNumber", async (t) => {
  t.mock.method(pool, "query", async () => {
    const err = new Error("duplicate key value violates unique constraint");
    err.code = "23505";
    err.constraint = "ux_departments_floor_number_live";
    throw err;
  });

  const res = await send("POST", "", { name: "Design Services", floorNumber: 10 });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.floorNumber, /already in use/);
});

test("PATCH /v1/departments/:id can move a department to another floor", async (t) => {
  let updateValues;
  t.mock.method(pool, "query", async (sql, values) => {
    if (sql.startsWith("select")) return { rows: [row()] };
    updateValues = values;
    return { rows: [row({ floor_number: 12 })] };
  });

  const res = await send("PATCH", `/${DEPT_ID}`, { floorNumber: 12 });

  assert.equal(res.status, 200);
  assert.equal(updateValues[1], 12);
  assert.equal((await res.json()).data.floorNumber, 12);
});

test("restoring a department whose floor was taken meanwhile is a 422 naming floorNumber", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select")) return { rows: [row({ deleted_at: "2026-02-01T00:00:00Z" })] };
    const err = new Error("duplicate key value violates unique constraint");
    err.code = "23505";
    err.constraint = "ux_departments_floor_number_live";
    throw err;
  });

  const res = await send("POST", `/${DEPT_ID}/restore`, {});

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.floorNumber);
});

for (const [label, floorNumber, message] of [
  ["a fraction", 2.5, /whole number/],
  ["zero", 0, /at least 1/],
  ["above the top floor", 1001, /at most 1000/],
  ["null", null, /floorNumber/],
]) {
  test(`PATCH /v1/departments/:id rejects floorNumber ${label} with a 422 and never updates`, async (t) => {
    let updated = false;
    t.mock.method(pool, "query", async (sql) => {
      if (sql.startsWith("select")) return { rows: [row()] };
      updated = true;
      return { rows: [row()] };
    });
    const res = await send("PATCH", `/${DEPT_ID}`, { floorNumber });
    assert.equal(res.status, 422);
    assert.match((await res.json()).error.details.floorNumber, message);
    assert.equal(updated, false);
  });
}

test("PATCH /v1/departments/:id without floorNumber leaves the floor as it was", async (t) => {
  let updateValues;
  t.mock.method(pool, "query", async (sql, values) => {
    if (sql.startsWith("select")) return { rows: [row({ floor_number: 7 })] };
    updateValues = values;
    return { rows: [row({ floor_number: 7, name: "Renamed" })] };
  });
  const res = await send("PATCH", `/${DEPT_ID}`, { name: "Renamed" });
  assert.equal(res.status, 200);
  assert.equal(updateValues[1], 7);
});

test("PATCH /v1/departments/:id onto a floor another live department holds is a 422 naming floorNumber", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select")) return { rows: [row()] };
    const err = new Error("duplicate key value violates unique constraint");
    err.code = "23505";
    err.constraint = "ux_departments_floor_number_live";
    throw err;
  });
  const res = await send("PATCH", `/${DEPT_ID}`, { floorNumber: 9 });
  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.floorNumber, /already in use/);
});
