# Gate Report: Control Center factory view with live hours

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean)

**Branch:** `claude/sleepy-hopper-bpow3i` to `main`
**Scope:** `git diff origin/main..HEAD`. The Control Center page: department floors, team cards (members, available, allocated and utilized hours, status color), a month picker, a team popup, and live updates. New backend routes `/v1/control-center`, `/teams/:code` and `/stream`, a change feed, and migration 0023 (not applied). CORS now allows no other site when `FRONTEND_URL` is unset in production.
**Checks run after the fixes below:** frontend 221/221 tests, backend 271/271 tests, `vite build` clean, no lint warnings in changed files.

## Agent results (round 2, after round 1 fixes)

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | WARN | No Critical. Popup does not live-refresh, no focus trap, global stream cap. |
| security-auditor | PASS | Round 1 findings fixed. Stream cap, shared queries, optional certificate verification, pinned search_path. |
| debugger | PASS | Fixes verified against the code. Both suites and the build run. |
| test-writer | PASS | About 95% backend and 90% or more frontend of changed lines. |
| refactorer | WARN | Optional cleanups, two done (status line, status class helper). |
| doc-writer | WARN | Routes, month option, stream cap, migration and env variable all documented. |
| silent-failure-hunter | PASS | Failed month switch no longer shows the old month. |
| pr-test-analyzer | PASS | Round 1 test gaps closed. |

Round 1 returned FAIL from security (unauthenticated stream with no cap, full-table queries on every request, unverified database TLS) and from docs (new routes, migration and variable undocumented). All were fixed. Subagent verification rule (CLAUDE.md §8): the docs gaps were confirmed by a direct read of the README before fixing. Agents ran on `sonnet` because the `deep` and `fast` model aliases in their definitions do not exist here.

## Fixed in this push

- A failed month switch hides the old month's numbers and the page says "Not live". Error and stale data are tied to their month.
- The stream is capped at 100 connections (503 above), with one shared heartbeat and clean shutdown.
- Table rows are shared between requests for a second and dropped on any change. A failed load is never kept.
- `DATABASE_SSL_CA` turns on certificate verification for all database connections. Unset keeps the old behaviour.
- The change feed ends its client on stop, uses TCP keep-alive, announces a change after a reconnect and logs when disabled.
- With `FRONTEND_URL` unset and `NODE_ENV=production`, CORS allows no other origin. The live API was checked and has `FRONTEND_URL` set, so production behaviour is unchanged.
- The stream heartbeat timer no longer keeps the process alive on shutdown (debugger WARN).
- Tests for month boundaries, the stream cap, caching, reconnects, month switching and the new components.

## Open (not blocking)

- [ ] Migration `0023_control_center_notify.sql` is NOT applied. Until it is, live updates arrive through the 30 second refresh instead of instantly.
- [ ] The open team popup loads once and does not refresh while open. It has no focus trap.
- [ ] The stream and read routes are unauthenticated and the 100-stream cap is global, not per client.
- [ ] Without `DATABASE_SSL_CA`, database TLS is still unverified (unchanged default).
- [ ] The ten department codes are a fixed list in `factoryLayout.js`.
- [ ] The backend defaults to the UTC month and the page to the local month. The page always sends the month.
- [ ] Frontend and backend deploy separately. The page shows an error until the backend redeploy finishes.
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

---

## FEAT-24: Search bar on every master-data table

**Verdict: PASS (WARN below).** No separate gate agents were run for this
change. It is a read-only list filter. It was checked by hand against the live
database (the real generated SQL returns `Nithyashri S` for `Nithyasri`) and
by the suites: backend 237, mcp-server 53, frontend 185, build OK.

- SQL safety: table, column and lookup identifiers come only from the fixed
  descriptors; the search term is always a bound parameter, trimmed and capped
  at 100 characters, and tests assert it is never interpolated.
- WARN: `?q=` scans the table on each request (no trigram index). Fine at
  today's size (the largest table has about 2,760 rows) and worth an index if
  tables grow by an order of magnitude.
- WARN: the MCP list tools do not take a search term yet.
