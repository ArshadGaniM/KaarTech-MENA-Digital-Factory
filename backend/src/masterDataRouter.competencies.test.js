import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer, registerAuthGateTests, registerDeleteTests } from "./masterDataRouter.testHelpers.js";

// Every competency belongs to one practice: practiceId is required and must be
// the code of a live practice. practiceName is a live lookup, never writable.

const table = MASTER_DATA_TABLES.find((t) => t.route === "competencies");
const ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const HEADERS = { "Content-Type": "application/json", "x-internal-api-key": "test-secret" };

let server;
let baseUrl;
before(async () => {
  ({ server, baseUrl } = await startTestServer(table));
});
after(async () => {
  await stopTestServer(server);
});

const row = (overrides = {}) => ({
  id: ID, name: "FICO", practice_code: "PRAC-001", created_by: "Arshad Gani", created_at: "2026-11-01T00:00:00Z",
  updated_by: "Arshad Gani", updated_at: "2026-11-01T00:00:00Z", deleted_at: null, ...overrides,
});

test("POST without a practice is a 422 and never inserts", async (t) => {
  let inserted = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("insert")) inserted = true;
    return { rows: [{}] };
  });

  const res = await fetch(`${baseUrl}/v1/competencies`, { method: "POST", headers: HEADERS, body: JSON.stringify({ name: "FICO" }) });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.practiceId);
  assert.equal(inserted, false);
});

test("POST with a practice that does not exist is a 422 on practiceId, and never inserts", async (t) => {
  let inserted = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from practices where code")) return { rows: [] };
    if (sql.startsWith("insert")) inserted = true;
    return { rows: [{}] };
  });

  const res = await fetch(`${baseUrl}/v1/competencies`, { method: "POST", headers: HEADERS, body: JSON.stringify({ name: "FICO", practiceId: "PRAC-999" }) });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.practiceId);
  assert.equal(inserted, false);
});

test("POST with a live practice inserts the practice code", async (t) => {
  let params;
  t.mock.method(pool, "query", async (sql, p) => {
    if (sql.includes("select 1 from practices where code")) return { rows: [{}] };
    if (sql.startsWith("insert into competencies")) {
      params = p;
      return { rows: [row()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/competencies`, { method: "POST", headers: HEADERS, body: JSON.stringify({ name: "FICO", practiceId: "PRAC-001" }) });

  assert.equal(res.status, 201);
  assert.ok(params.includes("PRAC-001"));
  assert.equal((await res.json()).data.practiceId, "PRAC-001");
});

test("PATCH to a practice that does not exist is a 422 and never updates", async (t) => {
  let updated = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from practices where code")) return { rows: [] };
    if (sql.startsWith("update")) updated = true;
    return { rows: [row()] };
  });

  const res = await fetch(`${baseUrl}/v1/competencies/${ID}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify({ practiceId: "PRAC-999" }) });

  assert.equal(res.status, 422);
  assert.equal(updated, false);
});

test("PATCH cannot clear the practice", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [row()] }));

  const res = await fetch(`${baseUrl}/v1/competencies/${ID}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify({ practiceId: null }) });

  assert.equal(res.status, 422);
});

test("the list joins the practice, so each competency carries its practice name", async (t) => {
  let listSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("count(*)")) return { rows: [{ total: "1", active_total: "1" }] };
    listSql = sql;
    return { rows: [row({ lookup_0_name: "Finance" })] };
  });

  const res = await fetch(`${baseUrl}/v1/competencies`);

  assert.equal(res.status, 200);
  assert.match(listSql, /join practices|left join practices/i);
  assert.equal((await res.json()).data[0].practiceName, "Finance");
});

test("PATCH to another live practice succeeds and saves the new practice code", async (t) => {
  let params;
  t.mock.method(pool, "query", async (sql, p) => {
    if (sql.startsWith("select * from competencies where id")) return { rows: [row()] };
    if (sql.includes("select 1 from practices where code")) return { rows: [{}] };
    if (sql.startsWith("update competencies")) {
      params = p;
      return { rows: [row({ practice_code: "PRAC-007" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/competencies/${ID}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify({ practiceId: "PRAC-007" }) });

  assert.equal(res.status, 200);
  assert.ok(params.includes("PRAC-007"));
  assert.equal((await res.json()).data.practiceId, "PRAC-007");
});

test("restoring a competency whose practice has since been deleted is a 422 on practiceId, and nothing is restored", async (t) => {
  let restored = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from competencies where id")) return { rows: [row({ deleted_at: "2026-11-01T00:00:00Z" })] };
    if (sql.includes("select 1 from practices where code")) return { rows: [] };
    if (sql.startsWith("update competencies")) restored = true;
    return { rows: [row()] };
  });

  const res = await fetch(`${baseUrl}/v1/competencies/${ID}/restore`, { method: "POST", headers: HEADERS });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.practiceId);
  assert.equal(restored, false);
});

test("a second live competency with the same name is a 422 on name", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from practices where code")) return { rows: [{}] };
    throw Object.assign(new Error("duplicate"), { code: "23505", constraint: "ux_competencies_name_live" });
  });

  const res = await fetch(`${baseUrl}/v1/competencies`, { method: "POST", headers: HEADERS, body: JSON.stringify({ name: "FICO", practiceId: "PRAC-001" }) });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.name);
});

registerAuthGateTests({ getBaseUrl: () => baseUrl, route: "competencies", getId: () => ID, postBody: { name: "X", practiceId: "PRAC-001" }, patchBody: { name: "Y" } });
registerDeleteTests({ getBaseUrl: () => baseUrl, route: "competencies", getId: () => ID, tableName: "competencies", resourceName: "competency" });
