import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createInitiativePlanRouter } from "./initiativePlanRouter.js";
import { INITIATIVE_PLAN_KEYS } from "./initiativePlanKeys.js";

// The query function is injected, so these prove routing, auth, validation,
// the response shape and that values only travel as bound parameters. They do
// not run the SQL, which was checked against the live database.

let calls;
let answer;
let server;
let baseUrl;
const HEADERS = { "Content-Type": "application/json", "x-internal-api-key": "test-secret" };

before(async () => {
  process.env.INTERNAL_API_KEY = "test-secret";
  const app = express();
  app.use(express.json());
  app.use(
    "/v1/initiative-plan",
    createInitiativePlanRouter({
      query: async (sql, params) => {
        calls.push({ sql, params });
        return answer(sql, params);
      },
    })
  );
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: { code: err.code || "internal_error", message: status === 500 ? "An unexpected error occurred." : err.message, details: err.details || {} } });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

const row = (overrides = {}) => ({
  activity_key: "1a", actual_start_week: 2, actual_end_week: 6, actual_poc: 100,
  updated_by: "Arshad Gani", updated_at: "2026-10-31T00:00:00Z", ...overrides,
});

test("the key list has the 3 groups and their 27 activities, in the plan's own Sl. No", () => {
  assert.equal(INITIATIVE_PLAN_KEYS.length, 30);
  assert.deepEqual(INITIATIVE_PLAN_KEYS.slice(0, 3), ["1.0", "1a", "1b"]);
  assert.equal(INITIATIVE_PLAN_KEYS.at(-1), "3i");
});

test("GET /actuals lists the recorded actuals and needs no key", async () => {
  calls = [];
  answer = () => ({ rows: [row()] });

  const res = await fetch(`${baseUrl}/v1/initiative-plan/actuals`);

  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).data, [
    { activityKey: "1a", actualStartWeek: 2, actualEndWeek: 6, actualPoc: 100, updatedBy: "Arshad Gani", updatedAt: "2026-10-31T00:00:00Z" },
  ]);
});

test("PUT /actuals/:key without the key is 401 and runs no query", async () => {
  calls = [];
  const res = await fetch(`${baseUrl}/v1/initiative-plan/actuals/1a`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actualPoc: 10 }) });

  assert.equal(res.status, 401);
  assert.equal(calls.length, 0);
});

test("PUT /actuals/:key upserts with bound parameters and returns the row", async () => {
  calls = [];
  answer = () => ({ rows: [row({ activity_key: "2b", actual_start_week: 18, actual_end_week: null, actual_poc: 40 })] });

  const res = await fetch(`${baseUrl}/v1/initiative-plan/actuals/2b`, {
    method: "PUT", headers: HEADERS, body: JSON.stringify({ actualStartWeek: 18, actualEndWeek: null, actualPoc: 40, updatedBy: "  Aisha  " }),
  });

  assert.equal(res.status, 200);
  assert.deepEqual(calls[0].params, ["2b", 18, null, 40, "Aisha"]);
  assert.match(calls[0].sql, /on conflict \(activity_key\) do update/);
  assert.equal((await res.json()).data.actualPoc, 40);
});

test("PUT rejects bad weeks, order and percentages with a 422 and never queries", async () => {
  const bad = [
    { actualStartWeek: 0, actualPoc: 10 },
    { actualStartWeek: 66, actualPoc: 10 },
    { actualStartWeek: 1.5, actualPoc: 10 },
    { actualStartWeek: 5, actualEndWeek: 4, actualPoc: 10 },
    { actualEndWeek: 4, actualPoc: 10 },
    { actualStartWeek: 1, actualPoc: 101 },
    { actualStartWeek: 1, actualPoc: -1 },
    { actualStartWeek: 1, actualPoc: "50" },
    { actualStartWeek: 1 },
    { actualPoc: 10, updatedBy: 5 },
  ];
  for (const body of bad) {
    calls = [];
    const res = await fetch(`${baseUrl}/v1/initiative-plan/actuals/1a`, { method: "PUT", headers: HEADERS, body: JSON.stringify(body) });
    assert.equal(res.status, 422, JSON.stringify(body));
    assert.equal(calls.length, 0);
  }
});

test("an activity that is not in the plan is 404 for PUT and DELETE, and the key is never run as SQL", async () => {
  calls = [];
  for (const method of ["PUT", "DELETE"]) {
    const res = await fetch(`${baseUrl}/v1/initiative-plan/actuals/${encodeURIComponent("9z'; drop table x;--")}`, { method, headers: HEADERS, body: method === "PUT" ? JSON.stringify({ actualPoc: 1 }) : undefined });
    assert.equal(res.status, 404, method);
  }
  assert.equal(calls.length, 0);
});

test("DELETE /actuals/:key clears an actual (204) and is 404 when none was recorded", async () => {
  calls = [];
  answer = () => ({ rows: [{ activity_key: "1a" }] });
  assert.equal((await fetch(`${baseUrl}/v1/initiative-plan/actuals/1a`, { method: "DELETE", headers: HEADERS })).status, 204);

  answer = () => ({ rows: [] });
  assert.equal((await fetch(`${baseUrl}/v1/initiative-plan/actuals/1a`, { method: "DELETE", headers: HEADERS })).status, 404);
});
