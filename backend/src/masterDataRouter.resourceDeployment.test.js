import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { allocationSelectSql as allocationSelectSqlFor } from "./masterDataSchema.js";
import {
  startTestServer,
  stopTestServer,
  registerAuthGateTests,
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
// advisory lock (see withGroupLock in masterDataRouter.js). The client
// here delegates to whatever pool.query mock the current test installed, and
// answers the transaction plumbing and the post-write re-select itself.
let lastWrittenRow = null;
let connectCalls = 0;
let clientStatements = [];
let moduleLeadQueries = [];
const noModuleLead = () => ({ rows: [] });
let moduleLeadHandler = noModuleLead;

before(async () => {
  ({ server, baseUrl } = await startTestServer(resourceDeploymentTable));
  mock.method(pool, "connect", async () => {
    connectCalls += 1;
    return {
      query: async (sql, params) => {
        // FEAT-43 Module Lead queries are tagged; by default every position is an ordinary
        // seat and no Module Lead exists, so the older tests see no change in behaviour.
        const tag = /^\/\* module-lead:([a-z-]+) \*\//.exec(sql)?.[1];
        if (tag) {
          moduleLeadQueries.push({ tag, params });
          return moduleLeadHandler(tag, params);
        }
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
    // The pg driver gives a `date` column as a Date at local midnight, so the stored row does too.
    start_date: new Date(2026, 7, 1),
    end_date: new Date(2027, 2, 31),
    allocation_percentage: "100.00",
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
    body: JSON.stringify({ employeeId: 999999, positionId: "POS-999", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" }),
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
    body: JSON.stringify({ employeeId: 42, positionId: "POS-999", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" }),
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
    body: JSON.stringify({ employeeId: 42, positionId: "POS-001", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" }),
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
    body: JSON.stringify({ employeeId: 42, positionId: "POS-001", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" }),
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
  postBody: { employeeId: 42, positionId: "POS-001", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" },
  patchBody: { positionId: "POS-002" },
});

// DELETE runs in a transaction under the employee's lock (FEAT-43), so it first reads the
// row's employee, which the shared registerDeleteTests harness does not mock.
test("DELETE /v1/resource-deployment/:id soft-deletes the row in a transaction and returns 204", async (t) => {
  clientStatements = [];
  let updateSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select employee_id from resource_deployment where id = $1 and deleted_at is null")) {
      return { rows: [{ employee_id: 42 }] };
    }
    if (sql.startsWith("update resource_deployment set deleted_at = now()")) {
      updateSql = sql;
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 204);
  assert.match(updateSql, /where id = \$1 and deleted_at is null/);
  assert.deepEqual(clientStatements.slice(0, 2), ["begin", "select"]);
  assert.equal(clientStatements.at(-1), "commit");
});

test("DELETE /v1/resource-deployment/:id on an already-deleted (or nonexistent) row returns 404 and starts no transaction", async (t) => {
  const before = connectCalls;
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, "resource_deployment_not_found");
  assert.equal(connectCalls, before);
});

// FEAT-21: one resource can be deployed to several positions, each with its
// own allocation percentage; a resource's live rows never exceed 100 in total.
// `existing` rows are [position, value] with the default dates, or [position, value, start, end].
function allocationMock(t, existing, { onWrite } = {}) {
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.startsWith("select 1 from positions where code")) return { rows: [{}] };
    if (sql.startsWith("select position_code as unique_value")) {
      return { rows: existing.map(([position, value, start = "2026-08-01", end = "2027-03-31"]) => ({ unique_value: position, value, start, end })) };
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

  const res = await postDeployment({ employeeId: 42, positionId: "POS-002", allocationPercentage: 50, startDate: "2026-08-01", endDate: "2027-03-31" });

  assert.equal(res.status, 201);
  assert.equal(wrote, true);
  assert.equal((await res.json()).data.allocationPercentage, 50);
});

test("POST /v1/resource-deployment rejects an allocation that would push the resource over 100 and never inserts", async (t) => {
  let wrote = false;
  allocationMock(t, [["POS-001", "70.00"]], { onWrite: () => (wrote = true) });

  const res = await postDeployment({ employeeId: 42, positionId: "POS-002", allocationPercentage: 40, startDate: "2026-08-01", endDate: "2027-03-31" });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /at most 30%/);
  assert.equal(wrote, false);
});

test("POST /v1/resource-deployment rejects the same resource and position twice", async (t) => {
  allocationMock(t, [["POS-001", "50.00"]]);

  const res = await postDeployment({ employeeId: 42, positionId: "POS-001", allocationPercentage: 25, startDate: "2026-08-01", endDate: "2027-03-31" });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.positionId);
});

test("POST /v1/resource-deployment rejects a percentage that is missing, zero, negative or above 100", async (t) => {
  allocationMock(t, []);
  for (const allocationPercentage of [undefined, 0, -5, 100.5]) {
    const res = await postDeployment({ employeeId: 42, positionId: "POS-001", allocationPercentage, startDate: "2026-08-01", endDate: "2027-03-31" });
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [{ unique_value: "POS-002", value: "80.00", start: "2026-08-01", end: "2027-03-31" }] };
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

  const res = await postDeployment({ employeeId: 42, positionId: "POS-001", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" });

  assert.equal(res.status, 201);
  assert.deepEqual(clientStatements.slice(0, 2), ["begin", "select"]);
  assert.equal(clientStatements.at(-1), "commit");
  const body = await res.json();
  assert.equal(body.data.employeeTotalAllocation, 100);
});

test("a rejected allocation rolls the transaction back instead of committing", async (t) => {
  clientStatements = [];
  allocationMock(t, [["POS-001", "90.00"]]);

  const res = await postDeployment({ employeeId: 42, positionId: "POS-002", allocationPercentage: 20, startDate: "2026-08-01", endDate: "2027-03-31" });

  assert.equal(res.status, 422);
  assert.equal(clientStatements.at(-1), "rollback");
  assert.ok(!clientStatements.includes("commit"));
});

test("33.33 + 33.33 + 33.34 totals exactly 100 and is accepted; 33.35 is not", async (t) => {
  allocationMock(t, [["POS-001", "33.33"], ["POS-002", "33.33"]]);
  assert.equal((await postDeployment({ employeeId: 42, positionId: "POS-003", allocationPercentage: 33.34, startDate: "2026-08-01", endDate: "2027-03-31" })).status, 201);

  const over = await postDeployment({ employeeId: 42, positionId: "POS-003", allocationPercentage: 33.35, startDate: "2026-08-01", endDate: "2027-03-31" });
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
      return { rows: params[0] === 43 ? [{ unique_value: "POS-009", value: "80.00", start: "2026-08-01", end: "2027-03-31" }] : [] };
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
    if (sql.startsWith("select position_code as unique_value")) return { rows: [{ unique_value: "POS-002", value: "50.00", start: "2026-08-01", end: "2027-03-31" }] };
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

// Dates (migration 0035): both are required, the end is not before the start, and
// the 100% total and the one-position rule count only rows that share a day.
const dated = (overrides) => ({ employeeId: 42, positionId: "POS-002", allocationPercentage: 50, startDate: "2026-08-01", endDate: "2027-03-31", ...overrides });

test("POST /v1/resource-deployment requires a start date and an end date", async (t) => {
  let wrote = false;
  allocationMock(t, [], { onWrite: () => (wrote = true) });

  const noStart = await postDeployment(dated({ startDate: undefined }));
  const noEnd = await postDeployment(dated({ endDate: undefined }));

  assert.equal(noStart.status, 422);
  assert.ok((await noStart.json()).error.details.startDate);
  assert.equal(noEnd.status, 422);
  assert.ok((await noEnd.json()).error.details.endDate);
  assert.equal(wrote, false);
});

test("POST /v1/resource-deployment rejects a date that is not a real day, and an end before the start", async (t) => {
  allocationMock(t, []);

  const notADay = await postDeployment(dated({ startDate: "2026-02-30" }));
  const backwards = await postDeployment(dated({ startDate: "2027-01-01", endDate: "2026-12-31" }));
  const oneDay = await postDeployment(dated({ startDate: "2026-12-31", endDate: "2026-12-31" }));

  assert.equal(notADay.status, 422);
  assert.ok((await notADay.json()).error.details.startDate);
  assert.equal(backwards.status, 422);
  assert.match((await backwards.json()).error.details.endDate, /not be earlier than startDate/);
  assert.equal(oneDay.status, 201);
});

test("a resource may hold 100% until 31 Dec and another 100% from 1 Jan", async (t) => {
  allocationMock(t, [["POS-001", "100.00", "2026-08-01", "2026-12-31"]]);

  const res = await postDeployment(dated({ allocationPercentage: 100, startDate: "2027-01-01", endDate: "2027-03-31" }));

  assert.equal(res.status, 201);
});

test("100% until 31 Dec and another 100% starting on 31 Dec share a day, so the second is refused", async (t) => {
  allocationMock(t, [["POS-001", "100.00", "2026-08-01", "2026-12-31"]]);

  const res = await postDeployment(dated({ allocationPercentage: 100, startDate: "2026-12-31", endDate: "2027-03-31" }));

  assert.equal(res.status, 422);
  const message = (await res.json()).error.details.allocationPercentage;
  assert.match(message, /on 2026-12-31 100% is already allocated/);
  assert.match(message, /at most 0%/);
});

test("the total is checked on the busiest day of the period, not on the sum of every overlapping row", async (t) => {
  // 60% in Aug to Oct and 60% in Nov to Dec never overlap, so at most 60% is allocated on any day.
  const existing = [["POS-001", "60.00", "2026-08-01", "2026-10-31"], ["POS-003", "60.00", "2026-11-01", "2026-12-31"]];
  allocationMock(t, existing);
  const fits = await postDeployment(dated({ allocationPercentage: 40, startDate: "2026-08-01", endDate: "2026-12-31" }));
  assert.equal(fits.status, 201);

  allocationMock(t, existing);
  const over = await postDeployment(dated({ allocationPercentage: 50, startDate: "2026-08-01", endDate: "2026-12-31" }));
  assert.equal(over.status, 422);
  assert.match((await over.json()).error.details.allocationPercentage, /at most 40%/);
});

test("rows that overlap each other add up on the days they share", async (t) => {
  // 50% from Aug to Oct and 30% from Oct to Dec share October, so 80% is allocated there.
  allocationMock(t, [["POS-001", "50.00", "2026-08-01", "2026-10-31"], ["POS-003", "30.00", "2026-10-01", "2026-12-31"]]);

  const res = await postDeployment(dated({ allocationPercentage: 30, startDate: "2026-09-01", endDate: "2026-11-30" }));

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /on 2026-10-01 80% is already allocated, so at most 20% remains/);
});

test("a row that ends before the new one starts is not counted at all", async (t) => {
  allocationMock(t, [["POS-001", "100.00", "2026-01-01", "2026-07-31"]]);

  const res = await postDeployment(dated({ allocationPercentage: 100 }));

  assert.equal(res.status, 201);
});

test("the same position may be held again later, but not on a shared day", async (t) => {
  allocationMock(t, [["POS-002", "50.00", "2026-08-01", "2026-12-31"]]);
  const later = await postDeployment(dated({ startDate: "2027-01-01", endDate: "2027-03-31" }));
  assert.equal(later.status, 201);

  allocationMock(t, [["POS-002", "50.00", "2026-08-01", "2026-12-31"]]);
  const clash = await postDeployment(dated({ allocationPercentage: 10, startDate: "2026-12-31", endDate: "2027-03-31" }));
  assert.equal(clash.status, 422);
  assert.match((await clash.json()).error.details.positionId, /already allocated to POS-002 on some of these days/);
});

test("the exclusion constraint refusing a shared day in a race is a 422 naming the position, not a 500", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.startsWith("select 1 from positions where code")) return { rows: [{}] };
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    if (sql.startsWith("insert into")) throw Object.assign(new Error("conflicting key value violates exclusion constraint"), { code: "23P01" });
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await postDeployment(dated());

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.positionId, /already holds this position/);
});

test("the list shows each resource's total from the rows deployed today only", () => {
  const sql = allocationSelectSqlFor(resourceDeploymentTable).join(" ");

  assert.match(sql, /a\.start_date <= current_date and a\.end_date >= current_date/);
  assert.match(sql, /a\.deleted_at is null/);
});

// A stored row read back for PATCH or restore carries its dates as Date objects.
const patchDeployment = (body) =>
  fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify(body),
  });

test("PATCH of only the percentage still checks the stored dates: another row on the same days leaves too little", async (t) => {
  // The stored row runs 2026-08-01 to 2027-03-31 (as Dates). Another row holds 60% on the same days.
  allocationMock(t, [["POS-002", "60.00", "2026-08-01", "2027-03-31"]]);

  const res = await patchDeployment({ allocationPercentage: 50 });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /on 2026-08-01 60% is already allocated, so at most 40% remains/);
});

test("PATCH of only the percentage ignores another row that does not share a day with the stored dates", async (t) => {
  allocationMock(t, [["POS-002", "60.00", "2025-01-01", "2026-07-31"]]);

  const res = await patchDeployment({ allocationPercentage: 100 });

  assert.equal(res.status, 200);
});

test("PATCH that moves only the start date earlier is checked against the rows it now overlaps", async (t) => {
  allocationMock(t, [["POS-003", "60.00", "2026-02-01", "2026-05-31"]]);

  const clash = await patchDeployment({ startDate: "2026-01-01", allocationPercentage: 50 });
  assert.equal(clash.status, 422);
  assert.match((await clash.json()).error.details.allocationPercentage, /on 2026-02-01 60% is already allocated/);

  allocationMock(t, [["POS-003", "60.00", "2026-02-01", "2026-05-31"]]);
  const clear = await patchDeployment({ startDate: "2026-06-01", allocationPercentage: 50 });
  assert.equal(clear.status, 200);
});

test("PATCH of only the end date earlier than the stored start date is a 422 on endDate", async (t) => {
  allocationMock(t, []);

  const res = await patchDeployment({ endDate: "2026-07-01" });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.endDate, /not be earlier than startDate/);
});

test("PATCH leaves the row being edited out of its own check", async (t) => {
  const seen = [];
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select 1 from")) return { rows: [{}] };
    if (sql.startsWith("select * from resource_deployment where id")) return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    if (sql.startsWith("select position_code as unique_value")) {
      seen.push(params);
      return { rows: [] };
    }
    if (sql.startsWith("update")) return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    throw new Error(`unexpected query: ${sql}`);
  });

  await patchDeployment({ allocationPercentage: 50 });

  assert.deepEqual(seen, [[42, RESOURCE_DEPLOYMENT_ID]]);
});

test("restore is refused when the stored dates now overlap another row that leaves too little", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from resource_deployment where id")) {
      return { rows: [baseRow({ allocation_percentage: "50.00", deleted_at: new Date(2026, 1, 1) })] };
    }
    if (sql.startsWith("select 1 from")) return { rows: [{}] };
    if (sql.startsWith("select position_code as unique_value")) {
      return { rows: [{ unique_value: "POS-002", value: "70.00", start: "2027-03-31", end: "2027-06-30" }] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}/restore`, {
    method: "POST",
    headers: { "x-internal-api-key": "test-secret" },
  });

  // The other row shares only 2027-03-31, the stored last day, and is still counted there.
  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /on 2027-03-31 70% is already allocated/);
});

test("validateAllocation refuses to run without both dates, rather than passing by default", async () => {
  const { validateAllocation } = await import("./masterDataSchema.js");
  const db = { query: async () => ({ rows: [] }) };

  await assert.rejects(() => validateAllocation(db, resourceDeploymentTable, { employee_id: 42, position_code: "POS-001", allocation_percentage: 50, start_date: null, end_date: null }), /needs start_date and end_date/);
});

// Only ISO dates are accepted: Date.parse also takes "01/05/2027", which Postgres reads as a real day
// but the allocation check, which compares days as text, would misjudge and skip the 100% cap.
test("POST /v1/resource-deployment refuses a date that is not ISO, and never inserts", async (t) => {
  let wrote = false;
  allocationMock(t, [["POS-001", "100.00", "2026-08-01", "2027-03-31"]], { onWrite: () => (wrote = true) });

  for (const bad of ["01/05/2027", "Jan 1 2027", "1 Jan 2027", "2027/01/05", "2027-1-5", " 2027-01-05", "2027-01-05 ", "20270105", "2027-01-05T10:00:00+16:00", "2027-01-05T10:00:00-23:59"]) {
    const start = await postDeployment(dated({ allocationPercentage: 100, startDate: bad, endDate: "2027-02-05" }));
    assert.equal(start.status, 422, `startDate ${JSON.stringify(bad)}`);
    assert.ok((await start.json()).error.details.startDate, bad);
    const end = await postDeployment(dated({ allocationPercentage: 100, startDate: "2027-01-05", endDate: bad }));
    assert.equal(end.status, 422, `endDate ${JSON.stringify(bad)}`);
    assert.ok((await end.json()).error.details.endDate, bad);
  }
  assert.equal(wrote, false);
});

test("POST /v1/resource-deployment still takes an ISO datetime, and counts it by its day", async (t) => {
  allocationMock(t, [["POS-001", "100.00", "2026-08-01", "2027-03-31"]]);

  const clash = await postDeployment(dated({ allocationPercentage: 100, startDate: "2027-01-05T00:00:00.000Z", endDate: "2027-02-05T00:00:00Z" }));
  assert.equal(clash.status, 422);
  assert.match((await clash.json()).error.details.allocationPercentage, /on 2027-01-05 100% is already allocated/);

  allocationMock(t, [["POS-001", "100.00", "2026-08-01", "2027-03-31"]]);
  const clear = await postDeployment(dated({ allocationPercentage: 100, startDate: "2027-04-01T00:00:00Z", endDate: "2027-05-01T00:00:00+03:00" }));
  assert.equal(clear.status, 201);
});

test("PATCH /v1/resource-deployment refuses a date that is not ISO", async (t) => {
  allocationMock(t, [["POS-003", "100.00", "2026-08-01", "2027-03-31"]]);

  const res = await patchDeployment({ startDate: "01/05/2027" });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.startDate);
});

test("a stored date is read by its local day in any time zone, not shifted by UTC", async () => {
  const { validateAllocation } = await import("./masterDataSchema.js");
  const rule = resourceDeploymentTable.allocationRule;
  // The other row ends the day before the stored start (2026-08-01). In a zone ahead of UTC a
  // toISOString-style day would read that start as 2026-07-31 and wrongly count the two as sharing a day.
  const db = { query: async () => ({ rows: [{ unique_value: "POS-009", value: "100.00", start: "2026-01-01", end: "2026-07-31" }] }) };
  const candidate = { employee_id: 42, position_code: "POS-001", allocation_percentage: 100, start_date: new Date(2026, 7, 1), end_date: new Date(2027, 2, 31) };
  const previous = process.env.TZ;
  try {
    for (const zone of ["Asia/Dubai", "Asia/Kolkata", "America/Los_Angeles", "UTC"]) {
      process.env.TZ = zone;
      const day = new Date(2026, 7, 1);
      assert.equal(day.getDate(), 1, zone);
      await validateAllocation(db, { tableName: "resource_deployment", allocationRule: rule }, { ...candidate, start_date: new Date(2026, 7, 1), end_date: new Date(2027, 2, 31) });
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("validateAllocation refuses a date that is not ISO instead of comparing it as text", async () => {
  const { validateAllocation } = await import("./masterDataSchema.js");
  const db = { query: async () => ({ rows: [] }) };
  const candidate = { employee_id: 42, position_code: "POS-001", allocation_percentage: 50, start_date: "01/05/2027", end_date: "2027-02-05" };

  await assert.rejects(() => validateAllocation(db, resourceDeploymentTable, candidate), /needs ISO dates/);
});

test("a one-day deployment is never refused as backwards, in any server time zone", async (t) => {
  const previous = process.env.TZ;
  try {
    for (const zone of ["UTC", "America/New_York", "Pacific/Auckland", "Asia/Dubai"]) {
      process.env.TZ = zone;
      // The stored row runs 1 Aug to 31 Mar (as local-midnight Dates). Ending it on its first day is allowed.
      allocationMock(t, []);
      const res = await patchDeployment({ endDate: "2026-08-01" });
      assert.equal(res.status, 200, zone);
      // Ending it the day before its start is not.
      allocationMock(t, []);
      const before = await patchDeployment({ endDate: "2026-07-31" });
      assert.equal(before.status, 422, zone);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

// FEAT-43: automatic Module Lead allocation. The Module Lead queries are tagged and answered by
// `moduleLeadHandler`; the pure maths is tested in moduleLeadAllocation.test.js.
const TODAY = "2026-10-01";
const ML_SEAT = { code: "POS-ML1", name: "Module Lead - FI", team_code: "TEAM-01" };
const PLAIN_SEAT = { code: "POS-001", name: "Consultant", team_code: "TEAM-01" };
const leadRow = (id, teamCode, positionCode, pct = "0.00") => ({
  id, employee_id: 7, position_code: positionCode, team_code: teamCode, allocation_percentage: pct, start: "2026-08-01", end: "2027-03-31", today: TODAY,
});
const filledSeat = (teamCode) => ({ team_code: teamCode, start: "2026-08-01", end: "2027-03-31" });
const ROW_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ROW_B = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function moduleLeadMock(t, { seats = [], conflict = null, leadRows = [], seatRows = [], teamLeads = [] } = {}) {
  const updates = [];
  moduleLeadQueries = [];
  moduleLeadHandler = (tag, params) => {
    if (tag === "seat") return { rows: seats.filter((seat) => seat.code === params[0]) };
    if (tag === "exclusive") return { rows: conflict ? [conflict] : [] };
    if (tag === "rows") return { rows: leadRows };
    if (tag === "seats") return { rows: seatRows };
    if (tag === "team-leads") return { rows: teamLeads.map((id) => ({ employee_id: id })) };
    if (tag === "update") updates.push(params);
    return { rows: [] };
  };
  t.after(() => {
    moduleLeadHandler = noModuleLead;
  });
  return updates;
}

const queriesTagged = (tag) => moduleLeadQueries.filter((query) => query.tag === tag);
const leadBody = (overrides = {}) => ({ employeeId: 7, positionId: "POS-ML1", startDate: "2026-08-01", endDate: "2027-03-31", ...overrides });

test("a Module Lead row ignores the percentage sent: it is stored as 0 and then set by the server", async (t) => {
  const updates = moduleLeadMock(t, { seats: [ML_SEAT], leadRows: [leadRow(ROW_A, "TEAM-01", "POS-ML1")], seatRows: [filledSeat("TEAM-01"), filledSeat("TEAM-01")] });
  const inserted = [];
  allocationMock(t, [], { onWrite: (sql, params) => sql.startsWith("insert") && inserted.push(params) });

  const res = await postDeployment(leadBody({ allocationPercentage: 77 }));

  assert.equal(res.status, 201);
  assert.equal(inserted[0][2], 0);
  assert.deepEqual(updates, [[[ROW_A], [100], "Arshad Gani"]]);
});

test("a Module Lead row needs no percentage, and 0 is accepted for it", async (t) => {
  moduleLeadMock(t, { seats: [ML_SEAT] });
  allocationMock(t, []);

  assert.equal((await postDeployment(leadBody())).status, 201);
  assert.equal((await postDeployment(leadBody({ allocationPercentage: 0 }))).status, 201);
});

test("every other position still needs a percentage of at least 0.01", async (t) => {
  moduleLeadMock(t, { seats: [PLAIN_SEAT] });
  let wrote = false;
  allocationMock(t, [], { onWrite: () => (wrote = true) });

  for (const allocationPercentage of [undefined, 0, 0.005]) {
    const res = await postDeployment(leadBody({ positionId: "POS-001", allocationPercentage }));
    assert.equal(res.status, 422, String(allocationPercentage));
    assert.ok((await res.json()).error.details.allocationPercentage);
  }
  assert.equal((await postDeployment(leadBody({ positionId: "POS-001", allocationPercentage: 0.01 }))).status, 201);
  assert.equal(wrote, true);
});

test("a write on an ordinary seat recalculates the Module Lead rows of its team and of every team those leads cover", async (t) => {
  const updates = moduleLeadMock(t, {
    seats: [PLAIN_SEAT],
    teamLeads: [7],
    leadRows: [leadRow(ROW_A, "TEAM-01", "POS-ML1", "50.00"), leadRow(ROW_B, "TEAM-02", "POS-ML2", "50.00")],
    seatRows: [filledSeat("TEAM-01"), filledSeat("TEAM-02"), filledSeat("TEAM-02")],
  });
  allocationMock(t, []);

  const res = await postDeployment({ employeeId: 99, positionId: "POS-001", allocationPercentage: 100, startDate: "2026-08-01", endDate: "2027-03-31" });

  assert.equal(res.status, 201);
  assert.deepEqual(queriesTagged("team-leads")[0].params, [["TEAM-01"]]);
  assert.deepEqual(queriesTagged("rows")[0].params, [[7]]);
  // 1 of 3 seats and 2 of 3: 33.33 + 66.66 leaves 0.01, which goes to the team with fewer seats.
  assert.deepEqual(updates, [[[ROW_A, ROW_B], [33.34, 66.66], "Arshad Gani"]]);
});

test("a Module Lead cannot take a seat on a day the person already holds another one", async (t) => {
  moduleLeadMock(t, { seats: [ML_SEAT], conflict: { position_code: "POS-001", name: "Consultant", start: "2026-08-01", end: "2027-03-31" } });
  let wrote = false;
  allocationMock(t, [], { onWrite: () => (wrote = true) });

  const res = await postDeployment(leadBody());

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.employeeId, /A Module Lead cannot hold other seats/);
  assert.equal(queriesTagged("exclusive")[0].params[4], true);
  assert.equal(wrote, false);
});

test("a person who is a Module Lead cannot take an ordinary seat on a shared day", async (t) => {
  moduleLeadMock(t, { seats: [PLAIN_SEAT], conflict: { position_code: "POS-ML1", name: "Module Lead - FI", start: "2026-08-01", end: "2027-03-31" } });
  let wrote = false;
  allocationMock(t, [], { onWrite: () => (wrote = true) });

  const res = await postDeployment(leadBody({ positionId: "POS-001", allocationPercentage: 50 }));

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.employeeId, /is a Module Lead/);
  assert.equal(queriesTagged("exclusive")[0].params[4], false);
  assert.equal(wrote, false);
});

test("PATCH of a Module Lead row ignores the percentage sent and keeps the stored one until the recalculation", async (t) => {
  const updates = moduleLeadMock(t, { seats: [ML_SEAT], leadRows: [leadRow(ROW_A, "TEAM-01", "POS-ML1", "40.00")], seatRows: [filledSeat("TEAM-01")] });
  const written = [];
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select * from resource_deployment where id")) return { rows: [baseRow({ position_code: "POS-ML1", allocation_percentage: "40.00" })] };
    if (sql.startsWith("update resource_deployment set")) {
      written.push(params);
      return { rows: [baseRow({ position_code: "POS-ML1" })] };
    }
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ allocationPercentage: 12 }),
  });

  assert.equal(res.status, 200);
  assert.equal(written[0][2], 40);
  assert.deepEqual(updates, [[[ROW_A], [100], "Arshad Gani"]]);
});

test("PATCH moving a Module Lead row to another person recalculates both people", async (t) => {
  moduleLeadMock(t, { seats: [ML_SEAT] });
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select 1 from resources where employee_id")) return { rows: [{}] };
    if (sql.startsWith("select * from resource_deployment where id")) return { rows: [baseRow({ position_code: "POS-ML1", allocation_percentage: "40.00" })] };
    if (sql.startsWith("update resource_deployment set")) return { rows: [baseRow({ employee_id: 8, position_code: "POS-ML1" })] };
    if (sql.startsWith("select position_code as unique_value")) return { rows: [] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ employeeId: 8 }),
  });

  assert.equal(res.status, 200);
  assert.deepEqual(queriesTagged("rows")[0].params, [[8, 42]]);
});

test("DELETE of an ordinary seat recalculates its team's Module Lead rows in the same transaction", async (t) => {
  clientStatements = [];
  const updates = moduleLeadMock(t, {
    seats: [PLAIN_SEAT],
    teamLeads: [7],
    leadRows: [leadRow(ROW_A, "TEAM-01", "POS-ML1", "100.00")],
    seatRows: [],
  });
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select employee_id from resource_deployment where id")) return { rows: [{ employee_id: 42 }] };
    if (sql.startsWith("update resource_deployment set deleted_at = now()")) return { rows: [baseRow({ position_code: "POS-001" })] };
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}`, {
    method: "DELETE",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 204);
  // The team has no filled seat left, so its lead drops to 0 (not an equal split).
  assert.deepEqual(updates, [[[ROW_A], [0], "Module Lead auto-allocation"]]);
  assert.equal(clientStatements.at(-1), "commit");
});

test("restore of a Module Lead row is refused while the person holds another seat on a shared day", async (t) => {
  moduleLeadMock(t, { seats: [ML_SEAT], conflict: { position_code: "POS-001", name: "Consultant", start: "2026-08-01", end: "2027-03-31" } });
  let wrote = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from resource_deployment where id")) {
      return { rows: [baseRow({ position_code: "POS-ML1", deleted_at: new Date() })] };
    }
    if (sql.startsWith("select 1 from")) return { rows: [{}] };
    if (sql.startsWith("update")) {
      wrote = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/resource-deployment/${RESOURCE_DEPLOYMENT_ID}/restore`, {
    method: "POST",
    headers: { "x-internal-api-key": "test-secret" },
  });

  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.employeeId);
  assert.equal(wrote, false);
});

test("recalculateAllModuleLeads recomputes every lead, one transaction each, and reports the count", async () => {
  const { recalculateAllModuleLeads } = await import("./moduleLeadAllocation.js");
  const statements = [];
  const client = {
    query: async (sql) => {
      const tag = /^\/\* module-lead:([a-z-]+) \*\//.exec(sql)?.[1];
      statements.push(tag ?? sql.split(" ")[0]);
      if (tag === "rows") return { rows: [leadRow(ROW_A, "TEAM-01", "POS-ML1", "0.00")] };
      if (tag === "seats") return { rows: [filledSeat("TEAM-01")] };
      return { rows: [] };
    },
    release: () => {},
  };
  const db = {
    query: async () => ({ rows: [{ employee_id: 7 }, { employee_id: 8 }] }),
    connect: async () => client,
  };

  const out = await recalculateAllModuleLeads(db);

  assert.deepEqual(out, { employees: 2, updated: 2 });
  assert.equal(statements.filter((s) => s === "begin").length, 2);
  assert.equal(statements.filter((s) => s === "commit").length, 2);
});
