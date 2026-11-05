import { readFileSync } from "node:fs";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { MODULE_LEAD_EXEMPT_TEAMS } from "./moduleLeadSeat.js";
import { mapWriteErrorForTest } from "./masterDataRouter.js";
import { startTestServer, stopTestServer } from "./masterDataRouter.testHelpers.js";

// FEAT-45: one live Module Lead seat per team, and the guard that stops a position being
// deleted while a person is deployed to it today or later.

const positionsTable = MASTER_DATA_TABLES.find((t) => t.route === "positions");
const POSITION_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const KEY = { "Content-Type": "application/json", "x-internal-api-key": "test-secret" };

let server;
let baseUrl;
before(async () => {
  ({ server, baseUrl } = await startTestServer(positionsTable));
});
after(async () => {
  await stopTestServer(server);
});

const row = (overrides = {}) => ({
  id: POSITION_ID,
  name: "Module Lead - FI",
  code: "POS-001",
  team_code: "TEAM-001",
  competencies: null,
  created_by: "a",
  updated_by: "a",
  deleted_at: null,
  ...overrides,
});

// Writes to a Module Lead seat run on a pooled client in a transaction holding the team's
// lock; the client delegates its statements to the pool.query mock of the test.
function install(t, { existing = [], current = row(), lockCalls = [] } = {}) {
  const seen = { selects: [], sqls: [], inserted: false, updated: false, lockCalls };
  t.mock.method(pool, "connect", async () => ({
    query: async (sql, params) => {
      if (/^(begin|commit|rollback)$/i.test(sql)) return { rows: [] };
      if (sql.startsWith("select pg_advisory_xact_lock")) {
        lockCalls.push(params);
        return { rows: [] };
      }
      return pool.query(sql, params);
    },
    release: () => {},
  }));
  t.mock.method(pool, "query", async (sql, params) => {
    if (sql.startsWith("select 1 from teams where code")) return { rows: [{}] };
    if (sql.startsWith("select * from positions where id")) return { rows: [current] };
    if (sql.includes("like 'Module Lead%'")) {
      seen.selects.push(params);
      seen.sqls.push(sql);
      return { rows: existing.filter((r) => !(params[1] && r.id === params[1])) };
    }
    if (sql.startsWith("insert into positions")) {
      seen.inserted = true;
      return { rows: [row({ name: params[0], team_code: params[1] })] };
    }
    if (sql.startsWith("update positions set deleted_at = null")) {
      seen.updated = true;
      return { rows: [current] };
    }
    if (sql.startsWith("update positions set")) {
      seen.updated = true;
      return { rows: [row({ name: params[0], team_code: params[1] })] };
    }
    throw new Error(`unexpected query: ${sql}`);
  });
  return seen;
}

const post = (body) => fetch(`${baseUrl}/v1/positions`, { method: "POST", headers: KEY, body: JSON.stringify(body) });
const patch = (body) => fetch(`${baseUrl}/v1/positions/${POSITION_ID}`, { method: "PATCH", headers: KEY, body: JSON.stringify(body) });
const restore = () => fetch(`${baseUrl}/v1/positions/${POSITION_ID}/restore`, { method: "POST", headers: KEY, body: "{}" });

const taken = [{ code: "POS-010", name: "Module Lead - SD" }];

test("POST refuses a first Module Lead seat's twin: 422 on name naming the existing seat, nothing inserted", async (t) => {
  const seen = install(t, { existing: taken });

  const res = await post({ name: "Module Lead - MM", teamCode: "TEAM-001" });

  assert.equal(res.status, 422);
  const { error } = await res.json();
  assert.equal(error.code, "validation_error");
  assert.match(error.details.name, /Team TEAM-001 already has a Module Lead seat \(POS-010, Module Lead - SD\)/);
  assert.equal(seen.inserted, false);
});

test("POST of a Module Lead seat into a team with none inserts it under the team's advisory lock", async (t) => {
  const lockCalls = [];
  const seen = install(t, { lockCalls });

  const res = await post({ name: "Module Lead - FI", teamCode: "TEAM-001" });

  assert.equal(res.status, 201);
  assert.equal(seen.inserted, true);
  assert.deepEqual(seen.selects[0], ["TEAM-001", null]);
  assert.deepEqual(lockCalls, [["positions", "TEAM-001"]]);
});

