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
- Tests for month boundaries, the stream cap, caching, reconnects, month switching and the new components.

## Open (not blocking)

- [ ] Migration `0023_control_center_notify.sql` is NOT applied. Until it is, live updates arrive through the 30 second refresh instead of instantly.
- [ ] The open team popup loads once and does not refresh while open. It has no focus trap.
- [ ] The stream and read routes are unauthenticated and the 100-stream cap is global, not per client.
- [ ] Without `DATABASE_SSL_CA`, database TLS is still unverified (unchanged default).
- [ ] The ten department codes are a fixed list in `factoryLayout.js`.
- [ ] The backend defaults to the UTC month and the page to the local month. The page always sends the month.
- [ ] Frontend and backend deploy separately. The page shows an error until the backend redeploy finishes.
