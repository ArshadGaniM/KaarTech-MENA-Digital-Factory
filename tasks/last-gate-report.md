# Gate Report: automatic Module Lead allocation, inline department detail, team pop-up actions

**Verdict: WARN** (zero FAIL, zero Critical after round 2.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was up to date.
**Scope:** `git diff origin/main..HEAD`.
- ODC Delivery Manager is Mohammed Ibrahim S. ODC Project Manager 3 is Karthikeyan Rajendran.
- Organization Structure: a department opens its practices, module leads and teams below the cards, not in a side pop-up. Selecting the same item again closes it. Selecting a level above clears everything under it.
- Module Lead allocation is calculated by the backend for every practice. A team's share is its filled Lead Consultant and Consultant seats over the filled seats of all that Module Lead's teams, rounded down to two decimals. The leftover goes to the team with the fewest filled seats among those with one. With no filled seat every share is 0. A Module Lead cannot hold other seats. Module Lead seats may hold 0%.
- Team pop-up: friendlier Projects block, readable dates, the viewed month shows "No assignment" and 0% after a project ends, Assign on vacant seats, Unassign on filled seats, and Delete Project Assignment while a project runs.

**Data and migration:** Migration 0038 (replaces the allocation check with 0 to 100) was applied live with the owner's yes and verified. Mohanraj C (ID 758) was entered as Module Lead of TEAM-015 to TEAM-025 with the calculated shares, which total 100.00.

**Checks on the final code:** backend 532/532, mcp-server 58/58, frontend 839/839, `vite build` clean, oxlint has no errors. The new Module Lead SQL also ran against a real Postgres 16 (three teams, a repair run and a sibling write).

## Agents (round 2, after the round 1 fixes)

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS | Both Criticals closed. Warned about a team with no filled seat getting the leftover (fixed) |
| security-auditor | PASS | No injection, cap bypass or secrets. The guards against extending an ended record are in the client only, as before |
| debugger | PASS | Past, current and future months walked. Two small UX notes |
| test-writer | PASS | About 95% behaviour coverage |
| refactorer | WARN | `TeamDialog.jsx` is still large. Two copies of the transaction block |
| doc-writer | WARN | One stale README line (fixed) |
| silent-failure-hunter | WARN | Delete form hid 422 details and ended seats had no tag (both fixed) |
| pr-test-analyzer | PASS | Two mutations of the fixed Critical were caught |

Round 1 had two Critical findings from two reviewers: Unassign and Delete Project Assignment could push the end date of an already-ended seat or project into the future when a past month was viewed. Both are fixed. All agents ran on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed during the gate

- Unassign shows only on a running seat and the helper refuses an ended one. Delete Project Assignment targets the first project that has not ended, the form is tied to that project, and its end date is limited to the project's dates.
- Person search clears stale matches, says "No people found", and shows failures. Unassign shows disabled with a reason when an old backend sends no deployment id. An old error banner clears on the next reload.
- The Assign form leaves the end date empty when the team's latest end is already past.
- Boundary-day tests, the exclusivity query dates, the 100% cap path and the restore recalculation now have tests.
- A team with no filled seat stays at 0 when the leftover is shared out.

## Open, not blocking

- [ ] Shares recompute only when a deployment is written. A seat that ends or starts later does not recalculate by itself. Run `node src/recalculateModuleLeads.js` after the deploy and after a date rollover. Documented in `backend/README.md`.
- [ ] Two opposite employee moves at the same moment can deadlock, and Postgres aborts one. A retry works.
- [ ] `TeamDialog.jsx` is still about 390 lines. The transaction block is written twice (`withGroupLock` and the repair function).
- [ ] The guards against extending an ended record are in the client. The API still accepts any valid end date through the generic edit form.
- [ ] After the backend deploys, run the one-off repair once so every Module Lead row matches the rule.
