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
  assert.match(countSql, /filter \(where practices\.deleted_at is null\)/);
});

// FEAT-24: ?q= filters rows on any cell, exact or near-miss.
test("GET /v1/practices?q= binds the term and filters the rows and the count on it", async (t) => {
  const seen = [];
  t.mock.method(pool, "query", async (sql, params) => {
    seen.push({ sql, params });
    return { rows: sql.startsWith("select count(*)") ? [{ total: 1, activeTotal: 1 }] : [] };
  });

  const res = await fetch(`${baseUrl}/v1/practices?q=${encodeURIComponent("  Digital  ")}&limit=5&offset=10`);

  assert.equal(res.status, 200);
  const list = seen.find((q) => q.sql.startsWith("select practices.*"));
  assert.deepEqual(list.params, ["Digital", 5, 10]);
  assert.match(list.sql, /position\(lower\(\$1\) in lower\(concat_ws/);
  assert.match(list.sql, /public\.word_similarity\(\$1/);
  assert.match(list.sql, /limit \$2 offset \$3/);
  const count = seen.find((q) => q.sql.startsWith("select count(*)"));
  assert.deepEqual(count.params, ["Digital"]);
  assert.match(count.sql, /where \(position\(lower\(\$1\)/);
});

test("GET /v1/practices without q (or with a blank q) runs the unfiltered queries", async (t) => {
  const seen = [];
  t.mock.method(pool, "query", async (sql, params) => {
    seen.push({ sql, params });
    return { rows: sql.startsWith("select count(*)") ? [{ total: 0, activeTotal: 0 }] : [] };
  });

  for (const url of ["/v1/practices", "/v1/practices?q=", "/v1/practices?q=%20%20"]) {
    seen.length = 0;
    assert.equal((await fetch(`${baseUrl}${url}`)).status, 200, url);
    assert.ok(seen.every((q) => !q.sql.includes("word_similarity")), url);
    assert.deepEqual(seen.find((q) => q.sql.startsWith("select practices.*")).params, [20, 0]);
  }
});

test("a search term is capped at 100 characters and never interpolated into the SQL", async (t) => {
  const seen = [];
  t.mock.method(pool, "query", async (sql, params) => {
    seen.push({ sql, params });
    return { rows: sql.startsWith("select count(*)") ? [{ total: 0, activeTotal: 0 }] : [] };
  });
  const evil = "x'; drop table practices; --" + "y".repeat(200);

  await fetch(`${baseUrl}/v1/practices?q=${encodeURIComponent(evil)}`);

  const list = seen.find((q) => q.sql.startsWith("select practices.*"));
  assert.equal(list.params[0].length, 100);
  assert.ok(!list.sql.includes("drop table"));
});
