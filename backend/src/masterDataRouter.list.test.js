import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer } from "./masterDataRouter.testHelpers.js";

// The Dashboard reports live-record counts, so the list route must return
// `activeTotal` (soft-deleted rows excluded) next to `total` (pagination).

const practicesTable = MASTER_DATA_TABLES.find((t) => t.route === "practices");

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(practicesTable));
});

after(async () => {
  await stopTestServer(server);
});

test("GET /v1/practices (list) returns total and activeTotal from one count query", async (t) => {
  let countSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) {
      countSql = sql;
      return { rows: [{ total: 10, activeTotal: 4 }] };
    }
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/practices`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.total, 10);
  assert.equal(body.activeTotal, 4);
  assert.match(countSql, /filter \(where deleted_at is null\)/);
});
