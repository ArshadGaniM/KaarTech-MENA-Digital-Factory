import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { pool } from "./db.js";
import { teamMembersRouter } from "./routes/teamMembers.js";

// pool.query is mocked per test, same as the master-data route tests, so
// these prove the key check, status codes and response shape, not the SQL.

const MEMBER_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const ROW = {
  id: MEMBER_ID,
  full_name: "Asha Rao",
  role: null,
  department: null,
  email: null,
  avatar_url: null,
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let server;
let baseUrl;

before(async () => {
  process.env.INTERNAL_API_KEY = "test-secret";
  const app = express();
  app.use(express.json());
  app.use("/v1/team-members", teamMembersRouter);
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: { code: err.code || "internal_error", message: err.message } });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const writes = [
  ["POST", "/v1/team-members", { fullName: "Asha Rao" }],
  ["PATCH", `/v1/team-members/${MEMBER_ID}`, { role: "Lead" }],
  ["DELETE", `/v1/team-members/${MEMBER_ID}`, undefined],
];

for (const [method, path, body] of writes) {
  for (const [label, headers] of [
    ["without the internal API key", {}],
    ["with a wrong internal API key", { "x-internal-api-key": "wrong" }],
  ]) {
    test(`${method} ${path.replace(MEMBER_ID, ":id")} ${label} is rejected with 401 before any query runs`, async (t) => {
      let queryCalled = false;
      t.mock.method(pool, "query", async () => {
        queryCalled = true;
        return { rows: [] };
      });

      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ? JSON.stringify(body) : undefined,
      });

      assert.equal(res.status, 401);
      assert.equal((await res.json()).error.code, "unauthorized");
      assert.equal(queryCalled, false);
    });
  }
}

test("POST with the internal API key creates the member", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [ROW] }));

  const res = await fetch(`${baseUrl}/v1/team-members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ fullName: "Asha Rao" }),
  });

  assert.equal(res.status, 201);
  assert.equal((await res.json()).data.fullName, "Asha Rao");
});

test("PATCH with the internal API key updates the member", async (t) => {
  t.mock.method(pool, "query", async (sql) =>
    /^select/.test(sql) ? { rows: [ROW] } : { rows: [{ ...ROW, role: "Lead" }] }
  );

  const res = await fetch(`${baseUrl}/v1/team-members/${MEMBER_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ role: "Lead" }),
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.role, "Lead");
});

test("DELETE with the internal API key removes the member and returns 204", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [{ id: MEMBER_ID }] }));

  const res = await fetch(`${baseUrl}/v1/team-members/${MEMBER_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 204);
});

test("DELETE with the key on a missing member returns 404", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  const res = await fetch(`${baseUrl}/v1/team-members/${MEMBER_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 404);
});

test("GET stays open without a key", async (t) => {
  t.mock.method(pool, "query", async (sql) =>
    /count\(\*\)/.test(sql) ? { rows: [{ total: 1 }] } : { rows: [ROW] }
  );

  const res = await fetch(`${baseUrl}/v1/team-members`);

  assert.equal(res.status, 200);
  assert.equal((await res.json()).total, 1);
});
