import { test, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import {
  startTestServer,
  stopTestServer,
  registerAuthGateTests,
  registerDeleteTests,
} from "./masterDataRouter.testHelpers.js";

// Integration tests for FEAT-11 (Project Assignments): the first table
// exercising TWO new generic framework capabilities beyond what FEAT-5
// built — a chained/transitive lookup (departmentId/departmentName come
// from the linked Team's own department_code, not a column on this table
// at all — Project Assignments -> Teams -> Departments) and cross-field
// validation (projectAssignmentEndDate must not be earlier than
// projectAssignmentStartDate). Otherwise mirrors
// masterDataRouter.resourceDeployment.test.js's structure (two concurrent
// `references` fields).

const projectAssignmentsTable = MASTER_DATA_TABLES.find((t) => t.route === "project-assignments");
const ASSIGNMENT_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";

let server;
let baseUrl;

// Writes run on a pooled client inside a transaction holding a per-team
// advisory lock (withGroupLock in masterDataRouter.js). The client answers
// the transaction plumbing and the allocation lookup itself (`otherRows`, the
// team's other live assignments, recording the parameters it was asked with) and delegates every other
// statement to whatever pool.query mock the current test installed.
let otherRows = [];
let otherParams = null;
let clientStatements = [];
let lastWrittenRow = null;

before(async () => {
  ({ server, baseUrl } = await startTestServer(projectAssignmentsTable));
  mock.method(pool, "connect", async () => ({
    query: async (sql, params) => {
      clientStatements.push(sql.split(" ")[0]);
      if (/^(begin|commit|rollback)$/i.test(sql) || sql.startsWith("select pg_advisory_xact_lock")) return { rows: [] };
      if (sql.includes("allocation_percentage as value")) {
        otherParams = params;
        return { rows: otherRows };
      }
      // The router re-reads a written row to add the team's total; answer from the row just written.
      if (sql.includes("as employee_total_allocation") && sql.includes(".id = $1")) {
        return { rows: [{ ...lastWrittenRow, employee_total_allocation: "100.00" }] };
      }
      const result = await pool.query(sql, params);
      if (/^(insert into|update) /.test(sql) && result.rows[0]) lastWrittenRow = result.rows[0];
      return result;
    },
    release: () => {},
  }));
});

afterEach(() => {
  otherRows = [];
  otherParams = null;
  clientStatements = [];
});

after(async () => {
  await stopTestServer(server);
});

function baseRow(overrides = {}) {
  return {
    id: ASSIGNMENT_ID,
    project_id: "PRJ-1001",
    team_code: "TEAM-001",
    project_assignment_start_date: "2026-01-01",
    project_assignment_end_date: "2026-06-30",
    allocation_percentage: "100.00",
    created_by: "Arshad Gani",
    created_at: "2026-01-01T00:00:00Z",
    updated_by: "Arshad Gani",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

const VALID_BODY = {
  projectId: "PRJ-1001",
  teamId: "TEAM-001",
  projectAssignmentStartDate: "2026-01-01",
  projectAssignmentEndDate: "2026-06-30",
};

test("POST /v1/project-assignments rejects a non-existent projectId AND teamId together in one 422, and never inserts", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [] };
    if (sql.includes("select 1 from teams where code")) return { rows: [] };
    if (sql.startsWith("insert into project_assignments")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ ...VALID_BODY, projectId: "PRJ-999", teamId: "TEAM-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.projectId);
  assert.ok(body.error.details.teamId);
  assert.equal(insertCalled, false);
});

test("POST /v1/project-assignments rejects an end date earlier than the start date, distinct from the FK checks", async (t) => {
  let insertCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      insertCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({
      ...VALID_BODY,
      projectAssignmentStartDate: "2026-06-30",
      projectAssignmentEndDate: "2026-01-01",
    }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.projectAssignmentEndDate);
  assert.equal(insertCalled, false);
});

test("POST /v1/project-assignments with equal start/end dates is accepted (not-earlier-than allows equal)", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      return { rows: [baseRow({ project_assignment_end_date: "2026-01-01" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({
      ...VALID_BODY,
      projectAssignmentStartDate: "2026-01-01",
      projectAssignmentEndDate: "2026-01-01",
    }),
  });

  assert.equal(res.status, 201);
});

test("POST /v1/project-assignments with valid FKs and dates inserts and resolves all lookups as null from the bare `returning *` row", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify(VALID_BODY),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.projectId, "PRJ-1001");
  assert.equal(body.data.teamId, "TEAM-001");
  assert.equal(body.data.projectName, null);
  assert.equal(body.data.teamName, null);
  assert.equal(body.data.departmentId, null);
  assert.equal(body.data.departmentName, null);
});

test("GET /v1/project-assignments/:id resolves departmentId/departmentName via the CHAINED lookup through teams, independently of the direct projects/teams lookups", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where project_assignments.id = $1")) {
      return {
        rows: [
          baseRow({
            lookup_0_project_name: "Digital Factory Rollout",
            lookup_0_project_profit_center_code: "PC-500",
            lookup_1_name: "Platform Team",
            lookup_2_code: "DEPT-001",
            lookup_2_name: "Engineering",
          }),
        ],
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.projectName, "Digital Factory Rollout");
  assert.equal(body.data.projectProfitCenterCode, "PC-500");
  assert.equal(body.data.teamName, "Platform Team");
  // The chained lookup's own values — resolved from `departments` via a
  // join off the `teams` lookup's alias, not a direct project_assignments
  // column.
  assert.equal(body.data.departmentId, "DEPT-001");
  assert.equal(body.data.departmentName, "Engineering");
});

