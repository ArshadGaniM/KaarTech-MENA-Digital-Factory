# Merge-to-Main Gate Report — FEAT-16

**Feature:** Bug fix — `modules.practiceId` (deliberately unvalidated at the app layer,
per `masterDataTables.js`, but Postgres-typed `uuid`) crashed as an unhandled 500 on any
non-UUID input. Found via a live UI walkthrough while testing FEAT-14/15's Add/Delete
flows on all 12 tables. Fixed by mapping the underlying Postgres
`invalid_text_representation` error (22P02) to the same clean 422 shape every other
write failure already gets.

**Diff reviewed:** `git diff origin/main..HEAD` (branch `claude/trusting-curie-hlx1r6`)

**Overall verdict: ⚠️ WARN** — zero FAIL gates, zero Critical findings, security PASS
clean. Merge allowed per CLAUDE.md §9.5.

---

## Agent-by-agent results

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | PASS | Confirmed the fix is correct and, being keyed off the generic Postgres error code (22P02) rather than the specific `practiceId` field, already covers every other type-mismatch-prone field in the schema (e.g. a fractional value against an `integer` column) without further changes. Field-matching false-positive risk (two fields sharing a submitted value) judged acceptable — cosmetic only, affects which field name appears in an error message, not any access-control decision. |
| security-auditor | PASS | No new findings. `invalidValueError()` never leaks raw Postgres error text into the response — only an app-defined field key and a static message. Regex extraction is linear-time (no ReDoS). Fix only changes the error *response shape* for values that already passed `validateBody`/`validateReferences`; nothing newly accepted or rejected. |
| debugger | PASS | Traced the full path end-to-end and confirmed the fix actually resolves the original crash into a clean 422. Confirmed both POST and PATCH routes are covered. Flagged one non-blocking enhancement: teaching `validateBody` a `type: "uuid"` format check for `practiceId` specifically, to reject earlier and avoid the DB round-trip — not required for this fix, which already fully closes the crash/500 exposure via the established error-mapping pattern. |
| test-writer | PASS | Confirmed full coverage: `isInvalidTextRepresentation`/`invalidValueError` unit tests (both match and fallback cases), and a genuine HTTP-level integration test in the new `masterDataRouter.modules.test.js` (modules had zero test coverage before this diff). Full suites green: 192/192 backend, 33/33 mcp-server. |
| refactorer | PASS | New error-mapping pair follows the exact same convention as the two existing pairs (unique/FK violations). Literal-matching approach judged the only generically correct method given this Postgres error class exposes no column/constraint name. `mapWriteError`'s signature growth (`+body`) is proportionate — threaded through exactly the two call sites that already had it in scope. |
| doc-writer | WARN → fixed | Found and fixed two doc gaps: `backend/README.md`'s error-shape documentation only described the unique-violation 422 path, not the new invalid-text-representation one; `mcp-server/README.md` described `module.practiceId` as "unvalidated" without noting the DB still enforces its `uuid` column type. Both fixed with accurate, precise language. |
| silent-failure-hunter | PASS | Confirmed the fallback ("value" key when the literal can't be matched) is still a clear, actionable 422 — not a masked or ambiguous failure. Confirmed unknown Postgres error codes still fall through to a real 500 via the unchanged final `return err;` — no new silent swallowing introduced. |
| pr-test-analyzer | PASS | Confirmed modules had genuinely zero test coverage before this diff. The two fix-specific tests are real, end-to-end behavior tests that would fail under the pre-fix code. One test ("optional field still succeeds") is legitimate baseline coverage but doesn't specifically exercise anything this diff changed — noted as Optional, not blocking. Logged (non-blocking) that `moduleCode`/`name` required-field validation and unique/FK-violation handling still have no modules-specific tests — pre-existing gaps, unrelated to this fix. |

---

## Security exception check (CLAUDE.md §9.5)

Security-auditor returned **PASS** with no findings. No WARN-level security item exists to
trigger the FAIL auto-upgrade.

## Fixes applied during this gate run

- `backend/README.md` — added documentation of the new invalid-text-representation 422
  path, and noted `modules.practiceId`'s DB column is still `uuid`-typed.
- `mcp-server/README.md` — reworded `module.practiceId`'s description from
  "unvalidated" to "not FK-validated," with a note that the DB still enforces its
  `uuid` format.

## Non-blocking follow-ups logged

- [ ] (debugger) Consider a `type: "uuid"` format check in `validateBody` for
      `practiceId` specifically, to reject a malformed value before the DB round-trip
      rather than relying on the error-mapping backstop.
- [ ] (pr-test-analyzer) `modules` still has no direct tests for required-field
      validation (`moduleCode`/`name`) or unique/FK-violation mapping — pre-existing
      gaps, unrelated to this fix.

## Test results after fixes

- Backend (node --test): 192/192 passing (was 184 before FEAT-15/this fix)
- mcp-server (node --test): 33/33 passing
- Frontend: unaffected by this diff (backend-only fix)
