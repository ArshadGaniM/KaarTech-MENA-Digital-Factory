# Gate Report: key check on team-members writes

Verdict: ⚠️ WARN (no FAIL, no Critical, security PASS on the second audit)

Scope: `backend/src/routes/teamMembers.js`, `backend/src/auth.js`, `backend/src/index.js`, `backend/src/auth.test.js`, the new `backend/src/teamMembers.route.test.js`, `backend/README.md` and `.claude/rules/api.md`.
Checks: backend 322 of 322 tests pass. Without the guard, 6 of the new tests fail.

What changed:
- POST, PATCH and DELETE on `/v1/team-members` now need the `x-internal-api-key` header, like every other write route. GET stays open. Before this, anyone could create, edit or permanently delete team members. Nothing in the frontend or the MCP server calls these routes, so no client breaks.
- The key comparison is constant-time. Both values are hashed with SHA-256 and compared with `timingSafeEqual`, and a header that is not a string is rejected.
- The backend logs a warning at startup when `INTERNAL_API_KEY` is unset. Before, every write answered 401 with nothing in the logs.
- `api.md` and the README now say all writes need the key. The "known gap" note is gone.

Deploy: the Render API needs a redeploy after this merges. `INTERNAL_API_KEY` is already set there.

## Agent results

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS | Guard runs after body parsing and before validation and queries. Docs match the code. |
| security-auditor | WARN, then PASS | First run: every write route is guarded, but the key comparison used `!==`. Fixed with `timingSafeEqual`. Re-audit: no bypass or throw path, the warning leaks nothing. |
| debugger | PASS | Full suite passes, no leaked handles, mocks restored. |
| test-writer | PASS | Changed lines 100% covered. Added tests for 422 and for PATCH on a missing member. |
| refactorer | WARN | The auth tests repeat part of `registerAuthGateTests`. Kept, because the helper builds master-data servers and does not cover wrong keys. |
| doc-writer | WARN | The old report listed the gap as open. This report replaces it. |
| silent-failure-hunter | WARN | Unset server key was unlogged. Fixed with the startup warning. |
| pr-test-analyzer | PASS | Tests assert status, code and that no query ran. |

Subagent file-existence claims: none that needed a cross-check.

## Open WARN items

- [ ] A client built without `VITE_INTERNAL_API_KEY` sends an empty key and gets a plain 401 (frontend and MCP client).
- [ ] `GET /:id` on team members has no test, and `DELETE`/`GET` with a malformed id return a logged 500.
- [ ] The shared key is still visible in the frontend bundle. Real login is the fix (CLAUDE.md §20).
- [ ] A whitespace-only `INTERNAL_API_KEY` counts as set.
