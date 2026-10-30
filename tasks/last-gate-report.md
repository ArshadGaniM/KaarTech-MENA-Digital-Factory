# Gate Report: Control Center factory floors from the database

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean)

**Branch:** `claude/sleepy-hopper-bpow3i` to `main`
**Scope:** `git diff origin/main..HEAD`. The Control Center page shows the MENA Digital Factory as floors (departments) with a box per team. Department names and team codes are read from the `departments` and `teams` tables through the new `useFactoryData` hook.
**Checks run after the fixes below:** frontend 174/174 tests, `vite build` clean, no lint warnings in changed files.

## Agent results

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | WARN | No Critical. Hardcoded floor list, fallback label, fetch size (see checklist). |
| security-auditor | PASS | Backend values rendered as text only. No new write path or secrets. |
| debugger | PASS | Missing department, missing teams and soft-deleted rows verified. Tests and build run. |
| test-writer | PASS | About 95% of changed logic covered (estimate, no coverage tool run). |
| refactorer | PASS | Soft-delete check now appears in three files (optional). |
| doc-writer | WARN | Stale README line and two comments, fixed below. |
| silent-failure-hunter | WARN | Missing-department floor looked normal, fixed below. |
| pr-test-analyzer | WARN | Test gaps, fixed below. |

Subagent verification rule (CLAUDE.md §8): no agent made a negative file-existence claim that needed a cross-check. Eight agents ran on `sonnet` because the `deep` and `fast` model aliases in their definitions do not exist here.

## Fixed in this push

- A floor whose department is missing now reads "DEPT-xxx (department not found)" instead of a bare code.
- `mcp-server/README.md` describes the factory view. Comments added for the hook's return shape and for why `factoryLayout.js` is the list of floors.
- Tests: either table failing to load, both tables empty, the missing-department label, and an AppShell check that the factory renders.

## Open (not blocking)

- [ ] `factoryLayout.js` hardcodes ten department codes. A department or team outside the list is not shown.
- [ ] "No teams yet" also appears when team rows carry a department code that matches no floor. The teams table is empty today.
- [ ] Soft-delete check `markedDeleted !== 'Yes'` appears in three files. Share it in a follow-up.
- [ ] The view loads once when opened and does not refresh on its own.
- [ ] The old per-table health and Open buttons are gone from Control Center. Dashboard still shows counts.
