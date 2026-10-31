# Gate Report: FEAT-25, Dashboard charts, count-up tiles, click-to-filter and refresh

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean in both rounds)

**Branch:** `claude/dreamy-knuth-76pnsa` to `main`
**Scope:** `git diff origin/main..HEAD`, rebased onto `main` at `458c73f` (after the Control Center rebuild and the table search bar from other sessions). New generic backend route `GET /v1/<table>/summary?groupBy=<field>` (grouped counts of live rows, equality filters, a separate count query for an accurate total, bound parameters, 422 for unknown names and NUL bytes). Frontend: `fetchGroupSummary`, `useGroupSummary`, `useCountUp`, `AnimatedNumber`, `DonutChart`, `ResourceInsights` (two charts that filter each other), a Refresh button with Try again on the Dashboard, and central chart colour tokens.
**Checks after the fixes below:** frontend 296/296 tests, backend 307/307 tests, `vite build` clean, no new lint warnings in changed files. Checked in a real browser at 1280px and 390px with the API mocked.

## Gate rounds

The gate ran twice. Round 1 reviewed the code before the rebase. Round 2 reviewed it again on the rebased code, after the round-1 fixes.

| Agent | Round 1 | Round 2 |
|---|---|---|
| code-reviewer | WARN | WARN |
| security-auditor | PASS | PASS |
| debugger | WARN | WARN |
| test-writer | PASS | PASS |
| refactorer | WARN | WARN |
| doc-writer | WARN | PASS |
| silent-failure-hunter | WARN | WARN |
| pr-test-analyzer | WARN | WARN |

Subagent verification rule (CLAUDE.md §8): no agent made a negative file-existence claim that needed a cross-check. Several agents cited line numbers past the end of short files (HALLUCINATED line numbers), so their findings were treated as leads and re-checked against the real files before acting. Round-2 claims about `useCountUp` producing `-0`, the one-render stale window in `ResourceInsights`, and the silent fallback to a summed total were each confirmed by reading the code (CONFIRMED), and the stale-window test was shown to fail with the fix removed.

## Fixed in this push

- **Accessible names ran together (round 1, CONFIRMED).** Legend buttons and bar rows read as "Offshore75". A space now separates label and value.
- **Failed refresh replaced the whole page (rounds 1 and 2, CONFIRMED).** A failed refresh now keeps the page and its filters and shows "Could not refresh". A first-load failure and an all-tables failure both offer Try again. A failed chart keeps its last data with an inline error and its own Try again.
- **Stale "N resources match" (rounds 1 and 2, CONFIRMED).** The count waits for both charts to settle. It says "Match count unavailable" if one failed. `useGroupSummary` now ties each result to the inputs it was fetched with, which closes a one-render window where the old count flashed after a filter click.
- **Total understated past 100 groups (rounds 1 and 2, CONFIRMED).** The route counts the total in a separate query. "Other designations" uses it. `fetchGroupSummary` now throws if the total is missing instead of summing the groups.
- **`-0` in a count (round 2, CONFIRMED).** The count-up progress is clamped at zero.
- **Non-JSON error bodies (round 2).** The error message now carries the HTTP status.
- **NUL byte in a filter (round 1).** A 422 instead of a 500.
- **Tests and docs.** Added tests for each fix, the animation cleanup and unmount, retargeting and null, and the slice selector no longer depends on DOM order. `backend/README.md`, `.claude/rules/api.md` (aggregate routes are not paginated), `mcp-server/README.md`, the queue and `tasks/lessons.md` updated.

## Remaining checklist (non-blocking)

- [ ] The bar-row markup and CSS in `ResourceInsights` repeat the bars in `Dashboard`. A shared `BarRow` component and one CSS module would remove it.
- [ ] `ResourceInsights` still has nested ternaries for loading, empty and content. A small card-state helper would flatten them.
- [ ] `DonutChart` tests query the SVG by tag and `title`. A `role="img"` with a label on the chart would let them use roles.
- [ ] The global `matchMedia` stub in `src/test/setup.js` defaults every test to reduced motion. `AnimatedNumber` and `DonutChart` are never tested with motion on. `useGroupSummary` has no test that a slow stale response is discarded.
- [ ] The summary route runs two table scans per request, unauthenticated, with no rate limit or statement timeout. This matches the existing open-read policy. The two queries are not in one snapshot, so `total` can differ slightly from the group sum under concurrent writes.
- [ ] Backend summary tests mock the database, so they prove wiring and SQL shape, not Postgres execution.
- [ ] Any string field of 255 characters or fewer can be grouped, including names. This exposes nothing the open list route does not already return.
- [ ] The landing page "Enter the Application" button opens the Control Center, because it is first in navigation.
- [ ] Deploy order: the charts need the new summary route. The Render backend has to be redeployed after this merges, and the Dashboard charts show a retryable error until it is.
