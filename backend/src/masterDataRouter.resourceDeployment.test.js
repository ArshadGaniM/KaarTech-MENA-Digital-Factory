import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { allocationSelectSql as allocationSelectSqlFor } from "./masterDataSchema.js";
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
// advisory lock (see withGroupLock in masterDataRouter.js). The client
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
    // The pg driver gives a `date` column as a Date at local midnight, so the stored row does too.
    start_date: new Date(2026, 7, 1),
    end_date: new Date(2027, 2, 31),
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

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "resource-deployment",
  getId: () => RESOURCE_DEPLOYMENT_ID,
  tableName: "resource_deployment",
  resourceName: "resource_deployment",
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
