# Merge-to-Main Gate Report — FEAT-21 (with FEAT-19 and FEAT-20 earlier in the branch)

**Features:** (FEAT-19) Undo delete and edit-a-record on every master-data table.
(FEAT-20) Input and Output columns on Departments.

**Diff reviewed:** `git diff origin/main..HEAD` (branch `claude/trusting-curie-hlx1r6`)

**Overall verdict: PASS (WARN items below).** All 8 gate agents ran. Every real
finding was fixed and covered by a test. Fixes were verified by the full test
suites, not by a second full agent round.

## Test results
- backend: 210 pass, 0 fail
- mcp-server: 53 pass, 0 fail
- frontend: 144 pass, 0 fail
- lint: 0 errors (pre-existing warnings only), build OK

## Findings fixed
| Agent | Finding | Fix |
|---|---|---|
| security-auditor | Non-string `updatedBy` threw on `.trim()` and returned 500 | `actorOf()` returns 422 on POST, PATCH, restore |
| code-reviewer | Restore of a row that is not deleted answered 404 | 409 `<resource>_not_deleted` |
| debugger | Parent deleted between the reference check and the UPDATE | Live-parent check repeated inside the UPDATE, re-validated on miss |
| silent-failure-hunter | Generic fallback hid gateway errors; 2xx without a record counted as success | Fallback carries HTTP status; 2xx without `data` throws |
| silent-failure-hunter | One shared row-action error was overwritten or wiped | One alert per failing row |
| code-reviewer | Edit stayed clickable during a pending delete or restore | Edit disabled while in flight |
| refactorer | Duplicate in-flight/error code in delete and restore handlers | `runRowAction` helper |
| doc-writer | Stale hook comments, restore status codes undocumented | Comments, `backend/README.md`, `.claude/rules/api.md` updated |
| test-writer | MCP restore tool untested; mirror drift unchecked | `restoreTool.test.js`, `masterDataTables.drift.test.js`; drift found and fixed `delivery-centers` `hasCode` |
| test-writer | Form edit paths thin | 6 added `RecordFormModal` tests |

## WARN (not blocking, logged for follow-up)
- Edit sends a diff against the loaded snapshot, so two editors on the same row are last-write-wins by field.
- Postgres `date` columns depend on the driver's default parser.
- `deleteRecord` does not go through the shared `writeRecord` helper.
- Backend HTTP tests mock `pool.query`; the SQL itself ran only against the live database in manual checks.
- Input and Output are free text; the owner's note "in input, you can let it be like that" was ambiguous.

---

## FEAT-21: Resource Deployment allocation percentage

**Verdict: PASS (WARN items below).** Three gate agents ran (code-reviewer,
security-auditor, pr-test-analyzer). debugger, refactorer, doc-writer and
silent-failure-hunter did not run separately for this change; the diff is
small and README, migration and error-handling changes were reviewed by the
three that did. Fixes were verified by the suites.

Tests: backend 227, mcp-server 53, frontend 145, build OK.

| Agent | Finding | Fix |
|---|---|---|
| code-reviewer, security-auditor | Check-then-write race: two concurrent writes could push a resource over 100 or repeat a position | Check and write run in one transaction under `pg_advisory_xact_lock`; partial unique index (migration 0021) as a backstop |
| code-reviewer | Rounding: stored value is 2 decimals, validation used raw input; message printed float noise | Compare in whole cents |
| code-reviewer | `toResponse` conversion keyed on `max` | Explicit `numeric: true` field flag |
| code-reviewer | `employeeTotalAllocation` null on POST, PATCH, restore responses | Re-select through the list query after each write |
| security-auditor | Raw Postgres SQLSTATE returned as `error.code` in 500 bodies | Only `ApiError` codes reach the client |
| code-reviewer | Migration backfill could break resources with several rows | Checked live: no resource had more than one live row |
| pr-test-analyzer | Untested: PATCH moving a row between resources, rounding, unit tests for min/max, `toResponse`, `validateAllocation`, restore success, lock and rollback | Added |

## WARN (not blocking)
- Frontend form and column rendering for the new field have no dedicated test beyond the generic number-field tests.
- GET and DELETE on a malformed id still return a 500 (pre-existing; PATCH and restore answer 422).
- `employeeId` has no integer-range bound, so an out-of-range value is a 500.
- The total is capped at 100 and shown, not forced to exactly 100.
