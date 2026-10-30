import { test, before, after, mock } from "node:test";
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

// Writes run on a pooled client inside a transaction holding a per-resource
// advisory lock (see withAllocationLock in masterDataRouter.js). The client
// here delegates to whatever pool.query mock the current test installed, and
// answers the transaction plumbing and the post-write re-select itself.
let lastWrittenRow = null;
let connectCalls = 0;
let clientStatements = [];

before(async () => {
  ({ server, baseUrl } = await startTestServer(resourceDeploymentTable));
  mock.method(pool, "connect", async () => {
    connectCalls += 1;
    return {
      query: async (sql, params) => {
        clientStatements.push(sql.split(" ")[0]);
        if (/^(begin|commit|rollback)$/i.test(sql) || sql.startsWith("select pg_advisory_xact_lock")) {
          return { rows: [] };
        }
        if (sql.includes("as employee_total_allocation") && sql.includes(".id = $1")) {
          return { rows: [{ ...lastWrittenRow, employee_total_allocation: "100.00" }] };
        }
        const result = await pool.query(sql, params);
        if (/^(insert|update)/.test(sql)) lastWrittenRow = result.rows[0] ?? null;
        return result;
      },
      release: () => {},
    };
  });
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 999999, positionId: "POS-999", allocationPercentage: 100 }),
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, positionId: "POS-999", allocationPercentage: 100 }),
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, positionId: "POS-001", allocationPercentage: 100 }),
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 42, positionId: "POS-001", allocationPercentage: 100 }),
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
  postBody: { employeeId: 42, positionId: "POS-001", allocationPercentage: 100 },
  patchBody: { positionId: "POS-002" },
});

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "resource-deployment",
  getId: () => RESOURCE_DEPLOYMENT_ID,
  tableName: "resource_deployment",
  resourceName: "resource_deployment",
});

// FEAT-21: one resource can be deployed to several positions, each with its
// own allocation percentage; a resource's live rows never exceed 100 in total.
function allocationMock(t, existing, { onWrite } = {}) {
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.startsWith("select 1 from positions where code")) return { rows: [{}] };
    if (sql.startsWith("select position_code as unique_value")) {
      return { rows: existing.map(([position, value]) => ({ unique_value: position, value })) };
    }
    if (sql.startsWith("select * from resource_deployment where id")) return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    if (sql.startsWith("insert into") || sql.startsWith("update")) {
      onWrite?.(sql, params);
      return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
}

function postDeployment(body) {
  return fetch(`${baseUrl}/v1/resource-deployment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify(body),
  });
}

test("POST /v1/resource-deployment accepts a second position that brings the resource to exactly 100", async (t) => {
  let wrote = false;
  allocationMock(t, [["POS-001", "50.00"]], { onWrite: () => (wrote = true) });

  const res = await postDeployment({ employeeId: 42, positionId: "POS-002", allocationPercentage: 50 });

  assert.equal(res.status, 201);
  assert.equal(wrote, true);
  assert.equal((await res.json()).data.allocationPercentage, 50);
});

test("POST /v1/resource-deployment rejects an allocation that would push the resource over 100 and never inserts", async (t) => {
  let wrote = false;
  allocationMock(t, [["POS-001", "70.00"]], { onWrite: () => (wrote = true) });

  const res = await postDeployment({ employeeId: 42, positionId: "POS-002", allocationPercentage: 40 });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /at most 30%/);
  assert.equal(wrote, false);
});

test("POST /v1/resource-deployment rejects the same resource and position twice", async (t) => {
  allocationMock(t, [["POS-001", "50.00"]]);

  const res = await postDeployment({ employeeId: 42, positionId: "POS-001", allocationPercentage: 25 });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.positionId);
});

test("POST /v1/resource-deployment rejects a percentage that is missing, zero, negative or above 100", async (t) => {
  allocationMock(t, []);
  for (const allocationPercentage of [undefined, 0, -5, 100.5]) {
    const res = await postDeployment({ employeeId: 42, positionId: "POS-001", allocationPercentage });
    assert.equal(res.status, 422, String(allocationPercentage));
    assert.ok((await res.json()).error.details.allocationPercentage);
  }
});

test("PATCH /v1/resource-deployment/:id does not count the row being edited against itself", async (t) => {
  allocationMock(t, [["POS-002", "50.00"]]);

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ allocationPercentage: 50 }),
  });

  assert.equal(res.status, 200);
});

test("PATCH /v1/resource-deployment/:id rejects raising the percentage past what the other rows leave", async (t) => {
  allocationMock(t, [["POS-002", "60.00"]]);

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ allocationPercentage: 50 }),
  });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /at most 40%/);
});

test("POST /v1/resource-deployment/:id/restore is refused when the resource has since been allocated elsewhere", async (t) => {
  let wrote = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from resource_deployment where id")) {
      return { rows: [baseRow({ allocation_percentage: "50.00", deleted_at: "2026-02-01T00:00:00Z" })] };
    }
    if (sql.startsWith("select 1 from")) return { rows: [{}] };
    if (sql.startsWith("select position_code as unique_value")) return { rows: [{ unique_value: "POS-002", value: "80.00" }] };
    if (sql.startsWith("update")) wrote = true;
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}/restore`, {
    method: "POST",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.allocationPercentage);
  assert.equal(wrote, false);
});

