# Gate Report — FEAT-21: Dashboard overview page

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean)

**Branch:** `claude/dreamy-knuth-76pnsa` → `main`
**Scope:** `git diff origin/main..HEAD`. New `Dashboard` component and `useTableCounts` hook, an additive `activeTotal` field on master-data list routes, `AppShell` wiring, `DashboardPlaceholder` removed.
**Checks run after the fixes below:** frontend 163/163 tests, backend 211/211 tests, `vite build` clean, no new lint warnings in changed files.

## Agent results

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | PASS | No Critical. Two Warns, both transitional or future-rename only (see checklist). |
| security-auditor | PASS | Static SQL, escaped React output, nothing new exposed. Info only. |
| debugger | PASS | No crash paths. Bar-width math guarded. Ran both test suites and the build. |
| test-writer | PASS | About 90-95% of changed lines and 85% of branches covered. |
| refactorer | PASS | No duplication, no dead code. Cosmetic Info only. |
| doc-writer | WARN | Fixed in this push (below). |
| silent-failure-hunter | WARN | Real finding, fixed in this push (below). |
| pr-test-analyzer | WARN | Gaps filled in this push where verified (below). |

Subagent verification rule (CLAUDE.md §8): no agent made a negative file-existence claim that needed a cross-check. The doc agent's claims about `mcp-server/README.md` and `.claude/rules/api.md` were confirmed by direct read (manual cross-check, CONFIRMED). The test-quality agent cited line numbers that do not exist in the 40-line `masterDataRouter.list.test.js` (HALLUCINATED line numbers), so each of its findings was re-checked against the real files before acting.

## Fixed in this push

- **Misleading healthy state (silent-failure-hunter, CONFIRMED).** With failed tables, "Needs data" said "Every table has at least one record" and the bar panel could say "0 active records across 0 tables". Now: when every table fails, the page shows one alert only. When some fail, "Needs data" says "No empty tables among those that loaded." Three new tests.
- **Stale and missing docs (doc-writer, CONFIRMED).** `mcp-server/README.md` no longer says the Dashboard has no content. `.claude/rules/api.md` documents `activeTotal`. `backend/README.md` sentence tidied.
- **Test gaps (pr-test-analyzer, CONFIRMED).** `fetchMasterDataTable` now tests an absent, negative, string and NaN `activeTotal` separately. Failed-table-excluded-from-"Needs data" is tested.
- **`src/App.test.jsx`** fetch stub now returns `total: 0` like the real API. It returned a malformed body, which the new all-failed state exposed.

## Remaining checklist (non-blocking)

- [ ] Backend list-route test covers the happy path only. Add a case where the count query rejects and the error reaches the error handler. The SQL assertion is a regex on the query text, so it does not prove soft-deleted rows are excluded against a real Postgres. No database is reachable from this sandbox.
- [ ] `Dashboard.jsx` looks up `FEATURED_ROUTES` with `find`. A future rename of one of those four routes in `MASTER_DATA_TABLES` would throw. Not reachable today.
- [ ] Against a backend that predates `activeTotal`, counts fall back to `total` and include soft-deleted rows. Transitional, both ship together.
- [ ] Counts load when the Dashboard opens and are not auto-refreshed. A refresh button or timed refresh is a possible follow-up.
- [ ] No test asserts that `AppShell` passes `onNavigate` through so a click changes the active view. Dashboard tests only check the callback with a mock.
- [ ] Twelve count requests go out on every Dashboard mount. Bounded and parallel, no caching.
