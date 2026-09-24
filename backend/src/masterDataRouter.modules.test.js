import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "./db.js";
import { MASTER_DATA_TABLES } from "./masterDataTables.js";
import { startTestServer, stopTestServer, registerAuthGateTests } from "./masterDataRouter.testHelpers.js";

// Regression coverage for a real production bug found via a live UI
// walkthrough (FEAT-15 post-merge testing): modules.practiceId is
// deliberately unvalidated at the app layer (no FK check — see
// masterDataTables.js) and rendered as a free-text input, but its
// Postgres column is `uuid`. A non-UUID value used to reach the INSERT
// and crash as a raw, unhandled 500 (Postgres invalid_text_representation,
// code 22P02) instead of the same clean 422 shape every other write
// failure gets. Fixed in errors.js/masterDataRouter.js's mapWriteError.

const modulesTable = MASTER_DATA_TABLES.find((t) => t.route === "modules");

let server;
let baseUrl;

before(async () => {
  ({ server, baseUrl } = await startTestServer(modulesTable));
});

after(async () => {
  await stopTestServer(server);
});

registerAuthGateTests({
  getBaseUrl: () => baseUrl,
  route: "modules",
  getId: () => "dddddddd-dddd-dddd-dddd-dddddddddddd",
  postBody: { moduleCode: "MOD-1", name: "Module One" },
  patchBody: { name: "Renamed" },
});

test("POST /v1/modules with a non-UUID practiceId returns a 422 naming practiceId, not a raw 500", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("insert into modules")) {
      const err = new Error('invalid input syntax for type uuid: "not-a-real-practice-id"');
      err.code = "22P02";
      throw err;
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({
      moduleCode: "MOD-1",
      name: "Module One",
      practiceId: "not-a-real-practice-id",
    }),
  });

  assert.equal(res.status, 422);
  const body = await res.json();
  assert.equal(body.error.code, "validation_error");
  assert.ok(body.error.details.practiceId);
});

test("POST /v1/modules without a practiceId (optional field) still succeeds", async (t) => {
  t.mock.method(pool, "query", async (sql) => {
    if (sql.startsWith("insert into modules")) {
      return {
        rows: [
          {
            id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            module_code: "MOD-2",
            name: "Module Two",
            practice_id: null,
            code: "MODC-001",
            created_by: "Arshad Gani",
            created_at: "2026-01-01T00:00:00Z",
            updated_by: "Arshad Gani",
            updated_at: "2026-01-01T00:00:00Z",
            deleted_at: null,
          },
        ],
      };
    }
    throw new Error(`unexpected query: ${sql}`);
  });

  const res = await fetch(`${baseUrl}/v1/modules`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-api-key": "test-secret" },
    body: JSON.stringify({ moduleCode: "MOD-2", name: "Module Two" }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.moduleCode, "MOD-2");
});
