# Gate report: FEAT-40, Dashboard analytics round 3

Verdict: PASS with WARN items

Branch `claude/dreamy-knuth-76pnsa`, diff `origin/main..HEAD`. Main was already an ancestor, so no merge was needed. No migration.

## What changed

- Three new Dashboard tabs. Cost has 7 visuals: monthly allocated cost, cost by team, onsite against offshore, planned against actual cost per designation, planned cost by grade, where the cost figures come from, and cost for each allocated hour. Plan has 5: weeks planned against weeks taken, percent complete by group, plan progress by week, activities behind plan, and activities by status. Data health has 3: live and deleted rows per table, rows added each week, and how completely resources are filled in.
- Backend: every seat now carries its monthly onsite and offshore cost and how many people were costed from an actual cost, a planned cost, the Senior Consultant default or nothing. The catalog gains planned and actual cost rows. A new read-only `/v1/analytics/health` route returns row counts, weekly additions and blank resource fields.
- The initiative plan data is only read. `src/data` is untouched.
- Visual 54 of the suggestion list (a live change feed) is not built. The Control Center stream sends only "changed", with no table name, so a feed would say nothing useful.

## Agents

| Agent | Result | Notes |
|---|---|---|
| code-reviewer | 1 Critical, now fixed | The weekly date reached the browser as a full timestamp. Cast to text in the SQL and covered by a test. Also noted and left as is: the cost of a seat with two overlapping deployments is a data rule the database already blocks |
| security-auditor | PASS | No findings. Table names come from descriptors, no request data reaches the SQL. The cost figures were already readable on `/v1/planned-resource-costs` and `/v1/resource-cost`, so the exposure is not new |
| debugger | WARN | Same date bug (fixed). Fixed: designation matching ignores case and spaces, a seat from an older backend counts as 0 instead of NaN. The generated health SQL was also run against a local Postgres copy of the migrations and executes |
| test-writer | PASS | Backend 96 to 100 percent measured. Frontend estimated at 75 to 80 percent |
| refactorer | WARN, 0 Critical | Fixed: the plan average is renamed, the cost helper is shared. Deferred: the older Allocation and Projects tabs still carry their own month range code |
| doc-writer | WARN | Fixed: route list, intro, blank field list, WHY comments |
| silent-failure-hunter | WARN | Fixed: recorded progress shows a dash where none is recorded, a missing actual cost shows a dash not 0, weeks with no additions are filled in as 0, a caveat counts people costed by default or with no cost, a team with people but no cost is shown as 0 |
| pr-test-analyzer | WARN | Added: two occupants in one seat, missing and default cost people, one-sided actual cost, the 12 week cut, top six stack, focus month, plan before week 1, week 1, week 2 and after week 65, one blank never reading as complete |

Subagent verification rule (CLAUDE.md section 8): the agents saw uncommitted edits while fixes were in progress. That was true at the time (CONFIRMED) and is resolved by the commit before this report.

## Checks run

- Frontend: 78 files, 772 tests pass
- Backend: 484 tests pass
- Build: clean. The new tabs stay in lazy chunks
- Lint: no warnings in the changed files
- Mutation checks: the filled percent rounding, the filled seats filter, the top six cut, the after-plan summary, the recorded dash and the grade order each fail a test when reverted
- Browser check: the three tabs rendered in Chromium with live data and no console errors
- SQL: the cost and health queries ran on the live database. Route tests inject the query, so they do not run the SQL (api.md asks for this check)

## Remaining WARN items (not blocking)

- [ ] Frontend coverage is estimated, not measured. No coverage provider is installed
- [ ] The Allocation and Projects tabs keep their own month range code. The shared `useMonthRange` is used by Cost only
- [ ] `/v1/analytics/health` is one query of 38 branches that scans each table, with no limit. It is fine at this size
- [ ] The people count in "where the cost figures come from" counts one person once for each seat they hold
- [ ] Control options not covered by a test: several Cost stack and cost type choices and the health Fields control

## Notes for the owner

- No actual costs and no plan progress are recorded yet, so those charts show dashes until you enter them.
- The Render backend must deploy before the new tabs show data. The Vercel frontend deploys by itself.
- Round 4, the forecast with a monthly snapshot table, stays queued as FEAT-41.
