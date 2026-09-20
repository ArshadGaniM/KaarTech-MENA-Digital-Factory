# Merge-to-Main Gate Report

**Branch:** `claude/trusting-curie-hlx1r6` → `main`
**Diff scope:** FEAT-7 (Resource Deployment — real schema, two concurrent FK/lookup pairs) + project-wide model-ceiling standing policy (CLAUDE.md §2, 41 vendored agent files, `scripts/register_agent.py`)
**Verdict: ✅ PASS**

## Feature summary

FEAT-7 gives `resource_deployment` its real shape: `employeeId` (FK →
`resources.employee_id`) and `positionId` (FK → `positions.code`), each with
a live-resolved name (`employeeName`, `positionName`). This is the first
master-data table with **two concurrent `references` fields and two
concurrent `lookups` entries** — `validateReferences()`'s `Promise.all`
concurrency (added ahead of this need during FEAT-5) and the generic
`lookups` framework in `masterDataSchema.js`/`masterDataRouter.js` were
reused verbatim with no framework changes required.

Migration `0016_add_resource_deployment_columns.sql` applied live to
Supabase: drops the placeholder `name` column, adds `employee_id`/
`position_code` with two FK constraints and two indexes. Verified on the
live schema via `mcp__Supabase__list_tables`.

Built directly (not via the Workflow tool's staged pipeline) — the pipeline
hit three consecutive session/token limits on FEAT-8/9/7, and the owner
explicitly pivoted to direct builds for feature work going forward. Followed
the same architectural patterns; `pr-test-analyzer` (below) found no drop in
test rigor versus pipeline-built precedents.

Separately, this diff also implements a project-wide **model ceiling**
standing instruction: no agent (pipeline or otherwise) runs above Sonnet by
default; Opus/higher requires explicit one-time owner approval, specifically
triggered by repeated/genuine failure (not a single retry). 41 vendored
agent `.md` files had `model: opus` brought down to `model: sonnet`;
`scripts/register_agent.py`'s `MODEL_KEYWORDS` updated to match; CLAUDE.md
§2 rewritten to document the policy and its trigger condition.

## Gate agent results

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS (was WARN) | Flagged `mcp-server/src/masterDataTables.test.js` as an uncommitted working-tree change. Verified: it was already committed (`f41f5a0`) and present in `origin/main..HEAD` — stale working-tree snapshot at time of review, not a real gap. |
| security-auditor | PASS | One non-blocking note: a vendored security-reviewer agent's own model changed opus→sonnet as part of the ceiling policy — no functional security impact. |
| debugger | PASS | No unhandled errors or runtime failures found. |
| test-writer | PASS (was WARN, self-fixed) | Found `resource_deployment` had zero dedicated tests in `mcp-server/src/masterDataTables.test.js` despite sibling tables having them. Wrote 6 missing tests (writable-fields-exactly, required/type checks, label wording, zod-schema distinctness). Committed as `f41f5a0`; `npm test` confirms 24/24 mcp-server tests passing. |
| refactorer | PASS | No complexity/duplication issues. |
| doc-writer | PASS (was FAIL, fixed) | Two real gaps, both fixed in `c59df0b`: (1) `backend/README.md` was missing a migrations-table row for `0016_add_resource_deployment_columns.sql`; (2) `mcp-server/README.md` line 76 still grouped `resource_deployment` under a stale `name`-only placeholder row (4th consecutive-feature recurrence of this gap category) — split into its own row + prose paragraph. Also caveated a dangling `.claude/agents/registry.json` reference in CLAUDE.md §2 as forward-looking per §14. |
| silent-failure-hunter | PASS | Specifically verified the two-FK-concurrency masking risk: traced the actual SQL-building code and confirmed it is not possible for the two-FK-failure test to pass with only one `Promise.all` branch executing. No swallowed exceptions or success-masking-errors found. |
| pr-test-analyzer | PASS | Traced 3 tests against real implementation code (`validateReferences`, `referenceNotFoundError`) — all genuine behavior tests, not restated mocks. One Important, non-blocking gap noted: no direct POST test for "employeeId invalid, positionId valid" (only the reverse combination is tested explicitly); low risk since the validation code path is generic/symmetric. No sign of reduced test rigor from being built outside the pipeline — in some respects (dual-FK/dual-lookup interaction coverage) it exceeds prior single-FK tables' suites. |

## Outstanding non-blocking items (tracked, not gating)

- `pr-test-analyzer`'s suggested mirror-case POST test (employeeId-invalid/positionId-valid) — recommended as a template fix for the next dual-FK table, not required for this merge.

No Critical findings. No FAIL gates remain.
