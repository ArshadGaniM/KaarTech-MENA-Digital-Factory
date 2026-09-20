# Merge-to-Main Gate Report

**Branch:** `claude/trusting-curie-hlx1r6` → `main`
**Diff scope:** FEAT-11 (Project Assignments — chained/transitive lookup + cross-field date validation)
**Verdict: ✅ PASS**

## Feature summary

FEAT-11 adds "Project Assignments", a brand-new master-data table linking a
Project to a Team over a date range: `projectId`/`teamId` (both pick-list-only
FK references — the second table with two concurrent FK fields, after
`resource_deployment`), `projectAssignmentStartDate`/`projectAssignmentEndDate`
(both required `date`-typed fields).

This is the first feature to require **two brand-new generic framework
capabilities**, both added to `backend/src/masterDataSchema.js`:

1. **Chained/transitive lookups (`lookup.via`)** — `departmentId`/
   `departmentName` are not a column on `project_assignments` at all; they
   resolve through the linked Team's own `department_code`. A lookup entry
   can now set `via: "<earlier lookup's table>"` to join off that lookup's
   own alias instead of off the base table (`buildLookupPlan`/
   `lookupJoinSql`).
2. **Cross-field validation (`table.crossFieldValidations`)** — a
   `"dateRange"` rule enforces `projectAssignmentEndDate >=
   projectAssignmentStartDate`, wired into both POST and PATCH
   (`validateCrossFields`). A PATCH that only sends one of the two dates is
   still checked against the other's current, stored value. Mirrored as a
   DB-layer `CHECK` constraint (migration 0018) as defense-in-depth, the
   same pattern used for every FK's app-layer + DB-layer pair.

A new `"date"` field type was added alongside (`validateBody`, and
`z.string().date()` in the mcp-server's `fieldSchema`).

Migration `0018_create_project_assignments.sql` applied live to Supabase —
verified via `mcp__Supabase__list_tables` (both FK constraints and the
CHECK constraint present on the deployed schema).

Built directly, per the owner's most recent standing instruction (the
Workflow pipeline was reinstated and then immediately reverted back to
direct builds within the same session).

## Gate agent results

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS | Confirmed `validateCrossFields`'s PATCH handling and the equal-dates boundary are correct. Flagged an Important, non-blocking robustness note: `buildLookupPlan`'s `via` resolution finds the *first* matching table name in the array, not "the nearest earlier entry" — not exploitable by today's config (no duplicate table names, `via` correctly ordered after its target), but worth hardening before a second chained lookup is added. |
| security-auditor | PASS | Confirmed every SQL identifier the `via` mechanism interpolates comes only from the fixed `masterDataTables.js` descriptor, never request input. No raw SQL interpolation of user values, no secrets, no injection risk in the date-comparison logic. |
| debugger | PASS | Traced the `via`-throw path (fires at server startup, not per-request — fail-fast on a config bug, by design) and confirmed `current` is always safely available in `validateCrossFields`'s call sites. Noted one non-triggered latent fragility (missing null-guard if a future `crossFieldValidations` entry typos a field key) — not a defect in this diff. |
| test-writer | PASS (was WARN, self-fixed) | Found two real gaps: `masterDataSchema.js` had no direct unit tests for `via`/`validateCrossFields` (only exercised indirectly through the router), and the FK-violation-race test only covered the `teams`-side constraint, not `projects`. Added both. 163/163 backend, 33/33 mcp-server tests pass. |
| refactorer | PASS | Confirmed the `via` mechanism and `validateCrossFields` are minimally scoped to the actual use case (no speculative generalization), and the new test file reuses the shared harness. |
| doc-writer | PASS (was WARN, self-fixed) | Found two real gaps: `mcp-server/README.md`'s opening paragraph was stale ("30 tools"/"10 tables"); `backend/README.md`'s migration-0018 row omitted the new index names, unlike every prior FK-adding migration row. Both fixed; new "Chained/transitive lookups" and "Cross-field validation" doc sections verified byte-accurate against the code. |
| silent-failure-hunter | PASS | Confirmed the `via`-throw fails loudly at startup rather than silently misrouting a join, and that `validateCrossFields`'s null-skip path is unreachable with invalid data given validation ordering (`validateBody` always runs first). |
| pr-test-analyzer | PASS | Traced the JOIN-alias regex test and the PATCH-cross-field test — both are genuine, load-bearing regression guards, not restated mocks. One Optional note: the null-propagation test alone doesn't prove LEFT JOIN semantics (it mocks the row directly) — that proof lives in the separate JOIN-SQL regex test. No sign of reduced rigor for the two brand-new capabilities; if anything this file is the first in the suite to assert on generated JOIN SQL at all. |

No Critical findings. No FAIL gates remain.

## Also this session

Set up a scheduled Routine ("KaarTech Digital Factory — Dev Pipeline
Continuation", `trig_012guAqCcCZ6669t4pQAn5bC`, hourly) per the owner's
standing instruction to keep executing queued pipeline features across
session limits (CLAUDE.md §7.3). **Known limitation, disclosed to the
owner:** the Routine was created with no MCP connectors attached (this
session held none it could pass through), so fired sessions run without
Supabase/GitHub MCP tools until it's recreated from a session or the
claude.ai Routines UI that holds those connector grants.
