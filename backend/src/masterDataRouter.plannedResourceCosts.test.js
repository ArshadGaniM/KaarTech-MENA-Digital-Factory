import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import {
  startTestServer,
  stopTestServer,
  registerAuthGateTests,
  registerDeleteTests,
} from "./masterDataRouter.testHelpers.js";

// Planned Resource Cost: a monthly USD cost per designation, offshore and
// onsite. Designation is the unique key (live rows); grade is not unique.

const table = MASTER_DATA_TABLES.find((t) => t.route === "planned-resource-costs");
const ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const HEADERS = { "Content-Type": "application/json", "x-internal-api-key": "test-secret" };
const VALID = { designation: "Senior Consultant", grade: "K16", offshoreCost: 1800, onsiteCost: 3300 };

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(table));
});
after(async () => {
  await stopTestServer(server);
});

const row = (overrides = {}) => ({
  id: ID, designation: "Senior Consultant", grade: "K16", offshore_cost: "1800", onsite_cost: "3300",
  created_by: "Arshad Gani", created_at: "2026-11-01T00:00:00Z", updated_by: "Arshad Gani", updated_at: "2026-11-01T00:00:00Z",
  deleted_at: null, ...overrides,
});

test("POST creates a planned cost and returns the costs as numbers", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    assert.ok(sql.startsWith("insert into planned_resource_costs"));
    return { rows: [row()] };
  });

  const res = await fetch(`${baseUrl}/v1/planned-resource-costs`, { method: "POST", headers: HEADERS, body: JSON.stringify(VALID) });

  assert.equal(res.status, 201);
  const { data } = await res.json();
  assert.equal(data.offshoreCost, 1800);
  assert.equal(data.onsiteCost, 3300);
  assert.equal(data.grade, "K16");
});

test("POST is 422 for a missing designation, a missing cost or a negative cost, and never inserts", async (t) => {
  let inserted = false;
  t.mock.method(pool, "query", async () => {
    inserted = true;
    return { rows: [row()] };
  });

  for (const body of [
    { ...VALID, designation: undefined },
    { ...VALID, offshoreCost: undefined },
    { ...VALID, onsiteCost: -1 },
    { ...VALID, grade: undefined },
  ]) {
    const res = await fetch(`${baseUrl}/v1/planned-resource-costs`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
    assert.equal(res.status, 422);
  }
  assert.equal(inserted, false);
});

test("POST names the designation when it is already used by a live row", async (t) => {
  t.mock.method(pool, "query", async () => {
    throw Object.assign(new Error("duplicate"), { code: "23505", constraint: "ux_planned_resource_costs_designation_live" });
  });

  const res = await fetch(`${baseUrl}/v1/planned-resource-costs`, { method: "POST", headers: HEADERS, body: JSON.stringify(VALID) });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.designation);
});

test("two designations may share a grade and the same costs (K1 is on both Engineer and Intern)", async (t) => {
  t.mock.method(pool, "query", async (sql, params) => ({ rows: [row({ designation: params[0], grade: "K1" })] }));

  for (const designation of ["Engineer", "Intern"]) {
    const res = await fetch(`${baseUrl}/v1/planned-resource-costs`, {
      method: "POST", headers: HEADERS, body: JSON.stringify({ ...VALID, designation, grade: "K1" }),
    });
    assert.equal(res.status, 201);
  }
});

test("PATCH changes one cost and leaves the rest", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from planned_resource_costs where id")) return { rows: [row()] };
    return { rows: [row({ offshore_cost: "1900" })] };
  });

  const res = await fetch(`${baseUrl}/v1/planned-resource-costs/${ID}`, { method: "PATCH", headers: HEADERS, body: JSON.stringify({ offshoreCost: 1900 }) });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.offshoreCost, 1900);
});

registerAuthGateTests({
  getBaseUrl: () => baseUrl,
  route: "planned-resource-costs",
  getId: () => ID,
  postBody: VALID,
  patchBody: { offshoreCost: 1 },
});

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "planned-resource-costs",
  getId: () => ID,
  tableName: "planned_resource_costs",
  resourceName: "planned_resource_cost",
});

test("POST is 422 for an absurd cost or an over-long designation or grade", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [row()] }));
  for (const body of [
    { ...VALID, offshoreCost: 1e300 },
    { ...VALID, onsiteCost: 1000001 },
    { ...VALID, designation: "x".repeat(101) },
    { ...VALID, grade: "K".repeat(21) },
  ]) {
    const res = await fetch(`${baseUrl}/v1/planned-resource-costs`, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
    assert.equal(res.status, 422);
  }
});