test("GET /v1/project-assignments/:id yields departmentId/departmentName === null when the linked team has no department (chained lookup finds nothing downstream), while teamName still resolves", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("where project_assignments.id = $1")) {
      return {
        rows: [
          baseRow({
            lookup_1_name: "Platform Team",
            lookup_2_code: null,
            lookup_2_name: null,
          }),
        ],
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`);
  const body = await res.json();
  assert.equal(body.data.teamName, "Platform Team");
  assert.equal(body.data.departmentId, null);
  assert.equal(body.data.departmentName, null);
});

test("GET /v1/project-assignments (list) generates a JOIN chain through both teams and departments — the chained lookup's SQL actually references the teams alias, not the base table", async (t) => {
  let joinSql;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select count(*)")) return { rows: [{ total: 0 }] };
    if (sql.includes("from project_assignments")) {
      joinSql = sql;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`);
  assert.equal(res.status, 200);
  // departments (lookup_2) joins on lookup_1.department_code (the teams
  // alias), not project_assignments.department_code — this table has no
  // such column, proving the chain is real, not a same-table lookalike.
  assert.match(joinSql, /left join departments lookup_2 on lookup_2\.code = lookup_1\.department_code/);
  assert.match(joinSql, /left join teams lookup_1 on lookup_1\.code = project_assignments\.team_code/);
  assert.match(joinSql, /order by \(project_assignments\.deleted_at is not null\), project_assignments\.project_id asc/);
});

test("PATCH /v1/project-assignments/:id extending the end date past the CURRENT start date (not resent) succeeds — cross-field check uses the stored value", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from project_assignments where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update project_assignments set")) {
      return { rows: [baseRow({ project_assignment_end_date: "2026-12-31" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ projectAssignmentEndDate: "2026-12-31" }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.data.projectAssignmentEndDate, "2026-12-31");
});

test("PATCH /v1/project-assignments/:id rejects moving the start date past the CURRENT (not resent) end date, and never updates", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from project_assignments where id")) {
      // Existing row's end date is 2026-06-30 (from baseRow()) — the PATCH
      // only sends a new start date, later than that stored end date.
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update project_assignments set")) {
      updateCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ projectAssignmentStartDate: "2026-07-01" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.projectAssignmentEndDate);
  assert.equal(updateCalled, false);
});

