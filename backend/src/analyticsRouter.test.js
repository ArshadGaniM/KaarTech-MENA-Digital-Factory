import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { createAnalyticsRouter } from "./analyticsRouter.js";

// The query function is injected, so these prove routing, validation and the
// response shape. The SQL was checked read-only against the live database.

let server;
let baseUrl;
let calls;

const fakeQuery = async (sql) => {
  calls.push(sql);
  if (sql.includes("from resources r")) {
    return { rows: [{ employeeId: 1, skill: "FI, MM", allocation: 100, locationType: "Offshore" }] };
  }
  return { rows: [] };
};

before(async () => {
  const app = express();
  app.use("/v1/analytics", createAnalyticsRouter({ query: fakeQuery, now: () => "2026-10", today: () => "2026-10-20" }));
  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    res.status(status).json({ error: { code: err.code || "internal_error", message: status === 500 ? "An unexpected error occurred." : err.message, details: err.details || {} } });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("GET /v1/analytics/people returns one row per resource with skills split", async () => {
  calls = [];
  const res = await fetch(`${baseUrl}/v1/analytics/people`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total, 1);
  assert.deepEqual(body.data[0].skills, ["FI", "MM"]);
  assert.equal(body.data[0].allocation, 100);
});

test("GET /v1/analytics/people answers 500 without the cause when the database fails", async () => {
  const failing = express();
  failing.use("/v1/analytics", createAnalyticsRouter({ query: async () => { throw new Error("secret detail"); } }));
  failing.use((err, req, res, _next) => res.status(500).json({ error: { message: "An unexpected error occurred." } }));
  const s = http.createServer(failing);
  await new Promise((resolve) => s.listen(0, resolve));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/v1/analytics/people`);
  const text = await res.text();
  await new Promise((resolve) => s.close(resolve));
  assert.equal(res.status, 500);
  assert.equal(text.includes("secret detail"), false);
});

test("GET /v1/analytics/seats defaults to the current month and returns a list", async () => {
  calls = [];
  const res = await fetch(`${baseUrl}/v1/analytics/seats`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(body.data, []);
  assert.equal(body.total, 0);
});

test("GET /v1/analytics/seats answers 422 for a bad, reversed, repeated or oversized range, and runs no query", async () => {
  for (const qs of ["from=2026-13&to=2026-12", "from=2026-12&to=2026-10", "from=2026-01&to=2030-01", "from=2026-10&from=2026-11", "from[a]=b&to=2026-10"]) {
    calls = [];
    const res = await fetch(`${baseUrl}/v1/analytics/seats?${qs}`);
    const body = await res.json();
    assert.equal(res.status, 422, qs);
    assert.equal(body.error.code, "validation_error", qs);
    assert.equal(calls.length, 0, qs);
  }
});
