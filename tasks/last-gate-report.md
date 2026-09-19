# Quality Gate Report

**Branch:** `claude/trusting-curie-hlx1r6` → `main`

**Diff covered:** FEAT-5 (Resource Cost real schema + generic FK-validation/
live-lookup framework) and FEAT-6 (Resources column label rename), plus the
`bash-guard.sh` hardening that rode along on this branch. This report
replaces the prior version, which covered only FEAT-6 and did not reflect
the much larger FEAT-5 diff landing in the same push (caught by this gate's
own code-reviewer agent).

**Verdict: ⚠️ WARN → all findings fixed in this push → ✅ PASS.**

## FEAT-5 — Resource Cost real schema

`employeeId` (required, must reference an existing Resources row,
enforced), `employeeName`/`employeeDesignation` (read-only, live-looked-up
from the referenced resource), `offshoreCost`/`onsiteCost` (both optional
numeric). Introduces two new generic master-data framework capabilities,
reusable by future tables: `validateReferences()` (opt-in per-field FK-
existence check) and a `lookups` descriptor (opt-in LEFT JOIN for read-only
derived fields). Migration `0013_add_resource_cost_columns.sql` applied
live to Supabase.

## FEAT-6 — Resources column labels

Every Resources table column label (except Employee ID) prefixed
"Employee " (e.g. "Org Chart" → "Employee Org Chart"). Single-file,
display-labels-only, no behavioral surface.

## Gate agent results (8 parallel agents against `git diff origin/main..HEAD`)

| Agent | Verdict | Finding |
|---|---|---|
| code-reviewer | WARN | FK-violation race (23503) surfaced as raw 500 instead of 422; bash-guard `-f` end-of-string gap; stale gate report not covering this diff |
| security-auditor | WARN → **FAIL** (§9.5 security exception) | `bash-guard.sh`'s "no direct push to main" pattern was bypassable via a colon-delimited refspec (`git push origin HEAD:main`) |
| debugger | PASS | 73/73 backend + 7/7 mcp-server tests pass; no unhandled errors; no regression to the other 8 tables |
| test-writer | PASS | ~95% coverage of new/changed logic; every branch of `validateReferences`/`lookupJoinSql`/`lookupSelectSql`/`toResponse`'s lookup branch tested |
| refactorer | WARN | Duplicated presence-check formula between `validateBody`/`validateReferences`; sequential (not concurrent) FK-existence queries would serialize once a table has 2+ `references` fields |
| doc-writer | WARN | `backend/README.md`/`mcp-server/README.md` had a stale `resource-cost: name` row, no migration 0013 entry, and no documentation of the new `references`/`lookups` descriptor keys |
| silent-failure-hunter | PASS | No swallowed exceptions; `validateReferences` correctly throws; lookup-null vs lookup-absent correctly collapse to the same `null` |
| pr-test-analyzer | WARN | `DELETE /:id` had zero test coverage (no success/404/auth cases); PATCH/DELETE auth-gate untested (only POST's 401 covered) — confirmed via mutation testing that the mocked-`pool.query` tests genuinely catch real regressions, not just restate the mock |

**Overall: FAIL**, auto-upgraded per §9.5's security exception on the
`bash-guard.sh` finding.

## Auto-fix loop (CLAUDE.md §9.3 Step 2) — all fixed in this push

1. **`bash-guard.sh`** — broadened the "no push to main" pattern to catch
   colon-delimited refspecs (`git push origin HEAD:main`), and the
   force-push pattern to catch a bare trailing `-f` and combined short
   flags (`-uf`). Verified against both the bypass cases and legitimate
   pushes to the feature branch.
2. **FK-violation-at-write-time (23503)** — added `isForeignKeyViolation`/
   `referenceNotFoundError` to `backend/src/errors.js` and a shared
   `mapWriteError()` helper in `masterDataRouter.js`, so a referenced row
   deleted between `validateReferences()`'s check and the actual write
   still returns a 422, not a raw 500. New regression test added.
3. **DELETE test coverage** — added tests for DELETE's success path (204,
   correct SQL), already-deleted/nonexistent (404), and missing-auth
   (401), plus a missing-auth test for PATCH.
4. **Refactor cleanup** — extracted the shared `fieldPresenceToValidate()`
   helper (used by both `validateBody` and `validateReferences`,
   standardized on `Object.hasOwn` for presence, matching the rest of the
   codebase's convention); converted `validateReferences`'s per-field FK
   checks from sequential to `Promise.all`-concurrent, ahead of FEAT-11
   (Project Assignments) needing two FK checks per request.
5. **Documentation** — both READMEs' per-table field tables now correctly
   describe `resource-cost`'s real schema, migration 0013 is listed, and
   the new `references`/`lookups` descriptor keys are documented as
   reusable, opt-in table/field capabilities for future tables.

## Verification after fixes

- `cd backend && node --test src/*.test.js` — **78/78 pass** (73 → 78:
  5 new tests — FK-violation-at-write mapping, DELETE success/404,
  PATCH/DELETE missing-auth).
- `cd mcp-server && npm test` — **7/7 pass**, unchanged.
- `npx oxlint backend/src mcp-server/src src` — clean except one
  pre-existing, unrelated `react/set-state-in-effect` warning in
  `src/hooks/useMasterDataTable.js` (not touched by this diff).
- bash-guard.sh's new patterns manually verified against both bypass
  cases (now blocked) and legitimate feature-branch pushes (still
  allowed).

No Critical findings remain. Verdict: **PASS**, merge allowed on "Merge to
Main" per CLAUDE.md §9.5.