test("PATCH /v1/project-assignments/:id rejects setting teamId to a non-existent Teams row (422, no update executed)", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from teams where code")) return { rows: [] };
    if (sql.startsWith("select * from project_assignments where id")) {
      return { rows: [baseRow()] };
    }
    if (sql.startsWith("update project_assignments set")) {
      updateCalled = true;
      return { rows: [] };
    }
    throw new Error(`unexpected query (existing-row lookup/update must not run once validateReferences rejects): ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ teamId: "TEAM-999" }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.teamId);
  assert.equal(updateCalled, false);
});

test("POST /v1/project-assignments maps a foreign_key_violation (23503) from the INSERT itself to a 422 naming the right field, distinguishing both constraints", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      const err = new Error("insert or update on table violates foreign key constraint");
      err.code = "23503";
      err.constraint = "fk_project_assignments_teams";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify(VALID_BODY),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.teamId);
  assert.equal(body.error.details.projectId, undefined);
});

test("POST /v1/project-assignments maps a foreign_key_violation (23503) naming projectId when the OTHER constraint fires, proving the mapping isn't hardcoded to teamId", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      const err = new Error("insert or update on table violates foreign key constraint");
      err.code = "23503";
      err.constraint = "fk_project_assignments_projects";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify(VALID_BODY),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.ok(body.error.details.projectId);
  assert.equal(body.error.details.teamId, undefined);
});

registerAuthGateTests({
  getBaseUrl: () => baseUrl,
  route: "project-assignments",
  getId: () => ASSIGNMENT_ID,
  postBody: VALID_BODY,
  patchBody: { projectAssignmentEndDate: "2026-12-31" },
});

registerDeleteTests({
  getBaseUrl: () => baseUrl,
  route: "project-assignments",
  getId: () => ASSIGNMENT_ID,
  tableName: "project_assignments",
  resourceName: "project_assignment",
});

const writeHeaders = { "Content-Type": "application/json", "x-internal-api-key": "test-secret" };

// What the team's other live assignments look like to the allocation check.
const other = (overrides = {}) => ({ unique_value: "PRJ-2002", value: "100.00", start: "2026-09-01", end: "2026-12-05", ...overrides });

function mockWrites(t, { insertParams } = {}) {
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      insertParams?.push(params);
      return { rows: [baseRow()] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
}

test("POST /v1/project-assignments is 422 when the team's shares on a shared day would pass 100, says how much is left, and never inserts", async (t) => {
  otherRows = [other({ value: "50.00", start: "2026-11-01", end: "2026-12-31" })];
  const insertParams = [];
  mockWrites(t, { insertParams });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: writeHeaders,
    body: JSON.stringify({ ...VALID_BODY, projectAssignmentStartDate: "2026-12-01", projectAssignmentEndDate: "2027-01-31", allocationPercentage: 60 }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error.details.allocationPercentage, /cannot exceed 100% on any day: on 2026-12-01 50% is already allocated, so at most 50% remains/);
  assert.equal(insertParams.length, 0);
  assert.ok(clientStatements.includes("rollback"));
  // Asked about this team, leaving no row out.
  assert.deepEqual(otherParams, ["TEAM-001", null]);
});

test("POST /v1/project-assignments lets four projects of 25% share a team on the same days", async (t) => {
  otherRows = ["PRJ-2001", "PRJ-2002", "PRJ-2003"].map((unique_value) => other({ unique_value, value: "25.00" }));
  const insertParams = [];
  mockWrites(t, { insertParams });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: writeHeaders,
    body: JSON.stringify({ ...VALID_BODY, projectAssignmentStartDate: "2026-10-01", projectAssignmentEndDate: "2026-12-31", allocationPercentage: 25 }),
  });

  assert.equal(res.status, 201);
  assert.ok(clientStatements.includes("commit"));
  assert.equal(insertParams[0].at(4), 25);
});

test("POST /v1/project-assignments leaves the shares of days that do not overlap out of the sum", async (t) => {
  otherRows = [other({ value: "100.00", start: "2026-09-01", end: "2026-12-05" })];
  mockWrites(t);

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: writeHeaders,
    body: JSON.stringify({ ...VALID_BODY, projectAssignmentStartDate: "2026-12-06", projectAssignmentEndDate: "2027-01-31" }),
  });

  assert.equal(res.status, 201);
  assert.ok(clientStatements.includes("commit"));
});

test("POST /v1/project-assignments stores 100 when allocationPercentage is left out, so a client from before it existed still works", async (t) => {
  const insertParams = [];
  mockWrites(t, { insertParams });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, { method: "POST", headers: writeHeaders, body: JSON.stringify(VALID_BODY) });

  assert.equal(res.status, 201);
  assert.equal(insertParams[0].at(4), 100);
  const { data } = await res.json();
  assert.equal(data.allocationPercentage, 100);
});

test("POST /v1/project-assignments is 422 when the same project is already on the team on a shared day", async (t) => {
  otherRows = [other({ unique_value: "PRJ-1001", value: "25.00", start: "2026-06-01", end: "2026-09-30" })];
  mockWrites(t);

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: writeHeaders,
    body: JSON.stringify({ ...VALID_BODY, projectAssignmentStartDate: "2026-09-01", projectAssignmentEndDate: "2026-12-31", allocationPercentage: 25 }),
  });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.projectId, /already allocated to PRJ-1001 on some of these days/);
});

test("POST /v1/project-assignments is 422 for an allocationPercentage of 0 or above 100", async (t) => {
  mockWrites(t);
  for (const allocationPercentage of [0, 100.01, -5]) {
    const res = await fetch(`${baseUrl}/v1/project-assignments`, { method: "POST", headers: writeHeaders, body: JSON.stringify({ ...VALID_BODY, allocationPercentage }) });
    assert.equal(res.status, 422, String(allocationPercentage));
    assert.ok((await res.json()).error.details.allocationPercentage);
  }
});

test("PATCH /v1/project-assignments/:id checks the merged share and dates against the team's other assignments, leaving itself out", async (t) => {
  otherRows = [other({ value: "75.00", start: "2026-03-01", end: "2026-04-30" })];
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from project_assignments where id")) return { rows: [baseRow()] };
    if (sql.startsWith("update project_assignments")) updateCalled = true;
    return { rows: [baseRow()] };
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`, {
    method: "PATCH",
    headers: writeHeaders,
    body: JSON.stringify({ allocationPercentage: 30 }),
  });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /at most 25% remains/);
  assert.equal(updateCalled, false);
  assert.deepEqual(otherParams, ["TEAM-001", ASSIGNMENT_ID]);
});

