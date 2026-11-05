# Gate Report: Add Position and Delete Position in the team pop-up, one Module Lead seat per team

**Verdict: WARN** (zero FAIL, zero Critical. Security PASS.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was up to date.
**Scope:** `git diff origin/main..HEAD`.
- **Add Position:** A button in the team pop-up opens the shared create form. The team is locked and filled in, and the team's department and competencies show as context. The Competencies field is pre-filled (capped at 500 characters) and stays editable.
- **Delete Position:** Every seat has a "Delete Position" button that opens the shared delete popup with the seat pre-selected. A position with a current or future deployment is refused with "Unassign the person first" (409 `position_in_use`). Ended deployments do not block it.
- **One Module Lead seat per team:** The backend refuses a second live seat whose name starts with "Module Lead" on create, rename, move and restore, inside a per-team lock. TEAM-087, TEAM-088 and TEAM-089 hold 24 seats today and are the exception.

**Migration 0039** (one partial unique index, the backstop for that rule) was applied live under the standing yes after a live data check: no team outside the three exempt teams held two Module Lead seats. It is verified in the live index list.

**Checks on the final code:** backend 553/553, mcp-server 58/58, frontend 850/850, `vite build` clean, oxlint has no errors.

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | No Critical. Competencies pre-fill could pass 500 characters (fixed). Delete popup loads every position |
| security-auditor | PASS | No findings. SQL from constants and bound parameters, no constraint name leaked |
| debugger | PASS | All flows walked. Two low notes |
| test-writer | PASS | Every new behaviour has a test. Backend 548, mcp 58, frontend 849 at that point |
| refactorer | WARN | No duplicated logic. `TeamDialog.jsx` is 441 lines. The Module Lead name test is written several ways |
| doc-writer | WARN | One stray table cell in the MCP README (fixed) |
| silent-failure-hunter | PASS | No swallowed error. Two low notes |
| pr-test-analyzer | WARN | Two mutations survived (empty exempt list, seat self-exclusion). Tests tightened |

All agents ran on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed during the gate

- The exempt-team test looped over the constant it checks. It now hard-codes the three teams and compares the list to the migration.
- The seat self-exclusion is now exercised by a stateful fake, and a test checks the migration's index name and exempt list match the code.
- PATCH and restore lock tests, a rename away from Module Lead, and an exempt-team PATCH were added.
- The Add Position competencies pre-fill is capped at 500 characters and keeps whole names in order.
- The MCP README table row has three cells.

## Open, not blocking

- [ ] Deleting a position whose only deployments have ended hides that seat's past cost and hours from earlier months. Restore brings it back.
- [ ] The Delete Position popup loads every position to find one code. A single lookup by code would be cheaper.
- [ ] `TeamDialog.jsx` is about 440 lines. The Add and Delete Position block could become its own component.
- [ ] The exempt-team list lives in the code and in the migration. A test now checks they match, but a change needs both.
- [ ] Renaming a seat into or out of Module Lead while a person is deployed does not recalculate the Module Lead percentages until the next deployment write.
