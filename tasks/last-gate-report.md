# Merge-to-Main Gate Report — FEAT-15

**Feature:** Two soft-delete paths added to every master-data table page — a toolbar
"Delete `<Entity>`" popup (type a Code/ID, looks it up among active rows, deletes on a
match) and a per-row "Delete" action (confirmed via `window.confirm`, deletes the exact
row by its known id). Both reuse the existing backend DELETE route (already a soft
delete, unchanged by this diff).

**Diff reviewed:** `git diff origin/main..HEAD` (branch `claude/trusting-curie-hlx1r6`)

**Overall verdict: ⚠️ WARN** — zero FAIL gates, zero Critical findings, security PASS
clean. Merge allowed per CLAUDE.md §9.5.

---

## Agent-by-agent results

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | WARN → fixed | Found a real concurrency bug: `deletingRowId` was a single scalar, so deleting two different rows in quick succession let one request's `finally` clear the other's in-flight/disabled state. Fixed by switching to a `Set` of in-flight row ids; added a regression test that traces false under the old scalar implementation. |
| security-auditor | PASS | No new findings. Same API-key mechanism as FEAT-14's `createRecord` (already-disclosed tradeoff). No XSS, no authorization-model change (client-side code lookup grants no more privilege than the pre-existing per-row delete), no injection vector. Backend DELETE route confirmed unchanged and still gated by `requireInternalApiKey`. |
| debugger | PASS → fixed | Traced `identityOf()` across all 12 real tables — confirmed no table falls through to `undefined` for the Delete popup's identity-key lookup. Found one real gap: `competencies` also has identity `"none"` but had no visible `id` column, so the popup had nothing to match against for it. Fixed with the same "Record ID" column already added for the other 3 identity-less tables. |
| test-writer | PASS | Fixed gap: no test proved the new "Record ID" columns actually appear (or are correctly absent) — added direct column-definition tests. Full suite green after. |
| refactorer | PASS | `MasterDataTable.jsx`'s growth is proportionate (thin orchestration, not new business logic). Two non-blocking WARN-level notes (Add/Delete modal loading-shell overlap, repeated id-column literal) both judged premature to extract per §1 Simplicity First — no action required. |
| doc-writer | WARN → fixed | `backend/README.md`'s DELETE route docs confirmed accurate and unchanged (correct — no backend changes in this diff). Found and fixed two real gaps: CLAUDE.md §20's `VITE_INTERNAL_API_KEY` row only named the Add forms (FEAT-14), not the new Delete popup which also sends it; `backend/README.md`'s list of `GET /v1/schema/entity-relationships` consumers only named FEAT-12/FEAT-14, omitting the new Delete popup (also a consumer, via `identity`). |
| silent-failure-hunter | PASS | Error surfacing (toolbar and per-row paths), post-delete refetch failure handling, `submitting`/`deletingRowIds` reset in `finally`, and the non-JSON-error-body fallback all checked clean. No swallowed exceptions. |
| pr-test-analyzer | PASS | Traced 5 tests (case-insensitive/trim matching, soft-delete exclusion, declined-confirmation guard, the new concurrent-delete regression test, and the new `deleteRecord` unit tests) — all confirmed genuine behavior tests that fail under the corresponding broken implementation. Negative-path coverage judged adequate for a delete-capable feature. Two Optional (non-blocking) gaps noted: no raw-network-failure test, no explicit disabled-button-is-a-no-op test. |

---

## Security exception check (CLAUDE.md §9.5)

Security-auditor returned **PASS** with no findings. No WARN-level security item exists to
trigger the FAIL auto-upgrade.

## Fixes applied during this gate run

- `src/components/MasterDataTable/MasterDataTable.jsx` — `deletingRowId` scalar replaced
  with a `Set<string>` (`deletingRowIds`) so concurrent per-row deletes track independently.
- `src/components/MasterDataTable/MasterDataTable.test.jsx` — added a regression test
  proving two concurrent row deletes don't clobber each other's in-flight/disabled state.
- `src/lib/masterDataApi.js` — added a "Record ID" column to `competencies` (identity
  type `"none"`, same gap already fixed for the other 3 identity-less tables).
- `src/lib/masterDataApi.test.js` — added column-definition coverage (including
  `competencies`) and direct unit tests for `deleteRecord()` (request shape, success,
  JSON-error, non-JSON-error fallback).
- `CLAUDE.md` §20 — `VITE_INTERNAL_API_KEY` row now names both FEAT-14 and FEAT-15 as
  consumers.
- `backend/README.md` — `GET /v1/schema/entity-relationships` consumer list now
  includes the FEAT-15 Delete popup.

## Non-blocking follow-ups logged (Optional, from pr-test-analyzer)

- [ ] No test for a raw network failure in `deleteRecord()` (`fetch()` itself rejecting).
- [ ] No explicit test that an already-disabled in-flight row Delete button is a no-op.

## Test results after fixes

- Frontend (vitest): 81/81 passing (17 test files)
- Backend (node --test): unchanged by this diff — 184/184 passing (verified separately)
- Build: clean (`npm run build`)
- Lint: clean (pre-existing warnings only, unrelated to this diff)