test("PATCH /v1/project-assignments/:id changes only the share when the others leave room", async (t) => {
  otherRows = [other({ value: "50.00", start: "2026-03-01", end: "2026-04-30" })];
  const updateParams = [];
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select * from project_assignments where id")) return { rows: [baseRow()] };
    if (sql.startsWith("update project_assignments")) {
      updateParams.push(params);
      return { rows: [baseRow({ allocation_percentage: "50.00" })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`, {
    method: "PATCH",
    headers: writeHeaders,
    body: JSON.stringify({ allocationPercentage: 50 }),
  });

  assert.equal(res.status, 200);
  assert.equal(updateParams[0].at(4), 50);
  assert.equal((await res.json()).data.allocationPercentage, 50);
});

test("POST /v1/project-assignments/:id/restore is 422 when the restored share now passes 100, and never restores", async (t) => {
  otherRows = [other({ value: "40.00", start: "2026-03-01", end: "2026-04-30" })];
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from project_assignments where id")) {
      return { rows: [baseRow({ deleted_at: "2026-02-01T00:00:00Z" })] };
    }
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("update project_assignments")) updateCalled = true;
    return { rows: [baseRow()] };
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}/restore`, { method: "POST", headers: writeHeaders });

  assert.equal(res.status, 422);
  assert.equal(updateCalled, false);
});

test("POST /v1/project-assignments maps a database exclusion violation (a race past the check) to a 422 naming the project, not a 500", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.includes("select 1 from projects where project_id")) return { rows: [{}] };
    if (sql.includes("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("insert into project_assignments")) {
      throw Object.assign(new Error("conflicting key value violates exclusion constraint"), { code: "23P01" });
    }
    return { rows: [] };
  });

  const res = await fetch(`${baseUrl}/v1/project-assignments`, { method: "POST", headers: writeHeaders, body: JSON.stringify(VALID_BODY) });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.projectId, /already holds this project/);
});

test("PATCH /v1/project-assignments/:id is 422, not a 500 from the NOT NULL column, when allocationPercentage is null or has too many decimals", async (t) => {
  let updateCalled = false;
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("select * from project_assignments where id")) return { rows: [baseRow()] };
    if (sql.startsWith("update project_assignments")) updateCalled = true;
    return { rows: [baseRow()] };
  });
  for (const allocationPercentage of [null, 33.333, 0, 100.01]) {
    const res = await fetch(`${baseUrl}/v1/project-assignments/${ASSIGNMENT_ID}`, { method: "PATCH", headers: writeHeaders, body: JSON.stringify({ allocationPercentage }) });
    assert.equal(res.status, 422, String(allocationPercentage));
    assert.ok((await res.json()).error.details.allocationPercentage);
  }
  assert.equal(updateCalled, false);
});

test("POST /v1/project-assignments finds the day two other projects stack up: 60% from 1 Nov and 50% from 15 Nov leave nothing for a 30% from 1 Nov", async (t) => {
  otherRows = [other({ unique_value: "PRJ-2001", value: "60.00", start: "2026-11-01", end: "2026-12-31" }), other({ unique_value: "PRJ-2002", value: "50.00", start: "2026-11-15", end: "2026-12-31" })];
  mockWrites(t);

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: writeHeaders,
    body: JSON.stringify({ ...VALID_BODY, projectAssignmentStartDate: "2026-11-01", projectAssignmentEndDate: "2026-12-31", allocationPercentage: 30 }),
  });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.allocationPercentage, /on 2026-11-15 110% is already allocated, so at most 0% remains/);
});

test("POST /v1/project-assignments adds three shares that total exactly 100 when written to 2 decimals, and answers with the team's total today", async (t) => {
  otherRows = [other({ unique_value: "PRJ-2001", value: "33.33" }), other({ unique_value: "PRJ-2002", value: "33.33" })];
  mockWrites(t);

  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST",
    headers: writeHeaders,
    body: JSON.stringify({ ...VALID_BODY, projectAssignmentStartDate: "2026-10-01", projectAssignmentEndDate: "2026-12-05", allocationPercentage: 33.34 }),
  });

  assert.equal(res.status, 201);
  assert.equal((await res.json()).data.teamTotalAllocation, 100);
});

test("POST /v1/project-assignments is 422, not 500, for a date that is not a real calendar day", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [{}] }));
  const res = await fetch(`${baseUrl}/v1/project-assignments`, {
    method: "POST", headers: writeHeaders, body: JSON.stringify({ ...VALID_BODY, projectAssignmentEndDate: "2026-02-30" }),
  });
  assert.equal(res.status, 422);
  assert.ok((await res.json()).error.details.projectAssignmentEndDate);
});