// Gate findings (FEAT-21): concurrency, rounding, moving a row between
// resources, and the response carrying the resource's total.
test("a write takes the per-resource advisory lock inside one transaction and commits", async (t) => {
  clientStatements = [];
  allocationMock(t, []);

  const res = await postDeployment({ employeeId: 42, positionId: "POS-001", allocationPercentage: 100 });

  assert.equal(res.status, 201);
  assert.deepEqual(clientStatements.slice(0, 2), ["begin", "select"]);
  assert.equal(clientStatements.at(-1), "commit");
  const body = await res.json();
  assert.equal(body.data.employeeTotalAllocation, 100);
});

test("a rejected allocation rolls the transaction back instead of committing", async (t) => {
  clientStatements = [];
  allocationMock(t, [["POS-001", "90.00"]]);

  const res = await postDeployment({ employeeId: 42, positionId: "POS-002", allocationPercentage: 20 });

  assert.equal(res.status, 422);
  assert.equal(clientStatements.at(-1), "rollback");
  assert.ok(!clientStatements.includes("commit"));
});

test("33.33 + 33.33 + 33.34 totals exactly 100 and is accepted; 33.35 is not", async (t) => {
  allocationMock(t, [["POS-001", "33.33"], ["POS-002", "33.33"]]);
  assert.equal((await postDeployment({ employeeId: 42, positionId: "POS-003", allocationPercentage: 33.34 })).status, 201);

  const over = await postDeployment({ employeeId: 42, positionId: "POS-003", allocationPercentage: 33.35 });
  assert.equal(over.status, 422);
  assert.match((await over.json()).error.details.allocationPercentage, /at most 33\.34%/);
});

test("PATCH moving a row to another resource is checked against that resource's rows, not the old one's", async (t) => {
  const groupsQueried = [];
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select 1 from")) return { rows: [{}] };
    if (sql.startsWith("select * from resource_deployment where id")) return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    if (sql.startsWith("select position_code as unique_value")) {
      groupsQueried.push(params[0]);
      return { rows: params[0] === 43 ? [{ unique_value: "POS-009", value: "80.00" }] : [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 43 }),
  });

  assert.equal(res.status, 422);
  assert.deepEqual(groupsQueried, [43]);
  assert.match((await res.json()).error.details.allocationPercentage, /at most 20%/);
});

test("PATCH onto a position another row of the same resource already holds is a 422", async (t) => {
  allocationMock(t, [["POS-002", "10.00"]]);

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ positionId: "POS-002" }),
  });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.positionId);
});

test("restore succeeds when the row's allocation still fits", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from resource_deployment where id")) {
      return { rows: [baseRow({ allocation_percentage: "50.00", deleted_at: "2026-02-01T00:00:00Z" })] };
    }
    if (sql.startsWith("select position_code as unique_value")) return { rows: [{ unique_value: "POS-002", value: "50.00" }] };
    if (sql.startsWith("select 1 from")) return { rows: [{}] };
    if (sql.startsWith("update")) return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}/restore`, {
    method: "POST",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.employeeTotalAllocation, 100);
});