const EXEMPT_TEAMS = ["TEAM-087", "TEAM-088", "TEAM-089"];

test("the exempt teams are exactly TEAM-087, TEAM-088 and TEAM-089", () => {
  assert.deepEqual(MODULE_LEAD_EXEMPT_TEAMS, EXEMPT_TEAMS);
});

test("migration 0039 creates the index the descriptor names, for exactly the exempt teams", () => {
  const sql = readFileSync(new URL("../migrations/0039_unique_live_module_lead_per_team.sql", import.meta.url), "utf8");
  assert.match(sql, new RegExp(`create unique index ${positionsTable.moduleLeadSeatRule.constraint} on`));
  const [, list] = sql.match(/team_code not in \(([^)]*)\)/);
  assert.deepEqual(list.match(/TEAM-\d+/g), MODULE_LEAD_EXEMPT_TEAMS);
});

for (const teamCode of EXEMPT_TEAMS) {
  test(`POST of another Module Lead seat into exempt ${teamCode} is allowed and never checked`, async (t) => {
    const seen = install(t, { existing: taken });

    const res = await post({ name: "Module Lead - MM", teamCode });

    assert.equal(res.status, 201);
    assert.equal(seen.selects.length, 0);
    assert.equal(seen.lockCalls.length, 0);
  });
}

test("a name that does not start with Module Lead is unaffected: no lock, no check", async (t) => {
  const lockCalls = [];
  const seen = install(t, { existing: taken, lockCalls });

  const res = await post({ name: "Senior Module Lead", teamCode: "TEAM-001" });

  assert.equal(res.status, 201);
  assert.equal(seen.selects.length, 0);
  assert.equal(lockCalls.length, 0);
});

test("PATCH renaming a position into Module Lead in a team that has one is refused, and is checked without itself", async (t) => {
  const seen = install(t, { existing: taken, current: row({ name: "Consultant" }) });

  const res = await patch({ name: "Module Lead - QA" });

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.name, /already has a Module Lead seat/);
  assert.deepEqual(seen.selects[0], ["TEAM-001", POSITION_ID]);
  assert.equal(seen.updated, false);
});

test("PATCH moving a Module Lead seat into a team that has one is refused", async (t) => {
  const seen = install(t, { existing: taken });

  const res = await patch({ teamCode: "TEAM-002" });

  assert.equal(res.status, 422);
  assert.deepEqual(seen.selects[0], ["TEAM-002", POSITION_ID]);
  assert.equal(seen.updated, false);
});

test("PATCH of a team's own Module Lead seat that changes nothing about the rule is allowed", async (t) => {
  // The fake returns the seat itself unless the query excludes its id, so dropping the
  // self-exclusion would make this a 422.
  const seen = install(t, { existing: [{ id: POSITION_ID, code: "POS-001", name: "Module Lead - FI" }] });

  const res = await patch({ name: "Module Lead - FI and SD" });

  assert.equal(res.status, 200);
  assert.equal(seen.updated, true);
  assert.match(seen.sqls[0], /id <> \$2::uuid/);
  assert.deepEqual(seen.selects[0], ["TEAM-001", POSITION_ID]);
});

test("PATCH renaming a Module Lead seat away from Module Lead skips the check", async (t) => {
  const seen = install(t, { existing: taken });

  const res = await patch({ name: "Consultant" });

  assert.equal(res.status, 200);
  assert.equal(seen.selects.length, 0);
  assert.equal(seen.updated, true);
});

test("PATCH and restore of a guarded seat run under the team's advisory lock", async (t) => {
  const lockCalls = [];
  install(t, { lockCalls });
  assert.equal((await patch({ name: "Module Lead - FI and SD" })).status, 200);
  assert.deepEqual(lockCalls, [["positions", "TEAM-001"]]);

  lockCalls.length = 0;
  t.mock.restoreAll();
  install(t, { lockCalls, current: row({ deleted_at: "2026-01-01T00:00:00Z" }) });
  assert.equal((await restore()).status, 200);
  assert.deepEqual(lockCalls, [["positions", "TEAM-001"]]);
});

