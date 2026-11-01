# Gate report: FEAT-39, Dashboard analytics round 2

Verdict: PASS with WARN items

Branch `claude/dreamy-knuth-76pnsa`, diff `origin/main..HEAD`. Main was already an ancestor, so no merge was needed. No migration.

## What changed

- Two new Dashboard tabs. Structure has 8 visuals: team size, department structure, position mix per team, competency coverage by team, competency demand, practice portfolio, departments by floor and department input and output. Projects has 8: assignment timeline, active projects and teams by month, teams per project, share of each month covered, work by profit center, assignment length, assignments ending soon and teams with no project in a month.
- Three new read-only routes under `/v1/analytics`: `/structure`, `/catalog` and `/assignments`. The page slices their rows in the browser.
- The treemap is replaced by proportional tiles, in the Workforce tab as well, because the treemap drew only one block.

## Agents

| Agent | Result | Notes |
|---|---|---|
| code-reviewer | WARN, 0 Critical | Fixed: Gantt axis labels thinned and capped, coverage grouped once per team, heatmaps keep every team when one is picked, slicer values include teams with no assignment, assignments of deleted teams left out |
| security-auditor | PASS | No findings. SQL has no request data, CSV cells are defused, no raw HTML. One low item fixed: the Gantt month axis is capped |
| debugger | PASS | No crash path. Fixed: the "ending soon" window used the UTC date while the month used local time |
| test-writer | PASS | Backend 95 to 100 percent measured. Frontend estimated above 75 percent |
| refactorer | WARN, 0 Critical | Fixed: month options shared, repeated filter pass and team collapse computed once, one needless export removed |
| doc-writer | WARN | Fixed: catalog `name` and team rows documented, stale intro and header, WHY comments |
| silent-failure-hunter | WARN | Fixed: a team with no position is now listed as having no project, Teams per project keyed by project id, the swallowed chunk error is logged |
| pr-test-analyzer | WARN | Added: Gantt geometry, load gate refresh banner, idle list slicers and focus clamp, position mix, floor order, grid limits, tie order, 90 day boundary |

Subagent verification rule (CLAUDE.md section 8): no agent made a negative existence claim that held.

## Checks run

- Frontend: 74 files, 732 tests pass
- Backend: 473 tests pass
- Build: clean. The charts stay in lazy chunks
- Lint: no warnings in the changed files
- Mutation checks: Gantt position, busy teams from all assignments, the ending soon boundary, the position mix columns and the project key each fail a test when reverted
- Browser check: both tabs rendered in Chromium with live data, no console errors
- SQL: the final catalog and assignments queries run on the live database (91 teams, 29 competencies, 10 practices, 14 departments, 1 module, 29 assignments). The route tests inject the query, so they do not run the SQL (api.md asks for this check)

## Remaining WARN items (not blocking)

- [ ] Frontend coverage is estimated, not measured. No coverage provider is installed
- [ ] The month range slicers are written twice, in the Allocation and Projects tabs
- [ ] `/structure`, `/catalog` and `/assignments` are unbounded whole datasets, allowed by api.md for `/v1/analytics`
- [ ] A project with a deleted project row shows its id as its name
- [ ] Tab buttons have no arrow-key handling
- [ ] Router tests use their own copy of the error handler

## Notes for the owner

- The Render backend must deploy before the new tabs show data. The Vercel frontend deploys by itself.
- Rounds 3 and 4 stay queued as FEAT-40 and FEAT-41.
