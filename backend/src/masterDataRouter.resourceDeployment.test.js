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

// Integration tests for FEAT-7 (Resource Deployment real schema): the first
// master-data table with TWO concurrent `references` fields (employeeId ->
// resources.employee_id, positionId -> positions.code) and TWO `lookups`
// entries (employeeName from resources.name, positionName from
// positions.name). Mirrors masterDataRouter.resourceCost.test.js's
// structure (see that file's header for the shared harness's pool.query-
// mocked-per-SQL-shape deviation), extended with cases exercising both FK
// fields and both lookups together, since no prior single-FK table's suite
// covered that.

const resourceDeploymentTable = MASTER_DATA_TABLES.find((t) => t.route === "resource-deployment");
const RESOURCE_DEPLOYMENT_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(resourceDeploymentTable));
});

after(async () => {
  await stopTestServer(server);
});

function baseRow(overrides = {}) {
  return {
    id: RESOURCE_DEPLOYMENT_ID,
    employee_id: 42,
    position_code: "POS-001",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

test("POST /v1/resource-deployment rejects a non-existent employeeId AND positionId together in one 422, and never inserts", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [] };
    if (sql.includes("select 1 from positions where code")) return { rows: [] };
    if (sql.startsWith("insert into resource_deployment")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 999999, positionId: "POS-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  // Both FK checks run concurrently via Promise.all — both failures must
  // surface together in one response, not just the first one checked.
  assert.ok(body.error.details.employeeId);
  assert.ok(body.error.details.positionId);
  assert.equal(insertCalled, false);
});

test("POST /v1/resource-deployment rejects a bad positionId even when employeeId is valid", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.includes("select 1 from positions where code")) return { rows: [] };
    if (sql.startsWith("insert into resource_deployment")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, positionId: "POS-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.positionId);
  assert.equal(body.error.details.employeeId, undefined);
  assert.equal(insertCalled, false);
});

test("POST /v1/resource-deployment with valid employeeId/positionId inserts and resolves both lookups as null from the bare `returning *` row", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.includes("select 1 from positions where code")) return { rows: [{}] };
    if (sql.startsWith("insert into resource_deployment")) {
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, positionId: "POS-001" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.employeeId, 42);
  assert.equal(body.data.positionId, "POS-001");
  // insert's `returning *` never carries the joined lookup columns —
  // toResponse must treat that the same as "no match found" (null).
  assert.equal(body.data.employeeName, null);
  assert.equal(body.data.positionName, null);
});

test("GET /v1/resource-deployment/:id resolves employeeName and positionName via their independent live lookup joins", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where resource_deployment.id = $1")) {
      return {
        rows: [baseRow({ lookup_0_name: "Jane Doe", lookup_1_name: "Consultant" })],
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.employeeName, "Jane Doe");
  assert.equal(body.data.positionName, "Consultant");
});

test("GET /v1/resource-deployment/:id yields employeeName === null and positionName === null independently when each linked row is soft-deleted", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where resource_deployment.id = $1")) {
      // Only the resources-side lookup (lookup_0) is null here — the
      // positions-side lookup (lookup_1) still resolves, proving the two
      // lookups' LEFT JOINs are independent of each other.
      return { rows: [baseRow({ lookup_0_name: null, lookup_1_name: "Consultant" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`);
  const body = await res.json();
  assert.equal(body.data.employeeName, null);
  assert.equal(body.data.positionName, "Consultant");
});

test("GET /v1/resource-deployment (list) orders by employee_id, not the dropped name column — locks in the sortColumn override", async (t) => {
  let listSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("from resource_deployment") && sql.includes("order by")) {
      listSql = sql;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`);
  assert.equal(res.status, 200);
  assert.match(
    listSql,
    /order by \(resource_deployment\.deleted_at is not null\), resource_deployment\.employee_id asc/
  );
  assert.doesNotMatch(listSql, /resource_deployment\.name asc/);
});

test("PATCH /v1/resource-deployment/:id can update positionId without touching employeeId (partial update)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from positions where code")) return { rows: [{}] };
    if (sql.startsWith("select * from resource_deployment where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update resource_deployment set")) {
      return { rows: [baseRow({ position_code: "POS-002" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ positionId: "POS-002" }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.positionId, "POS-002");
  assert.equal(body.data.employeeId, 42);
});

test("PATCH /v1/resource-deployment/:id rejects setting employeeId to a non-existent Resources row (422, no update executed)", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [] };
    if (sql.startsWith("update resource_deployment set")) {
      updateCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query (existing-row lookup/update must not run once validateReferences rejects): ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 999999 }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.employeeId);
  assert.equal(updateCalled, false);
});

test("POST /v1/resource-deployment maps a foreign_key_violation (23503) from the INSERT itself to a 422 naming the right field, distinguishing both constraints", async (t) => {
  // Simulates the narrow race validateReferences can't close: both FK
  // checks pass, then the referenced positions row is removed before the
  // INSERT runs, so Postgres itself rejects it via
  // fk_resource_deployment_positions specifically (not the resources one).
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.includes("select 1 from positions where code")) return { rows: [{}] };
    if (sql.startsWith("insert into resource_deployment")) {
      const err = new Error("insert or update on table violates foreign key constraint");
      err.code = "23503";
      err.constraint = "fk_resource_deployment_positions";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, positionId: "POS-001" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.positionId);
  assert.equal(body.error.details.employeeId, undefined);
});

registerAuthGateTests({
  getBaseUrl: () => baseUrl,
  route: "resource-deployment",
  getId: () => RESOURCE_DEPLOYMENT_ID,
  postBody: { employeeId: 42, positionId: "POS-001" },
  patchBody: { positionId: "POS-002" },
});

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "resource-deployment",
  getId: () => RESOURCE_DEPLOYMENT_ID,
  tableName: "resource_deployment",
  resourceName: "resource_deployment",
});
