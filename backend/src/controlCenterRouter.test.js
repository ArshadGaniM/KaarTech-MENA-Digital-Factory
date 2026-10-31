import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { EventEmitter } from "node:events";
import express from "express";
import { createControlCenterRouter } from "./controlCenterRouter.js";

const tables = {
  departments: [{ code: "DEPT-002", name: "Design Services" }],
  teams: [{ code: "TEAM-001", name: "Alpha", departmentCode: "DEPT-002" }],
  positions: [{ code: "POS-2", name: "Lead Consultant", teamCode: "TEAM-001", competencies: "FICO" }],
  deployments: [{ employeeId: 2, employeeName: "Lead Person", positionCode: "POS-2", allocationPercentage: 100 }],
  assignments: [],
};

function fakeQuery(sql) {
  const key = sql.includes("from departments") ? "departments"
    : sql.includes("from teams") ? "teams"
    : sql.includes("from positions") ? "positions"
    : sql.includes("from resource_deployment") ? "deployments"
    : "assignments";
  return Promise.resolve({ rows: tables[key] });
}

async function start(options = {}) {
  const feed = new EventEmitter();
  const changeFeed = { onChange: (fn) => (feed.on("changed", fn), () => feed.off("changed", fn)) };
  const app = express();
  app.use("/v1/control-center", createControlCenterRouter({ query: fakeQuery, changeFeed, now: () => "2026-10-30", ...options }));
  app.use((err, req, res, _next) => res.status(err.status || 500).json({ error: { code: err.code || "internal_error" } }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, feed, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

test("GET /v1/control-center returns the departments with their teams' hours", async () => {
  const { server, baseUrl } = await start();
  const body = await (await fetch(`${baseUrl}/v1/control-center`)).json();
  server.close();
  assert.equal(body.data.departments[0].teams[0].availableHours, 160);
  assert.equal(body.data.departments[0].teams[0].memberCount, 1);
});

test("GET /v1/control-center/teams/:code returns the seats, and 404 for an unknown team", async () => {
  const { server, baseUrl } = await start();
  const ok = await (await fetch(`${baseUrl}/v1/control-center/teams/TEAM-001`)).json();
  const missing = await fetch(`${baseUrl}/v1/control-center/teams/NOPE`);
  server.close();
  assert.equal(ok.data.seats[0].employeeName, "Lead Person");
  assert.equal(ok.data.department.name, "Design Services");
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "team_not_found");
});

test("a failing query is a 500 with no SQL detail", async () => {
  const { server, baseUrl } = await start({ query: () => Promise.reject(new Error("select * from secret")) });
  const res = await fetch(`${baseUrl}/v1/control-center`);
  const text = await res.text();
  server.close();
  assert.equal(res.status, 500);
  assert.ok(!text.includes("secret"));
});

test("GET /stream sends a 'changed' event when the change feed fires, and stops listening on close", async () => {
  const { server, feed, baseUrl } = await start();
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/v1/control-center/stream`, { signal: controller.signal });
  assert.equal(res.headers.get("content-type"), "text/event-stream");
  const reader = res.body.getReader();
  await reader.read(); // retry hint
  feed.emit("changed");
  const { value } = await reader.read();
  assert.match(new TextDecoder().decode(value), /event: changed/);
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(feed.listenerCount("changed"), 0);
  server.close();
});
