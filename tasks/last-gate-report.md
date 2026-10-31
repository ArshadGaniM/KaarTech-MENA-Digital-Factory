# Gate Report: database and API rules rewritten for the real backend

Verdict: ⚠️ WARN (no FAIL on this diff, no Critical). One older security gap in the live API is listed below. It is not part of this diff.

Scope: `.claude/rules/database.md`, `.claude/rules/api.md` (rewritten for Express, `pg` and Postgres), `backend/README.md` (four wording fixes), `CLAUDE.md` (§2, §7.4 stage 4.16, §14), `.claude/agents/dev-team/language-framework-specialist.md`, and the docstrings of `scripts/register_agent.py` and `scripts/register_skills.py`. No executable code changed. An AST comparison of both scripts with docstrings removed shows them identical to `main`.

What changed:
- The rules describe what the backend does: plain SQL migrations, soft delete, live-row indexes, bound parameters, advisory-lock transactions, `ApiError`, descriptor-driven routes, the shared write key, the stream cap, and a testing section for `node:test`.
- Stage 4.16 now checks promises, awaits, PropTypes and module boundaries, not Python habits.
- §14 says the registration scripts write local JSON files and never call the backend.
- The README no longer says writes go only through the MCP server, and no longer says "ORM".

## Agent results

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Four wrong claims in the rules: team-members auth, where errors are mapped, malformed ids, soft-deleted reads. All corrected. |
| security-auditor | PASS | No secrets. SQL, auth, CORS and migration-password wording is no weaker than before. |
| debugger | PASS | Scripts parse, only docstrings changed, tables and fences well formed, references resolve. |
| test-writer | PASS | No behaviour changed. |
| refactorer | WARN | README contradicted the rules on who sends the write key and on grants. Fixed. Duplicated statements left, they agree with each other. |
| doc-writer | WARN | `ck_` naming caveat, team-members exception and unset-key 401 added. |
| silent-failure-hunter | WARN | Postgres errors are mapped in `mapWriteError`, not the central handler. Fixed. |
| pr-test-analyzer | PASS | Claimed stale "forward-looking" banners and a stale §0 line. HALLUCINATED → manual: PASS (grep finds neither). Its testing-section suggestion was taken. |

## Older gap found by the review (not in this diff)

- [ ] **`/v1/team-members` writes need no key.** `backend/src/routes/teamMembers.js` has POST, PATCH and DELETE with no `requireInternalApiKey`, and DELETE removes the row for good. Nothing in the frontend or the MCP server calls these routes. The rules now name it as a known gap. Fixing it changes live behaviour, so it needs the owner's decision: add the key check, or remove the writes.

## Open WARN items

- [ ] `GET /:id` and `DELETE /:id` with a malformed id return a logged 500. PATCH and restore return 422 under the key `value`. Documented in `api.md`.
- [ ] `backend/src/errors.js` falls back to the field name `value` without logging the constraint. A rollback failure in `withAllocationLock` is swallowed without a log.
- [ ] A check violation (23514) is not mapped and returns a 500.
- [ ] `mapWriteError` is local to the master-data router.
- [ ] If `INTERNAL_API_KEY` is unset on the server, every write returns the same 401 as a wrong key, with no server log.
- [ ] CORS, `DATABASE_SSL_CA` and the stream cap are described in several files. They agree.
- [ ] The two registration scripts have no tests.
