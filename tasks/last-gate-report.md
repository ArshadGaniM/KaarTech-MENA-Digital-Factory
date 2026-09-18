# Quality Gate Report

**Branch:** `claude/trusting-curie-hlx1r6` → `main`
**Diff:** Practices gets an auto-generated code; Modules gets an
auto-generated code, a human-assigned `moduleCode`, and an unvalidated
`practiceId` link; every table now exposes a `markedDeleted` (Yes/No)
field and GET routes include soft-deleted rows — plus a follow-up commit
addressing every finding below.
**Verdict: ⚠️ WARN — merge allowed, no FAIL/Critical findings.**

## First pass (8 gate agents, parallel)

| Agent | Verdict | Key findings |
|---|---|---|
| `code-reviewer` | WARN | Soft-deleted rows and active rows competed for the same paginated page — once a table holds more soft-deleted rows than the page size, active rows could silently drop off the end of the list. Also flagged PATCH's `??` fallback treats an explicit `practiceId: null` the same as "not sent," so a mapped module could never be unmapped again. Minor: `.claude/rules/api.md`'s status-code deviation wasn't documented for the new GET-returns-200-for-soft-deleted behavior. |
| `security-auditor` | PASS | New migrations' `SECURITY DEFINER` trigger functions verified to match the already-audited `search_path`-pinned pattern. `practiceId`'s lack of FK validation traced end-to-end — no injection, no access-control implication (it carries no authorization semantics). Disclosed, non-blocking note: soft-deleted rows' actor names are now visible on the (pre-existing, already-unauthenticated) GET routes — low severity, no PII/secrets, business master data only. |
| `debugger` | PASS | Confirmed `markedDeleted`'s `!= null` check can't throw and correctly treats missing/null the same. Verified via the installed `pg` driver source that an omitted `practiceId` serializes to SQL `NULL`, not an error. Confirmed the frontend can't crash on a `null` `practiceId` or a "Yes"/"No" `markedDeleted` value. Verified live against Supabase that `modules` currently has 0 rows, so migration 0010's temporary `''` default never touches a real row. |
| `test-writer` | WARN | The new `markedDeleted` derivation is 100% unit-tested (all 3 branches). The router-level GET behavior change (no longer filtering `deleted_at`) has no integration test — confirmed this project has zero router-level tests for any route, in old code or new; not a new regression, the same disclosed, established gap noted in the prior gate report. |
| `refactorer` | WARN | `src/lib/masterDataApi.js`'s shared `AUDIT_COLUMNS` array was being bypassed by 3 of 6 table configs, which spelled out the same 5 columns inline with drifted label wording — now a 2nd instance of the same finding from the prior gate report, worth fixing rather than re-disclosing again. |
| `doc-writer` | PASS | `backend/README.md` and `mcp-server/README.md` fully updated — new `markedDeleted` field, the new GET-includes-soft-deleted behavior, and the new `practices`/`modules` fields and auto-generated codes are all accurately documented. No stale "excludes soft-deleted" text found anywhere. |
| `silent-failure-hunter` | WARN | Independently confirmed the same active/deleted-row pagination-crowding risk as code-reviewer, plus traced that nothing downstream (frontend, MCP tools) filters on `markedDeleted`, so a future aggregation/report over `GET /<table>` would silently include soft-deleted rows unless it remembers to filter client-side. |
| `pr-test-analyzer` | WARN | Confirmed the router-level GET behavior change has zero test coverage at any level, but weighed against this project's already-disclosed, pre-existing testing ceiling (no test DB, no `supertest`, no router tests for any route ever) — not a new regression, the new unit-level `markedDeleted` tests are genuine and correctly scoped to what's testable without infrastructure. |

## Remediation (follow-up commit, before this report)

- **Pagination crowding-out (2 agents converged — code-reviewer, silent-failure-hunter):** `GET /` now orders active rows before soft-deleted ones (`order by (deleted_at is not null), name asc`), so soft-deleted rows — which accumulate forever — can never push active rows off the page once a table's soft-deleted count exceeds the page size.
- **PATCH can't clear an optional field back to null (code-reviewer):** the router now distinguishes "key absent from the body" (keep current value) from "key present and set to `null`" (clear it) via `Object.hasOwn`, instead of `??` collapsing both cases into "keep current." `validateBody` now accepts an explicit `null` for a non-required field as a valid "clear this" signal (matching the existing precedent in `teamMemberSchema.js`) rather than rejecting it as a type error. 2 new tests cover both the accept-null-for-optional and reject-null-for-required cases.
- **`.claude/rules/api.md` deviation undocumented (code-reviewer):** added the GET-returns-200-with-`markedDeleted`-instead-of-404 deviation to the rule file's own "Deliberate deviation pattern" section.
- **`AUDIT_COLUMNS` duplication, 2nd occurrence (refactorer):** all 6 tables now spread the single shared `AUDIT_COLUMNS` array; its labels were unified to the clearer "Created At"/"Updated By" wording (matching what 3 of the tables already used) so switching to the shared constant doesn't change what's on screen.

## Re-verification after fixes

- `cd backend && npm test` — 42/42 pass (38 from the previous round + 2 markedDeleted tests + 2 null-clearing tests).
- `npm run build` (frontend) — clean, 40 modules.
- `npx oxlint src/ backend/src/ mcp-server/src/` — clean except the pre-existing, non-blocking `react/set-state-in-effect` warning.

## Disclosed, non-blocking gaps (not remediated — judgment calls, not oversights)

- **No router-level integration tests exist for any route** (confirmed: no test DB, no `supertest`, `node --test` unit tests only). The GET behavior change (soft-deleted rows now included) sits at this same, already-disclosed testing ceiling — revisit if/when a test-DB pattern is introduced for this project.
- **`practiceId` has no FK/existence validation** — deliberate, explicit product decision (a module can be created before its Practice is decided, mapped later via PATCH). A dangling reference is possible by design; not remediated since enforcing it would contradict the stated requirement.
- **Soft-deleted rows' actor names visible on unauthenticated GET** — pre-existing unauthenticated-read design (per `.claude/rules/api.md`, forward-looking/not-yet-enforced), now surfaces slightly more of the same non-sensitive business data. Not remediated; flagged by security-auditor as low severity.

No Critical findings remain. No FAIL gates remain. Verdict: **WARN**,
merge allowed on "Merge to Main" per CLAUDE.md §9.5.
