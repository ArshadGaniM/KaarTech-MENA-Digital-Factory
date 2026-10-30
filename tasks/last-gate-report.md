# Merge-to-Main Gate Report — FEAT-19 and FEAT-20

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
