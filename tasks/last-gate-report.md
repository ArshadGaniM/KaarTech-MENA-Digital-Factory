# Gate Report: Competency practice, Control Center by practice, Back to the portal link

**Verdict: WARN** (zero FAIL, zero Critical. One accepted security limitation, noted below.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main was merged into the branch before the gate. Main's only new commit was the squash of this branch's earlier work (PR #61), and its tree was identical to the branch's earlier commit, so the six conflicted files were resolved to this branch's side, which loses nothing from main.
**Scope:** `git diff origin/main..HEAD`.
- Every competency belongs to one practice: migration 0033 (applied live, the 29 competencies mapped from the owner's list), a required `practiceId` dropdown from the Practices table, a read-only `practiceName` column.
- The Control Center groups cards by practice (a team's practice is its main competency's practice), in practice code order with no practice last. Inside a practice, teams with no current assignment come first, then the earliest assignment end date.
- The Control Center title is back in the top bar, and a Back to the portal link tops the sidebar.
**Checks on the final code:** backend 413/413, mcp-server 57/57, frontend 473/473 tests, `vite build` clean. Migration 0033 was checked on the live database: every practice holds exactly the competencies the owner listed.

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Two `h1` headings on the Control Center, grouping by name instead of code, name uniqueness |
| security-auditor | PASS on new defects | Static read-only query, safe migration. Only the accepted limitation |
| debugger | WARN | Deploy order, migration prerequisites (already met), name uniqueness |
| test-writer | WARN | `formLabels`, navigation pass-through and MCP competency lacked tests |
| refactorer | PASS | Group by practice code, not name |
| doc-writer | PASS | Migration row order only |
| silent-failure-hunter | WARN | A team silently falling into No practice when its practice was deleted |
| pr-test-analyzer | WARN | PATCH success, restore with a deleted practice, several competencies, undefined practice name |

All eight agents ran on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed in this push

- A practice cannot be deleted while live competencies belong to it (409 `practice_in_use`, a `deleteGuards` entry on the practices descriptor, checked inside the delete itself). Without it, deleting a practice silently moved its teams to No practice.
- The Control Center logs one warning per competency name that has no live practice, instead of silently grouping its teams under No practice.
- The floor groups by practice code and shows the name, so two practices with the same name cannot merge.
- The Control Center roof is an `h2`, so the page has one `h1` (the top-bar title).
- A live competency name is unique (migration 0034, not yet applied), because the practice lookup and positions find a competency by name.
- Tests added: `formLabels` in the form, the navigation pass-through, MCP competency requires a practice, PATCH success, restore with a deleted practice, a duplicate name, the practice delete guard (blocked, allowed, not found), a team with several competencies, the warn-once log, an undefined practice name, grouping by code.
- The README migration list is in order and documents the delete guard and 0034.

## Accepted, not fixed

- **Client-side password (Low, owner-accepted).** Reads stay open and the write key is in the bundle (CLAUDE.md §20). It is not access control.
- Migration 0033 has no explicit transaction. It was applied through the Supabase tool, which wraps it, and it is already applied.
- Deploy order matters slightly: the frontend finishes before the backend, so for a minute the floor would show every team under No practice until the backend redeploys. Cosmetic.

## Action items

- [ ] Owner: yes to apply migration 0034 (unique live competency name). The code does not need it.
- [ ] After merge: run the §21 deployment check. Trigger the Render deploy if none starts. Migration 0033 is already applied.
