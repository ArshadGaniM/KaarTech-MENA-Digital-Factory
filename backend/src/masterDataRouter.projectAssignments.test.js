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

before(async () => {
  ({ server, baseUrl } = await startTestServer(projectAssignmentsTable));
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
