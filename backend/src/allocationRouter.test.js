import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createAllocationRouter } from "./allocationRouter.js";

// The query function is injected, so these prove routing, validation, the
// response shape and that values only ever travel as bound parameters. They
// do not run the SQL: it was checked read-only against the live database.

let calls;
let answer;
let server;
let baseUrl;

const fakeQuery = async (sql, params) => {
  calls.push({ sql, params });
  return answer(sql, params);
};

before(async () => {
  const app = express();
  app.use("/v1/allocation", createAllocationRouter({ query: fakeQuery }));
  // Mirrors index.js's error middleware: a 500 never shows its cause.
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    const message = status === 500 ? "An unexpected error occurred." : err.message;
    res.status(status).json({ error: { code: err.code || "internal_error", message, details: err.details || {} } });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const bucketRows = [
  { key: "none", count: 2658 },
  { key: "full", count: 98 },
];
const positionRows = [
  { value: "Consultant", count: 71 },
  { value: "Lead Consultant", count: 27 },
];

const reset = () => {
  calls = [];
  answer = (sql) => ({ rows: sql.includes("select pe.bucket") ? bucketRows : positionRows });
};

test("GET /v1/allocation/summary returns all four buckets in a fixed order, filling missing ones with zero", async () => {
  reset();

  const res = await fetch(`${baseUrl}/v1/allocation/summary`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.deepEqual(body.data.buckets, [
    { key: "full", count: 98 },
    { key: "partial", count: 0 },
    { key: "none", count: 2658 },
    { key: "over", count: 0 },
  ]);
  assert.deepEqual(body.data.positions, positionRows);
});

test("GET /v1/allocation/summary passes no filters as nulls", async () => {
  reset();

  await fetch(`${baseUrl}/v1/allocation/summary`);

  assert.equal(calls.length, 2);
  for (const call of calls) assert.deepEqual(call.params, [null]);
});

test("GET /v1/allocation/summary filters each side by the other's pick, never its own", async () => {
  reset();

  await fetch(`${baseUrl}/v1/allocation/summary?bucket=full&position=Lead%20Consultant`);

  const bucketQuery = calls.find((c) => c.sql.includes("select pe.bucket"));
  const positionQuery = calls.find((c) => c.sql.includes("select pl.position"));
  assert.deepEqual(bucketQuery.params, ["Lead Consultant"]);
  assert.deepEqual(positionQuery.params, ["full"]);
});

test("GET /v1/allocation/summary binds the position as a parameter, never into the SQL text", async () => {
  reset();
  const hostile = "x' or '1'='1";

  const res = await fetch(`${baseUrl}/v1/allocation/summary?position=${encodeURIComponent(hostile)}`);

  assert.equal(res.status, 200);
  for (const call of calls) assert.doesNotMatch(call.sql, /1'='1/);
  assert.deepEqual(calls.find((c) => c.sql.includes("select pe.bucket")).params, [hostile]);
});

test("GET /v1/allocation/summary never shows the name of a soft-deleted position", async () => {
  reset();

  await fetch(`${baseUrl}/v1/allocation/summary`);

  for (const call of calls) assert.match(call.sql, /join positions p on p\.code = rd\.position_code and p\.deleted_at is null/);
});

test("GET /v1/allocation/summary counts only live resources and live deployments", async () => {
  reset();

  await fetch(`${baseUrl}/v1/allocation/summary`);

  for (const call of calls) {
    assert.match(call.sql, /r\.deleted_at is null/);
    assert.match(call.sql, /rd\.deleted_at is null/);
  }
});

test("GET /v1/allocation/summary rejects an unknown bucket, an unknown key, and a bad position with 422 and runs no query", async () => {
  reset();

  const cases = [
    ["?bucket=everyone", "bucket"],
    ["?bucket=full&bucket=none", "bucket"],
    ["?bucktet=full", "bucktet"],
    ["?position=", "position"],
    [`?position=${"a".repeat(256)}`, "position"],
    ["?position=Lead%00Consultant", "position"],
    ["?position=a&position=b", "position"],
    ["?position[x]=y", "position[x]"],
    ["?bucket[]=full", "bucket[]"],
  ];
  for (const [query, field] of cases) {
    const res = await fetch(`${baseUrl}/v1/allocation/summary${query}`);
    const body = await res.json();
    assert.equal(res.status, 422, query);
    assert.ok(body.error.details[field], query);
  }
  assert.equal(calls.length, 0);
});

test("GET /v1/allocation/summary reports every invalid field at once", async () => {
  reset();

  const res = await fetch(`${baseUrl}/v1/allocation/summary?bucket=nope&extra=1`);
  const body = await res.json();

  assert.deepEqual(Object.keys(body.error.details).sort(), ["bucket", "extra"]);
});

test("GET /v1/allocation/summary answers a database failure with a safe 500", async () => {
  reset();
  answer = () => {
    throw new Error("connection refused 10.0.0.5");
  };

  const res = await fetch(`${baseUrl}/v1/allocation/summary`);
  const body = await res.json();

  assert.equal(res.status, 500);
  assert.doesNotMatch(JSON.stringify(body), /10\.0\.0\.5/);
});

test("GET /v1/allocation/summary treats a bucket with no people as zero and an empty position list as empty", async () => {
  reset();
  answer = () => ({ rows: [] });

  const res = await fetch(`${baseUrl}/v1/allocation/summary?bucket=none`);
  const body = await res.json();

  assert.deepEqual(body.data.positions, []);
  assert.deepEqual(
    body.data.buckets.map((b) => b.count),
    [0, 0, 0, 0]
  );
});

// The router reads the raw query string, so none of this depends on how
// Express parses it. Express's default parser silently removes `__proto__`
// and the simple one keeps it, and `false` leaves req.query empty.
for (const parser of ["extended", "simple", false]) {
  test(`GET /v1/allocation/summary rejects bad filters whatever the query parser is (${parser})`, async () => {
    const app = express();
    app.set("query parser", parser);
    app.use("/v1/allocation", createAllocationRouter({ query: fakeQuery }));
    app.use((err, req, res, _next) => {
      res.status(err.status || 500).json({ error: { code: err.code || "internal_error", message: err.message, details: err.details || {} } });
    });
    const local = http.createServer(app);
    await new Promise((resolve) => local.listen(0, resolve));
    const base = `http://127.0.0.1:${local.address().port}/v1/allocation/summary`;
    reset();

    try {
      for (const bad of ["?__proto__=x", "?__proto__[a]=x", "?bucket=nope", "?bucket=full&bucket=none", "?constructor=1", "?position[x]=y"]) {
        const res = await fetch(base + bad);
        assert.equal(res.status, 422, `${parser} ${bad}`);
      }
      assert.equal(calls.length, 0);

      const ok = await fetch(`${base}?bucket=full&position=Lead%20Consultant`);
      assert.equal(ok.status, 200, `${parser} valid request`);
      assert.deepEqual(calls.find((c) => c.sql.includes("select pe.bucket")).params, ["Lead Consultant"]);
      assert.deepEqual(calls.find((c) => c.sql.includes("select pl.position")).params, ["full"]);
    } finally {
      await new Promise((resolve) => local.close(resolve));
    }
  });
}

test("GET /v1/allocation/summary reports a __proto__ key as an own key of the details", async () => {
  reset();

  const res = await fetch(`${baseUrl}/v1/allocation/summary?__proto__=x`);
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.ok(Object.hasOwn(body.error.details, "__proto__"));
});

test("GET /v1/allocation/summary shortens a very long unknown key in its error", async () => {
  reset();
  const key = "k".repeat(500);

  const res = await fetch(`${baseUrl}/v1/allocation/summary?${key}=1`);
  const body = await res.json();

  assert.equal(res.status, 422);
  assert.equal(Object.keys(body.error.details)[0].length, 50);
});

