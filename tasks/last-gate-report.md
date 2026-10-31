# Gate Report — FEAT-23: Restore the Dashboard, activeTotal and Control Center

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean)

**Branch:** `claude/dreamy-knuth-76pnsa` → `main`
**Scope:** `git diff origin/main..HEAD`. PR #40 was squashed from a branch cut before the Dashboard (#35) and Control Center (#36, #39) existed, so it deleted both and removed `activeTotal` from the master-data list routes. This change rebuilds them on current `main` and leaves #40's resource-deployment allocation and #42's position competencies as merged. The Dashboard no longer falls back to `total` when `activeTotal` is missing.
**Checks after the fixes below:** frontend 178/178 tests, backend 232/232 tests, `vite build` clean, no new lint warnings in changed files.

**Merge note:** the auto-PR workflow merged the earlier restore commits as #37 before this gate finished. The gate ran on that same code plus the three fixes below, which ship in this PR (#43). The Render backend was redeployed from `b9c8ce6` so `activeTotal` is live.

## Agent results

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | PASS | #40 and #42 intact. Only the list-route count query and response line change in the backend. |
| security-auditor | PASS | Static SQL, escaped React output, no secrets, no new dependencies. Info only. |
| debugger | PASS | Ran both suites and the build. No regressions between the restored code and newer main code. |
| test-writer | PASS | About 90% of changed branches covered. |
| refactorer | WARN | Duplicated soft-delete check and loading/error blocks. Mostly pre-existing, logged below. |
| doc-writer | WARN | One real gap, fixed in this push. |
| silent-failure-hunter | WARN | One real gap, fixed in this push. |
| pr-test-analyzer | WARN | Brittleness notes, logged below. |

Subagent verification rule (CLAUDE.md §8): no agent made a negative file-existence claim that needed a cross-check. The test-quality and test-coverage agents cited line numbers that do not exist in short files (HALLUCINATED line numbers), so their findings were treated as leads and re-checked against the real files. The doc agent's `backend/README.md:41` claim was confirmed by direct read (manual cross-check, CONFIRMED).

## Fixed in this push

- **Failure cause never shown (silent-failure-hunter, CONFIRMED).** The Dashboard banner names failed tables but dropped the error. `useTableCounts` now logs each cause to the console. One new test.
- **Wrong blame for a bad `activeTotal` (silent-failure-hunter, Info).** The message now says "did not report a valid activeTotal" and "may need updating", since a malformed value is folded into missing.
- **Endpoint contract incomplete (doc-writer, CONFIRMED).** The `GET /v1/<table>` row in `backend/README.md` now states `total` and `activeTotal`.

## Remaining checklist (non-blocking)

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

---

## FEAT-22: Positions Competencies column

**Verdict: PASS (WARN below).** One gate agent ran (code-reviewer) because the
change is small and reuses the existing reference-validation path. security,
debugger, refactorer, doc-writer, silent-failure-hunter and test agents did not
run separately for this change. READMEs and tests were updated and the suites
pass: backend 231, mcp-server 53, frontend 146.

| Agent | Finding | Fix |
|---|---|---|
| code-reviewer | A list of only commas was accepted and stored | Refused with a 422 asking for at least one name |
| code-reviewer | Duplicates and spacing stored as typed | Stored canonically (`MM, SRM`) |
| code-reviewer | Restoring a position whose competency was later deleted is blocked | Accepted: restore the competency first (same as other references) |
| code-reviewer | Restore race re-check covers single references only | Accepted as narrow, not fixed |

SQL safety was checked: identifiers come only from the descriptor and the names are bound parameters.
- [ ] The `markedDeleted !== 'Yes'` check exists in three places (`useFactoryData`, `RecordFormModal`, `DeleteRecordModal`). Export one `isLiveRow` from `masterDataApi.js`.
- [ ] The loading and error blocks repeat across Dashboard, ControlCenter, EntityRelationship and others. A shared status component is possible.
- [ ] The backend list-route test mocks the database, so it does not prove soft-deleted rows are excluded in real Postgres. It also has no database-error case.
- [ ] Test brittleness: Dashboard ranking test checks only the first and last bar. Count assertions use substring matching (`'12'` also matches `'112'`). ControlCenter tests depend on heading level and the hard-coded `DEPT-002`.
- [ ] `Dashboard.jsx` finds its four featured routes with `find`. Renaming one of them would throw. Not reachable today.
- [ ] A comment in `useAsyncResource.js` still says only `DeleteRecordModal` uses it.
- [ ] The landing page "Enter the Application" button opens the Control Center, because it is first in navigation. This matches the layout before #40. Confirm it is intended.
- [ ] Counts load when the Dashboard opens and are not auto-refreshed.
- [ ] The backend must be deployed for the Dashboard to show counts. Until then every table shows a dash and the page names them.
