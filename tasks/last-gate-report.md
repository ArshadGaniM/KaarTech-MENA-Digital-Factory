# Gate Report: allocation percentage on project assignments, one team pop-up, Layers and Tree views, PM 5 name

**Verdict: WARN** (zero FAIL, zero Critical. Security: no exploitable finding, one low item fixed.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was up to date.
**Scope:** `git diff origin/main..HEAD`, changes 17 to 22.
- A team can be on several projects at once. Each assignment has an allocation percentage (0.01 to 100, at most 2 decimals, never null). On any one day the live assignments of a team may not add up to more than 100, and a team may not hold the same project twice. A 422 names the day and how much is left. Left out, the percentage is 100, so older clients still work.
- The team pop-up lists every project in a card with its percentage, Planned Utilization, Utilized Team Monthly Cost and Utilized Team Total Cost, with Edit and Delete Project Assignment on each card. A month's utilization is the average of the daily totals.
- One team pop-up for Control Center and Organization Structure (team cards open it), with a month picker inside it.
- Organization Structure has three views: Cards, Layers (the old Tree) and a new Tree hierarchy chart. Yasam Panidhar is ODC Project Manager 5.

**Migrations (applied to the live database before the backend deploys):**
- 0040, safe: the column (the 30 live rows took 100), its range check and the same-project exclusion constraint. Live data was checked first: no same-project overlap, no null dates.
- 0041, owner-approved on 12 Nov 2026: drops the old one-project-at-a-time constraint.
- Both were also run on a throwaway Postgres.

**Checks on the final code:** backend 571/571, mcp-server 59/59, frontend 902/902, `vite build` clean, oxlint has no errors.

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | PATCH with null gave a 500 (fixed). Rounding on 3 decimals (fixed). Wrong migration number in a comment (fixed). Stale README text (fixed) |
| security-auditor | WARN | No exploitable finding. Same PATCH null 500 (fixed). Parameters bound, no new HTML sinks |
| debugger | WARN | Same PATCH null 500 (fixed). Several projects, truncation, older backend and refresh paths walked, no other failure |
| test-writer | WARN | Every behaviour has a test. PATCH range and decimals now tested too |
| refactorer | WARN | Month loop shared (fixed). Project card moved to its own file. Unused parameter removed |
| doc-writer | WARN | Five README and comment fixes made |
| silent-failure-hunter | WARN | Last month's figures no longer show under a new month. Add form starts empty outside the current month |
| pr-test-analyzer | WARN | Tests added for the 100 cap, the 120 month cut, the peak-day case and teamTotalAllocation |

All agents ran on Sonnet and edited no file. I checked the tree was clean before the fixes.

## Fixed during the gate

- PATCH of `allocationPercentage` with null, or with more than 2 decimals, is now a 422 and not a 500.
- The month picker no longer shows the last month's team under the new month's heading while it loads or after a failed load.
- The Add form starts the percentage on what is left today, but only in the current month.
- The README now describes the several-projects rule, the new project fields and the weighted utilization.

## Open, not blocking

- [ ] The 100% per day rule is checked in the API under a per-team lock. The database has no backstop for the sum, only for the same project twice.
- [ ] If saved percentages ever add to more than 100 on a day, utilization is capped at 100% and nothing flags it.
- [ ] The Analytics Projects tab still counts a day once when assignments overlap and ignores the percentage.
- [ ] `TeamDialog.jsx` is still about 480 lines.
- [ ] The new screens, including the Tree view, have not been checked in a browser.
- [ ] Names for PM 1, 2, 3, 6 and 7 are still TBD.
