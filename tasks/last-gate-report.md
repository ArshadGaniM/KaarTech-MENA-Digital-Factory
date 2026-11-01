# Gate report: FEAT-41, Dashboard round 4 (Forecast tab and monthly snapshots)

Verdict: WARN

| Agent | Result |
|---|---|
| code-reviewer | WARN |
| security-auditor | PASS |
| debugger | WARN |
| test-writer | WARN |
| refactorer | WARN |
| doc-writer | WARN |
| silent-failure-hunter | WARN |
| pr-test-analyzer | WARN |

No Critical and no FAIL finding. Backend 496 tests and frontend tests pass.

## Fixed in this push
- README: migration 0037 row, snapshot fields, section intro, meaning of `rows`, free-plan sleep limit.
- Chart relabelled "Deployments ending soon", because it counts deployments.
- Forecast tab now uses the tested `allocationPercentOf` and `utilizationPercentOf` helpers. Unused export removed.
- New tests: saved against booked months with data, grouping by seat type, wrong key on POST, every bound parameter count of the upsert.

## Open WARN items
- [ ] A snapshot row for a team or seat type that later disappears in the same month stays until the month ends.
- [ ] On Render's free plan the 6-hour timer stops while the service sleeps. An outside scheduler can call the POST route.
- [ ] `taken_at` is not returned, so the page cannot show how old a saved month is.
- [ ] The browser uses local time for today and the backend uses UTC. The gap shows for a few hours around a month change.
- [ ] Date helpers repeat between ForecastTab and ProjectsTab.
- [ ] Frontend coverage is not measured.
