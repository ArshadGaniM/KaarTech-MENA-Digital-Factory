# Gate report: FEAT-38, Dashboard analytics round 1

Verdict: PASS with WARN items

Branch `claude/dreamy-knuth-76pnsa`, diff `origin/main..HEAD`. Main was already an ancestor, so no merge was needed.

## Agents

| Agent | Result | Notes |
|---|---|---|
| code-reviewer | WARN, 0 Critical | 4 warnings fixed. Skill mix wording, team grouping by code, filters hidden across tabs, doubled panel class |
| security-auditor | PASS | No findings. SQL is a constant string, range input is validated, compression is scoped to /v1/analytics, CSV formula cells are defused |
| debugger | WARN, 0 Critical | Hidden cross-tab filters fixed. Stale filter value now stays in the list. Sunburst values keep one decimal |
| test-writer | PASS | Backend 97 to 100 percent measured. Frontend estimated above 70 percent, not measured, no coverage provider installed |
| refactorer | WARN, 0 Critical | Shared month helpers, one seat-hours rule, shared `indexBy`, unused seat fields removed, practice per team computed once |
| doc-writer | PASS | Routes match the code field by field. The `api.md` contradiction was fixed |
| silent-failure-hunter | WARN, 0 Critical | Loading and failed states no longer read as "nothing matches". Missing months break the line. Stale-data banner says so. Stale chunk after a deploy shows a message with a reload button |
| pr-test-analyzer | WARN | Tests added for cross-tab chips, vacant ranking, tiles, same-name teams, loading and failed seats, line gaps, focus clamp, sunburst tree, chart toggle, router ranges and defaults, stale chunk. Weak assertions tightened |

Subagent verification rule (CLAUDE.md section 8): no agent made a negative existence claim that held. The code reviewer's note that the fixes were uncommitted was true at that moment and is now resolved (CONFIRMED, then fixed).

## Checks run

- Frontend: 69 files, 652 tests pass
- Backend: 466 tests pass
- Build: clean. The charts library is a separate lazy chunk (493 kB, 137 kB gzipped)
- Lint: no warnings in the new files
- Mutation checks: each fix above fails a test when reverted
- Browser check: both tabs rendered in Chromium with no console errors, against a local stub built from live data

## Remaining WARN items (not blocking)

- [ ] Frontend coverage is estimated, not measured. Install `@vitest/coverage-v8` to measure
- [ ] Chart bar and slice clicks cannot run in jsdom. Heatmap and tiles cover the click path
- [ ] `AllocationTab.jsx` is long. Moving the month pivots into `analyticsData.js` would shorten it
- [ ] Tab buttons have no arrow-key handling yet
- [ ] `PEOPLE_SQL` uses the database date and seats use the UTC date, which can differ for a few hours around midnight
- [ ] Router tests use their own copy of the error handler
- [ ] `npm audit` reports body-parser and qs in the backend. Both predate this change

## Notes for the owner

- Org chart is empty on every resource, so the treemap uses sub division
- Employment status has a single value, so the two-way grid uses employment type by region
- All 98 deployments are at 100 percent, so the allocation spread shows one band until partial allocations exist
- Rounds 2 to 4 are queued as FEAT-39 to FEAT-41
