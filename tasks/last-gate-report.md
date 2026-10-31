# Gate Report: department floor number, floors from data, live team popup

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean)

**Branch:** `claude/sleepy-hopper-bpow3i` to `main`
**Scope:** `git diff origin/main..HEAD`, with `main` merged in first (a real merge, not a "keep mine" merge). Departments get a required, unique `floor_number` from 1 to 1000 (migration 0025, applied to the live database before this merge). The Control Center building is built from the departments table, top floor first, and the fixed list in the code is gone. The open team popup refetches with the page and says so when a refresh fails. The Departments table, form and MCP tool carry the new field.
**Checks run after the fixes below:** frontend 236/236, backend 297/297, mcp-server 54/54 tests, `vite build` clean, no lint warnings in changed files.

## Agent results (round 2, after round 1 fixes)

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | PASS | Migration safe and correct. Upper bound present in every layer. |
| security-auditor | PASS | No findings. Out-of-range values are a 422, not a database 500. |
| debugger | PASS | Migration run against 13 live rows. Deploy order must be migration, backend, frontend. |
| test-writer | PASS | About 90% or more in all three packages (backend and mcp-server measured). |
| refactorer | WARN | Popup repeats the page's live-status logic. Nested ternaries. Optional. |
| doc-writer | WARN | Three small README gaps, fixed below. |
| silent-failure-hunter | PASS | Popup no longer says Live during a failed page refresh. |
| pr-test-analyzer | PASS | Round 1 test gaps closed. |

Round 1 returned FAIL from security (no upper bound on `floorNumber`, so a huge value reached the database and returned a 500). It was fixed in every layer and the migration. Subagent verification rule (CLAUDE.md §8): no agent made a negative file-existence claim that needed a cross-check. Eight agents ran on `sonnet` because the `deep` and `fast` model aliases in their definitions do not exist here. The agents ran against a branch that was behind `main` in round 1 (PRs 46 and 48), which one of them spotted, so `main` was merged properly and the whole gate was run again.

## Fixed in this push

- `floorNumber` is capped at 1000 in the descriptor, the MCP mirror, the form, the entity metadata and a database check.
- The team popup shows "Could not refresh, showing the last data" when the page's own refresh fails, instead of "Live".
- The popup takes one timestamp prop instead of two, and the department sort exists once.
- Backend README: whole-number field options, the swap-floors note, migration rows in numeric order, 101-and-up parking. MCP README lists `floorNumber`.
- Tests: edit validation (fraction, zero, over 1000, null, omitted, collision), metadata, a `validateBody` unit test, the MCP tool, the popup failure case.

## Open (not blocking)

- [ ] The popup repeats the page's "live" status logic. Share one helper.
- [ ] `FactoryFloor` hides the floor number when the backend does not send one. That is deliberate for the short window where the new page meets the old backend.
- [ ] No test runs the migration against a real database.
- [ ] A restore that clashes on a floor gives the generic "already in use" message.
- [ ] Moving two departments between floors takes two edits through a spare number.
