# Merge-to-Main Gate Report — FEAT-18

**Feature:** (1) Fix TopBar's page title, hardcoded to "Dashboard" regardless of
the active section. (2) Add real pagination (offset-based, 20/page) to every
master-data table — the frontend previously silently capped every table at its
first 100 rows with no way to see more, no longer viable now that Resources
holds 2,756 real rows (FEAT-17). (3) Add drag-to-resize column widths to every
table, per the owner's explicit request mid-session.

**Diff reviewed:** `git diff origin/main..HEAD` (branch `claude/trusting-curie-hlx1r6`)

**Overall verdict: ✅ PASS** — all 8 gate agents ran; every real finding across
two rounds (security-auditor, code-reviewer, debugger, silent-failure-hunter,
refactorer) was fixed and re-verified; test-writer and doc-writer both PASS
clean. Zero FAIL, zero unresolved Critical.

---

## Agent-by-agent results

| Agent | Verdict | Summary |
|---|---|---|
| security-auditor | WARN → fixed | Found an unbounded loop: `fetchAllMasterDataTableRows` would loop forever if the backend ever returned a malformed/stuck `total`, reachable from both the FK pick-list loader and the Delete-by-Code search on routine user actions. Fixed with a `MAX_PAGES` backstop and explicit `total` validation (now shared in `fetchMasterDataTable`, so every caller benefits). No other findings (no injection, no XSS, no secrets — `route` is always one of the hardcoded `MASTER_DATA_TABLES` values, never user input). |
| code-reviewer | WARN → fixed | 4 real findings: (1) the entire table + pagination bar flashed to a bare "Loading…" on every Next/Previous click, since `isLoading` was set `true` on every page change, not just the first load — fixed by keeping stale data visible with an inline "— updating…" marker and disabled nav buttons during the fetch; (2) a separate page-reset effect and the data-fetch effect both reacting to `[route, refreshToken]` in the same commit caused one wasted fetch at a stale offset on every route switch or refetch while on page 2+ — fixed using React's documented in-render state-adjustment pattern instead of a second effect; (3) `AddRecordModal`'s FK pick-lists fetched the entire referenced table one 100-row page at a time (28 sequential round-trips for Resources) on every modal open — `fetchAllMasterDataTableRows` now fetches the first page alone then every remaining page in parallel; (4) a malformed/undefined `total` from the backend would make `totalPages` evaluate to `NaN`, silently breaking the Next-button disable logic — fixed by the same `total` validation as the security finding. |
| debugger | WARN → confirmed fixed | Independently found and confirmed the same two defects security-auditor and code-reviewer flagged (resize-listener leak on unmount mid-drag, unbounded pagination loop) were present in the pushed commit at the time it ran; both were fixed in the very next commit. Verified the pagination math itself (`totalPages`, offset calc) has no off-by-one for `total=0`, an exact multiple of `PAGE_SIZE`, or deleting the last row on the last page. |
| test-writer | PASS | 110/110 tests passing (was 99 before this gate's fix round). Confirmed genuine behavior coverage throughout — real offset-math assertions on `fetch` calls, real `fireEvent.mouseDown/mouseMove/mouseUp` driving the actual resize handler, a Delete-search test specifically proving a record outside the table's visible page is still found. |
| refactorer | WARN → fixed | The cancelled-flag fetch-on-mount pattern had been hand-rolled a third time (`useMasterDataTable`, `AddRecordModal`'s pick-list loader, and the new `DeleteRecordModal` fetch all duplicated it) — extracted to `src/hooks/useAsyncResource.js`, wired into `DeleteRecordModal`. `useColumnWidths` moved from inline in `MasterDataTable.jsx` into `src/hooks/`, matching `frontend.md`'s own stated convention. Dropped an inconsistent CSS fallback value. |
| doc-writer | PASS | No gaps — every new/changed export already carries a WHY-focused comment explaining the pagination contract, the full-dataset-fetch rationale, and the resize design; no external doc file documents `masterDataApi.js`'s exports or `MasterDataTable`'s behavior, so nothing external went stale. |
| silent-failure-hunter | WARN → fixed | The generic `"<route> returned a malformed response."` error gave no indication of which page/offset failed or why — now effectively undebuggable once called in a loop (up to 28 times per full-table fetch). Fixed: the error now includes the route, offset, limit, and the underlying parse failure's own message. Confirmed `fetchAllMasterDataTableRows` never silently returns a partial/truncated row set — any page failure propagates straight to the caller. |
| pr-test-analyzer | WARN → fixed | Correctly flagged that the first round's fixes (MAX_PAGES/leak guards, the new `useAsyncResource` hook) had landed with no direct test coverage yet. Added: parametrized invalid-`total` rejection tests, a malformed-JSON-with-context test, a parallel-fetch behavior test, a MAX_PAGES-exceeded test, a resize-listener-removed-on-unmount test, and a dedicated `useAsyncResource.test.js` (including a stale-response-discarded race-condition test). |

---

## Security exception check (CLAUDE.md §9.5)

security-auditor's one finding (unbounded loop) is fixed and the fix is tested
(MAX_PAGES-exceeded test in `masterDataApi.test.js`). No open security finding
remains to trigger the WARN→FAIL auto-upgrade.

## Fixes applied during this gate run

- `src/lib/masterDataApi.js` — `fetchMasterDataTable` now validates `total`
  (rejects non-finite/negative) and includes route/offset/parse-error context
  in its malformed-response error; `fetchAllMasterDataTableRows` gained a
  `MAX_PAGES` backstop and now fetches page 1 alone then every remaining page
  in parallel.
- `src/hooks/useMasterDataTable.js` — page-reset logic moved from a second
  `useEffect` to an in-render state adjustment, eliminating the stale-offset
  double-fetch.
- `src/components/MasterDataTable/MasterDataTable.jsx` — loading/pagination
  rendering reworked to avoid the full-table flicker on page navigation;
  `useColumnWidths` moved to `src/hooks/useColumnWidths.js` with its unmount-
  cleanup fix intact.
- `src/components/DeleteRecordModal/DeleteRecordModal.jsx` — now uses the new
  shared `src/hooks/useAsyncResource.js` instead of a third hand-rolled
  cancelled-flag effect.
- `src/components/MasterDataTable/MasterDataTable.module.css` — dropped an
  inconsistent CSS variable fallback.
- `src/components/AppShell/AppShell.test.jsx` — its global `fetch` mock
  updated to include `total` (matches the real backend contract the new
  `fetchMasterDataTable` validation now enforces).
- New test coverage: `src/lib/masterDataApi.test.js` (invalid-total,
  malformed-JSON-context, parallel-fetch, MAX_PAGES), `MasterDataTable.test.jsx`
  (resize-cleanup-on-unmount), `src/hooks/useAsyncResource.test.js` (new file).

## Non-blocking follow-ups logged

None — every finding from every agent was fixed in this same gate run.

## Test results after fixes

- Frontend (vitest): 110/110 passing (was 99 before this gate's fix round;
  +11 new tests)
- `oxlint src/`: clean (only pre-existing-pattern `set-state-in-effect`/
  `exhaustive-deps` warnings, same category already present and accepted
  elsewhere in this codebase — not new, not blocking)
- `npm run build`: clean, 71 modules
- Visually re-verified against live production data (headless browser,
  2,757-row Resources table): title updates per section, pagination controls
  work and no longer flicker the table on navigation, column resize works,
  all confirmed via screenshots sent to the owner.
