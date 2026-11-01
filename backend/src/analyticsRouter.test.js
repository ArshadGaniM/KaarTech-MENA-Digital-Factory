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
  if (sql.includes("blank_check_marker") || sql.includes("select 'count' as kind")) return { rows: [{ kind: "count", table: "practices", live: 10, deleted: 3 }] };
  if (sql.includes("from project_assignments")) return { rows: [{ teamCode: "TEAM-1", projectName: "Roll out", start: "2026-01-01", end: "2026-12-31" }] };
  if (sql.includes("'competency' as kind")) return { rows: [{ kind: "competency", name: "FICO", practiceName: "Finance" }, { kind: "department", name: "Design", floorNumber: 3 }, { kind: "team", name: "Alpha", teamCode: "TEAM-1", departmentName: "Design" }] };
  if (sql.includes("c.name, p.name as \"practiceName\"")) return { rows: [{ name: "FICO", practiceName: "Finance" }] };
  if (sql.includes("from positions p")) return { rows: [{ teamCode: "TEAM-1", teamName: "Alpha", positionName: "Consultant", competencies: "FICO, MM", filled: true }] };
  if (sql.includes("from departments")) return { rows: [{ code: "DEPT-1", name: "Design", floorNumber: 1 }] };
  if (sql.includes("from teams")) return { rows: [{ code: "TEAM-1", name: "Alpha", departmentCode: "DEPT-1" }] };
  if (sql.includes("from positions")) return { rows: [{ code: "POS-1", name: "Consultant", teamCode: "TEAM-1", competencies: null }] };
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

test("GET /v1/analytics/seats gives one row per seat per month for a valid range", async () => {
  const res = await fetch(`${baseUrl}/v1/analytics/seats?from=2026-09&to=2026-10`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total, 2);
  assert.deepEqual(body.data.map((seat) => seat.month), ["2026-09", "2026-10"]);
  assert.equal(body.data[0].teamCode, "TEAM-1");
});

test("GET /v1/analytics/seats uses the current month when no range is given, and one month when only from is", async () => {
  const none = await (await fetch(`${baseUrl}/v1/analytics/seats`)).json();
  assert.deepEqual(none.data.map((seat) => seat.month), ["2026-10"]);
  const fromOnly = await (await fetch(`${baseUrl}/v1/analytics/seats?from=2026-08`)).json();
  assert.deepEqual(fromOnly.data.map((seat) => seat.month), ["2026-08"]);
});

test("GET /v1/analytics/seats answers 422 when only to is given and it is before the current month", async () => {
  const res = await fetch(`${baseUrl}/v1/analytics/seats?to=2026-09`);
  assert.equal(res.status, 422);
});

test("GET /v1/analytics/structure returns one row per position with the team practice and a competency list", async () => {
  const res = await fetch(`${baseUrl}/v1/analytics/structure`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.total, 1);
  assert.deepEqual(body.data[0].competencies, ["FICO", "MM"]);
  assert.equal(body.data[0].practiceName, "Finance");
});

test("GET /v1/analytics/catalog and /assignments return their rows", async () => {
  const catalog = await (await fetch(`${baseUrl}/v1/analytics/catalog`)).json();
  assert.deepEqual(catalog.data.map((row) => row.kind), ["competency", "department", "team"]);
  const assignments = await (await fetch(`${baseUrl}/v1/analytics/assignments`)).json();
  assert.equal(assignments.total, 1);
  assert.equal(assignments.data[0].projectName, "Roll out");
});

test("the structure, catalog and assignments routes answer 500 without the cause when the database fails", async () => {
  for (const path of ["structure", "catalog", "assignments"]) {
    const failing = express();
    failing.use("/v1/analytics", createAnalyticsRouter({ query: async () => { throw new Error("secret detail"); } }));
    failing.use((err, req, res, _next) => res.status(500).json({ error: { message: "An unexpected error occurred." } }));
    const s = http.createServer(failing);
    await new Promise((resolve) => s.listen(0, resolve));
    const res = await fetch(`http://127.0.0.1:${s.address().port}/v1/analytics/${path}`);
    const text = await res.text();
    await new Promise((resolve) => s.close(resolve));
    assert.equal(res.status, 500, path);
    assert.equal(text.includes("secret detail"), false, path);
  }
});

test("GET /v1/analytics/health returns the rows and answers 500 without the cause when the database fails", async () => {
  const ok = await (await fetch(`${baseUrl}/v1/analytics/health`)).json();
  assert.equal(ok.total, 1);
  assert.equal(ok.data[0].kind, "count");

  const failing = express();
  failing.use("/v1/analytics", createAnalyticsRouter({ query: async () => { throw new Error("secret detail"); } }));
  failing.use((err, req, res, _next) => res.status(500).json({ error: { message: "An unexpected error occurred." } }));
  const s = http.createServer(failing);
  await new Promise((resolve) => s.listen(0, resolve));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/v1/analytics/health`);
  const text = await res.text();
  await new Promise((resolve) => s.close(resolve));
  assert.equal(res.status, 500);
  assert.equal(text.includes("secret detail"), false);
});
