# Quality Gate Report

**Branch:** `claude/trusting-curie-hlx1r6` → `main`
**Diff:** master data framework — 6 Postgres tables, shared backend CRUD
router, new `mcp-server/` package (18 tools), new frontend view, plus a
follow-up commit addressing every finding below.
**Verdict: ⚠️ WARN — merge allowed, all Critical/FAIL findings from the
first pass remediated; remaining items are disclosed, non-blocking gaps.**

## First pass (8 gate agents, parallel)

| Agent | Verdict | Key findings |
|---|---|---|
| `code-reviewer` | WARN | One false-positive (claimed no `updated_at` trigger exists — it does, live in Supabase, just not as a committed file; see fix below). Real: negative `offset`/`limit` not clamped. |
| `security-auditor` | WARN → **FAIL per §9.5's security-exception rule** | 6 new fully-CRUD tables + a new MCP server's write tools sat behind zero authentication. Not a new class of problem (team-members has the same pre-existing gap) but a real expansion of unauthenticated write surface. |
| `database-specialist` | WARN | Real bug: PATCH's UPDATE statement omitted `deleted_at is null`, a TOCTOU race letting a concurrent DELETE leave a soft-deleted row editable. Index shape: `deleted_at`-only indexes have near-zero selectivity and don't serve the actual `ORDER BY name` hot query. Migration only existed in Supabase's history, not committed to the repo. |
| `refactorer` | PASS | One non-blocking note: `MASTER_DATA_TABLES` is hand-duplicated 3× (backend/mcp-server/frontend) with no workspace link — acceptable at 6 tables, flagged for later. |
| `silent-failure-hunter` | PASS | One low-severity nit (see debugger row — same issue, not swallowed, just an unclear message). |
| `pr-test-analyzer` | WARN | Validation/mapping logic (the layer with real business rules) is unit tested; route handlers, `mcp-server/`, and the frontend view have no automated tests — consistent with the pre-existing `teamMembers.js`/no-frontend-test-runner gap, not a new regression. |
| `doc-writer` | **FAIL** | No README for `mcp-server/` (setup, config, MCP client registration), no REST route inventory anywhere. |
| `debugger` | WARN | Two real edge-case bugs introduced in this diff: a 2xx response with an unparseable body would throw a raw `TypeError` instead of a clean error (both `mcp-server/src/apiClient.js` and `src/lib/masterDataApi.js`); `validateBody` assumed `body` is always an object, so a request with no JSON content-type would 500 instead of 422. |

## Remediation (follow-up commit, before this report)

Per §9.3 Step 2, smallest fix per Critical/FAIL finding:

- **Security (FAIL → resolved):** added `backend/src/auth.js` —
  `requireInternalApiKey` middleware, applied only to the 6 master-data
  tables' POST/PATCH/DELETE routes (reads stay open — the frontend view is
  a public browser bundle and can never safely hold a real secret). The
  MCP server now sends `x-internal-api-key` on every write via
  `INTERNAL_API_KEY`. Verified live: POST without the header → 401, wrong
  header → 401, correct header → reaches the DB layer, GET still works
  unauthenticated. 4 new unit tests in `backend/src/auth.test.js`.
- **Docs (FAIL → resolved):** added `mcp-server/README.md` (setup, env
  vars, MCP client registration snippet, tool table) and
  `backend/README.md` (full route inventory for both `team-members` and
  the 6 master-data resources, schema reference, why reads are
  unauthenticated and writes aren't).
- **TOCTOU bug (database-specialist):** `masterDataRouter.js`'s PATCH
  UPDATE now includes `and deleted_at is null` and 404s if 0 rows
  affected. Verified live against Supabase with a race simulation
  (insert → soft-delete → attempt the old UPDATE shape → 0 rows).
- **Index shape (database-specialist):** new migration
  `backend/migrations/0002_improve_master_data_indexes.sql` replaces the
  6 `deleted_at`-only indexes with partial indexes on `name` (`where
  deleted_at is null`), which serve both the filter and the `ORDER BY`.
  Verified with `EXPLAIN` that the planner picks the new index.
- **Migration reproducibility (database-specialist + code-reviewer):**
  added `backend/migrations/0001_create_master_data_tables.sql` and
  `0002_improve_master_data_indexes.sql`, committed to the repo (they were
  previously only in Supabase's migration history).
- **Negative pagination (code-reviewer):** `limit`/`offset` now clamped
  with `Math.max`.
- **Malformed-body 500 (debugger):** `validateBody` now treats a
  non-object/undefined body as `{}` instead of throwing a raw `TypeError`,
  returning the intended 422 instead.
- **Unparseable-response TypeError (debugger):** both `apiClient.js`
  (mcp-server) and `masterDataApi.js` (frontend) now throw a clear error
  instead of crashing on `payload.data` when `payload` is `null`.

## Re-verification after fixes

- `cd backend && npm test` — 21/21 pass (17 pre-existing/schema tests + 4
  new auth tests).
- `npm run build` (frontend) — clean, 40 modules.
- `npx oxlint src/ backend/src/ mcp-server/src/` — clean except the
  pre-existing, non-blocking `react/set-state-in-effect` warning on
  `useMasterDataTable.js` (standard React data-fetching pattern, exit code
  0, does not fail CI).
- Live Supabase verification: insert/update/soft-delete/exclude-from-list
  cycle, the TOCTOU race fix, and the new partial indexes all confirmed
  working against the real database.
- Auth guard verified live: 401 without/with-wrong key, passes through to
  the DB layer with the correct key, GET unaffected.

## Disclosed, non-blocking gaps (not remediated — judgment calls, not oversights)

- **No automated tests for route handlers, `mcp-server/`, or the frontend
  view.** Consistent with pre-existing project state (no test DB, no
  frontend test runner configured at all). Recommend a backlog item
  (§16, `--autonomous no` — picking a test stack is a decision) rather
  than bolting on ad hoc test infrastructure here.
- **No live end-to-end verification of `mcp-server → backend → Supabase`
  as a single round trip.** This sandbox has no `DATABASE_URL`/DB
  password, so the backend was smoke-tested against a deliberately
  unreachable DB (proving error propagation) and separately against a
  fake backend (proving the happy path renders); the actual SQL was
  verified directly against live Supabase. All three pieces are verified
  individually, not chained together in one process.
- **`MASTER_DATA_TABLES` duplicated 3× across backend/mcp-server/frontend**
  (refactorer's note) — no monorepo workspace links the three Node
  projects. Acceptable at 6 tables with a single field each; revisit if
  the table count or per-table schema complexity grows.
- **Full bearer-token auth per `api.md`** ("all routes require a valid
  bearer token") remains unenforced project-wide — this diff closes the
  specific write-surface gap it introduced with a scoped shared-secret
  guard, not the broader pre-existing gap (no user/session model exists
  anywhere in this app yet). That remains a standing, disclosed condition,
  same as before this diff.

No Critical findings remain. No FAIL gates remain. Verdict: **WARN**,
merge allowed on "Merge to Main" per CLAUDE.md §9.5.
