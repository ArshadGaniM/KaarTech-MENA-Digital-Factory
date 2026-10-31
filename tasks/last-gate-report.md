# Gate Report: CLAUDE.md matches the real backend and hosting

Verdict: ⚠️ WARN (no FAIL, no Critical, security PASS)

Scope: `CLAUDE.md` (sections 0, 3, 5, 10, 11, 20, 21, 23), `.claude/rules/api.md`, `.claude/rules/database.md`, `.claude/hooks/pre-commit.sh` (one comment), `.env.example`, `tasks/lessons.md`. Documentation only. No code changed.

What changed:
- Section 21 now lists the real platforms with IDs read from the Vercel and Render accounts, a deploy check that confirms the merge commit's deploy is live, and two known issues.
- The "no backend, no database, no deployment" statements are gone from sections 0, 10, 11, 20 and 23 and from the rule-file banners.
- Section 20 matches the variables the backend and frontend read (`DATABASE_URL`, `DATABASE_SSL_CA`, `INTERNAL_API_KEY`, `FRONTEND_URL`, `PORT`, `NODE_ENV`, `VITE_BACKEND_URL`). Unused `SECRET_KEY`, `BACKEND_URL` and `REDIS_URL` are removed.
- `api.md` documents the shared-key write auth as a deviation.

## Agent results

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Broken table, stale lines, `FRONTEND_URL` is a list. All fixed. |
| security-auditor | PASS | IDs are identifiers, not credentials. No secrets. |
| debugger | WARN | Broken table fixed. Migration timing now says before the backend deploy. Step 7 names an example route. |
| test-writer | PASS | Docs only, nothing to test. |
| refactorer | WARN | Broken table and two stale phrases. Fixed. |
| doc-writer | WARN | Fixed items 1 to 7 and the api.md auth deviation. Items 8 and 9 stay open. |
| silent-failure-hunter | WARN | Check now requires the merge commit's deploy to be live, and an unanswered migration leaves the check incomplete. |
| pr-test-analyzer | PASS | Docs only. |

Subagent file-existence claims: none that needed a cross-check. Agents could not verify the platform IDs from the repo, so they were read from the Vercel and Render accounts directly.

## Open WARN items

- [ ] `.claude/rules/database.md` is written for Python and an ORM (Base class, uuid4 keys, autogenerate, a Python example). The backend uses plain SQL migrations and `pg`. Rewrite the examples.
- [ ] `.claude/rules/api.md` still uses placeholder resources and Python-style names.
- [ ] Section 7.4 stage 4.16 and the frontend rules still assume Python and async frameworks.
- [ ] Section 14 registration scripts target an agent registry that does not exist yet.
