import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer } from "./masterDataRouter.testHelpers.js";

// A practice cannot be deleted while live competencies belong to it.

const table = MASTER_DATA_TABLES.find((t) => t.route === "practices");
const ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const HEADERS = { "x-internal-api-key": "test-secret" };

let server;
let baseUrl;
before(async () => {
  ({ server, baseUrl } = await startTestServer(table));
});
after(async () => {
  await stopTestServer(server);
});

const del = () => fetch(`${baseUrl}/v1/practices/${ID}`, { method: "DELETE", headers: HEADERS });

test("DELETE removes a practice that no live competency uses, and the guard is part of the update itself", async (t) => {
  let sql;
  t.mock.method(pool, "query", async (text) => {
    sql = text;
    return { rows: [{ id: ID }] };
  });

  assert.equal((await del()).status, 204);
  assert.match(sql, /not exists \(select 1 from competencies d where d\.practice_code = practices\.code and d\.deleted_at is null\)/);
});

test("DELETE is a 409 practice_in_use, and nothing is deleted, while a live competency belongs to the practice", async (t) => {
  t.mock.method(pool, "query", async (text) => (text.startsWith("update") ? { rows: [] } : { rows: [{ "?column?": 1 }] }));

  const res = await del();

  assert.equal(res.status, 409);
  const { error } = await res.json();
  assert.equal(error.code, "practice_in_use");
  assert.match(error.message, /competencies still belong to it/);
});

test("DELETE of a practice that does not exist (or is already deleted) is still a 404", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  const res = await del();

  assert.equal(res.status, 404);
});
