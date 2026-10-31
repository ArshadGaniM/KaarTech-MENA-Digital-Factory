# Gate Report: FEAT-26, Dashboard allocation view

**Verdict: WARN** (zero FAIL, zero Critical in the final round, security PASS in the final round)

**Branch:** `claude/dreamy-knuth-76pnsa` to `main` (up to date with `main` at `44c78b8`)
**Scope:** `git diff origin/main..HEAD`. The allocation view: how fully the live resources are deployed (fully allocated, partly allocated, not deployed, and over-allocated if the rule is ever broken) as a donut, plus the positions people are deployed to as bars, each filtered by the other's pick. New read-only `GET /v1/allocation/summary` (`backend/src/allocation.js`, `allocationRouter.js`). Frontend: `AllocationInsights`, `fetchAllocationSummary`, `useAllocationSummary`, per-segment colour tokens in `DonutChart`. Shared pieces extracted and used by the Resources and Dashboard sections too: `BarList`, `InsightPanel`, `InsightCard`, `FilterSummary`, `InsightNote`, `useKeyedResource`, `useCrossFilters`.
**Definitions confirmed with the owner before building:** total allocation is the sum of a resource's live deployment percentages. Fully allocated is exactly 100, partly is above 0 and below 100, not deployed is no live deployment, and the base is all live resources.
**Checks on the final code:** frontend 376/376 tests, backend 337/337 tests, `vite build` clean, no new lint warnings. The allocation SQL was run read-only against the live database (98 fully allocated, 0 partly, 2,658 not deployed, 71 Consultant and 27 Lead Consultant) and again after the soft-deleted position fix.

## Gate rounds

The gate ran four times. Each round after the first reviewed the fixes for the last.

| Agent | Round 1 | Round 2 | Round 3 | Round 4 |
|---|---|---|---|---|
| code-reviewer | WARN | WARN | FAIL | WARN |
| security-auditor | WARN | WARN | WARN | PASS |
| debugger | PASS | PASS | WARN | PASS |
| test-writer | PASS | PASS | PASS | PASS |
| refactorer | WARN | PASS | PASS | PASS |
| doc-writer | WARN | PASS | WARN | PASS |
| silent-failure-hunter | WARN | WARN | WARN | WARN |
| pr-test-analyzer | WARN | WARN | PASS | PASS |

Under CLAUDE.md §9.5 any security finding counts as a FAIL. Security reported a finding in rounds 1 to 3, each real and fixed (below), and came back PASS in round 4 after 28 hostile probes under four query-parser settings.

Subagent verification rule (CLAUDE.md §8): no agent made a negative file-existence claim that needed a cross-check. Several agents cited line numbers past the end of short files (HALLUCINATED line numbers), so those findings were treated as leads and re-checked against the real files before acting. Every finding below marked CONFIRMED was reproduced by reading the code, and each fix has a test that was shown to fail on the old code.

## Fixed in this push

- **Soft-deleted positions could be listed (security, round 1, CONFIRMED).** The query joined positions without excluding deleted ones. A resource whose only deployment points at one still counts in its bucket, but the name is never shown.
- **Validation could fail open for a `__proto__` key (security, rounds 2 and 3, CONFIRMED).** Express's default parser removes that key, and assigning it on a plain object is dropped. The route now reads the raw query string, collects problems as pairs and builds the 422 details with `Object.fromEntries`, so it is rejected under the extended, simple and `false` parser settings.
- **Another filter's numbers could show after a failed fetch (silent-failure, code review, rounds 1 to 3, CONFIRMED).** `useKeyedResource` was rewritten so only the current request writes state. An out-of-order answer for an old filter, a retry, and a third filter can no longer bring old numbers back under new labels. A failed refresh of the same filter keeps its chart.
- **A failed card stayed dimmed and busy (code review, silent-failure, round 4, CONFIRMED).** A settled failure is no longer loading.
- **A card now dims and marks itself busy while new numbers load,** so stale numbers are not shown as current.
- **Position bars were cut at 10 with no note.** The panel now says "Showing the top 10 of N positions."
- **Wrong `api.md` note for the new route, missing README cases (docs, rounds 1 and 3).**
- **Duplication (refactor, rounds 1 and 2).** Shared bar rows, panel frame, filter state and empty-message component replace three copies.
- **Smaller:** `colorVar` accepts only a plain CSS variable name, a non-Error rejection becomes an Error, an overlong unknown key is shortened in the 422, a NUL byte is rejected, accessible names no longer run label and count together, and two weak tests were rewritten.

## Remaining checklist (non-blocking)

- [ ] The allocation SQL is only tested against a mocked database. It was checked by hand on the live database, but there is no automated integration test.
- [ ] Both cards show the same error, so two alerts and two Try again buttons appear when the one request fails.
- [ ] While new numbers load, the old slices and bars are dimmed but still clickable.
- [ ] Going back to a filter before another one settles can show that filter's old error until its refetch lands. It never shows a wrong number.
- [ ] A few tests query by CSS selector or `.parentElement` (bar widths, donut strokes, card titles). There is no accessible alternative for colour and geometry.
- [ ] `useKeyedResource` and `useAsyncResource` overlap in the cancel-and-load pattern. Judged acceptable, since they differ in what they keep and drop.
- [ ] The router tests copy the production error middleware instead of sharing it, so they could drift from `index.js`.
- [ ] `/v1/allocation/summary` is unauthenticated and runs two table queries per request, with no rate limit. This matches the open-read policy and its output is capped.
- [ ] Per-position counts add up to more than the number of people when someone is deployed to two position names. This is by design.
- [ ] The Over-allocated slice is hidden while its count is zero and unfiltered. It appears as soon as any resource exceeds 100.
- [ ] Deploy order: the Allocation panel needs the new route. After this merges, Vercel serves the page before Render redeploys, so the panel shows a retryable error until the backend is live. There is no migration.