test("PATCH of a seat in an exempt team is allowed, unchecked and unlocked", async (t) => {
  const lockCalls = [];
  const seen = install(t, { existing: taken, lockCalls, current: row({ team_code: "TEAM-087" }) });

  const res = await patch({ name: "Module Lead - QA" });

  assert.equal(res.status, 200);
  assert.equal(seen.selects.length, 0);
  assert.equal(lockCalls.length, 0);
});

test("restore of a Module Lead seat into a team that already has another is refused, and nothing is restored", async (t) => {
  const seen = install(t, { existing: taken, current: row({ deleted_at: "2026-01-01T00:00:00Z" }) });

  const res = await restore();

  assert.equal(res.status, 422);
  assert.match((await res.json()).error.details.name, /POS-010/);
  assert.equal(seen.updated, false);
});

test("restore of a Module Lead seat into a team with none succeeds", async (t) => {
  const seen = install(t, { existing: [], current: row({ deleted_at: "2026-01-01T00:00:00Z" }) });

  const res = await restore();

  assert.equal(res.status, 200);
  assert.equal(seen.updated, true);
});

test("a unique violation of the Module Lead index is a 422 on name, not a 500 and not a constraint name", async (t) => {
  t.mock.method(pool, "connect", async () => ({
    query: async (sql) => {
      if (/^(begin|commit|rollback)$/i.test(sql) || sql.startsWith("select pg_advisory_xact_lock")) return { rows: [] };
      if (sql.startsWith("insert into positions")) {
        const err = new Error("duplicate key value violates unique constraint");
        err.code = "23505";
        err.constraint = "ux_positions_team_module_lead_live";
        throw err;
      }
      return { rows: [] };
    },
    release: () => {},
  }));
  t.mock.method(pool, "query", async () => ({ rows: [{}] }));

  const res = await post({ name: "Module Lead - FI", teamCode: "TEAM-001" });

  assert.equal(res.status, 422);
  const { error } = await res.json();
  assert.equal(error.code, "validation_error");
  assert.match(error.details.name, /only one is allowed/i);
  assert.doesNotMatch(JSON.stringify(error), /ux_positions/);
});

test("a unique violation of another index still maps through duplicateFieldError", () => {
  const err = Object.assign(new Error("dup"), { code: "23505", constraint: "ux_something_name_live" });
  const mapped = mapWriteErrorForTest(err, positionsTable.fields, {}, positionsTable);
  assert.equal(mapped.status, 422);
  assert.ok(mapped.details.name);
});

// Delete guard.
const del = () => fetch(`${baseUrl}/v1/positions/${POSITION_ID}`, { method: "DELETE", headers: KEY });

test("DELETE's guard blocks only a deployment that is current or future: ended ones are history", async (t) => {
  let sql;
  t.mock.method(pool, "query", async (text) => {
    sql = text;
    return { rows: [{ id: POSITION_ID }] };
  });

  const res = await del();

  assert.equal(res.status, 204);
  // Mocks cannot prove the boundary (a deployment ending today still blocks); the SQL text
  // is the most a route test can check, and the README says these tests do not run Postgres.
  assert.match(sql, /d\.end_date >= current_date/);
});

test("DELETE of a seat with a current or future deployment is a 409 position_in_use telling the user to unassign", async (t) => {
  t.mock.method(pool, "query", async (text) => (text.startsWith("update") ? { rows: [] } : { rows: [{ "?column?": 1 }] }));

  const res = await del();

  assert.equal(res.status, 409);
  const { error } = await res.json();
  assert.equal(error.code, "position_in_use");
  assert.match(error.message, /Unassign the person first/);
});

test("DELETE of a position that does not exist is still a 404", async (t) => {
  t.mock.method(pool, "query", async () => ({ rows: [] }));

  assert.equal((await del()).status, 404);
});
