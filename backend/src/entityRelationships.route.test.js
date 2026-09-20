import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import express from "express";
import { buildEntityRelationships } from "./entityRelationships.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";

// HTTP-layer test for GET /v1/schema/entity-relationships (FEAT-12),
// matching the project's pattern of also exercising master-data routes
// through a real Express request/response cycle (see
// masterDataRouter.testHelpers.js's startTestServer) rather than only unit
// testing the pure function in entityRelationships.test.js. This route is
// wired directly in index.js (not via createMasterDataRouter), so the test
// harness mirrors that one route instead of reusing the master-data helper.

let server;
let baseUrl;

before(async () => {
  const app = express();
  app.get("/v1/schema/entity-relationships", (req, res) => {
    res.json({ data: buildEntityRelationships(MASTER_DATA_TABLES) });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test("GET /v1/schema/entity-relationships returns 200 with one entry per master data table", async () => {
  const res = await fetch(`${baseUrl}/v1/schema/entity-relationships`);

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.length, MASTER_DATA_TABLES.length);
  const routes = body.data.map((e) => e.route).sort();
  assert.deepEqual(routes, MASTER_DATA_TABLES.map((t) => t.route).sort());
});

test("GET /v1/schema/entity-relationships requires no auth (read routes are unauthenticated throughout this API)", async () => {
  const res = await fetch(`${baseUrl}/v1/schema/entity-relationships`);
  assert.equal(res.status, 200);
});

test("GET /v1/schema/entity-relationships's teams entry matches the pure-function output exactly", async () => {
  const res = await fetch(`${baseUrl}/v1/schema/entity-relationships`);
  const body = await res.json();

  const expected = buildEntityRelationships(MASTER_DATA_TABLES).find((e) => e.route === "teams");
  const actual = body.data.find((e) => e.route === "teams");
  assert.deepEqual(actual, expected);
});
