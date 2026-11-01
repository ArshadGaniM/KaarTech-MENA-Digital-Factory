# Gate Report: Initiative Plan, Charter and application password

**Verdict: WARN** (zero FAIL, zero Critical. One accepted security limitation, noted below.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main` (up to date with `main`, no merge needed)
**Scope:** `git diff origin/main..HEAD`. The locked Initiative Plan (`src/data/initiativePlan.js`, hash-locked) with a Gantt view, today marker, shading, status filter, behind-plan flag and plan-versus-actual. Actuals backend `/v1/initiative-plan/actuals` (migrations 0026, 0027, 0028). A portal Charter section with ten headings, the plan being one. A browser-side password screen in front of the application (`ApplicationGate`). The Project Plan sidebar entry is gone. Everything was renamed from "project plan" to "initiative plan".
**Checks on the final code:** frontend 435/435 tests, backend 346/346 tests, `vite build` clean.

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | `crypto.subtle` missing on http, 0027 replay, Charter keyboard, read-only error banner, `updated_at` trigger |
| security-auditor | PASS on new defects | Only the accepted client-side gate limitation |
| debugger | WARN | Same `crypto.subtle` gap, 0027 replay, Charter keyboard |
| test-writer | PASS | No coverage provider installed, so judged from tests. Every changed module has tests |
| refactorer | WARN | Optional cleanups only |
| doc-writer | WARN | README lacked `updatedBy` and the response shapes |
| silent-failure-hunter | WARN | `crypto.subtle` gap, `onSaved` inside the save try |
| pr-test-analyzer | WARN | Missing 500 and DELETE 401 tests, blocked-storage tests |

The first launch of six agents failed on a model setting (`deep`/`fast` do not resolve), so they were relaunched on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed in this push

- The password screen now says so when the browser cannot check passwords (plain http), instead of doing nothing. Test added.
- `onSaved()` runs after the save try block, so a successful save can no longer show "save failed".
- The Charter headings work with arrow keys, Home and End. Test added.
- The read-only plan shows a softer message when recorded progress cannot load. Test added.
- The activity-key rule is one helper. `weekEnd` reuses `weekStart`.
- Migration 0027 is a no-op where the table is already renamed, so a replay cannot fail.
- New migration 0028 adds the `set_updated_at()` trigger and drops the personal-name defaults on `created_by` and `updated_by` (database.md). **Not applied to the live database; needs the owner's yes (CLAUDE.md §21).**
- The Escape key closes the actual dialog, and the first field takes focus.
- `backend/README.md` now documents `updatedBy`, the response shapes, the 422, and says the password screen is not access control.
- Tests added: DELETE 401 (missing and wrong key), a 500 that hides the cause, blocked session storage, `crypto.subtle` missing, Charter keyboard, read-only load failure.

## Accepted, not fixed

- **Client-side password (Low, owner-accepted).** The SHA-256 hash ships in the bundle, session storage can be set by hand, reads on the API stay open and writes use the shared key (CLAUDE.md §20). It keeps casual visitors out. It is not access control. Real protection needs a server-side login.
- The default actor name in the router and DB, and no rate limiting on PUT and DELETE, match the rest of the API.

## Action items

- [ ] Owner: say yes to apply migration 0028 to the live database (§21).
- [ ] After merge: run the §21 deployment check. Trigger the Render deploy if none starts.
- [ ] Owner: fill in the Charter's "To be confirmed" items (named stakeholders, KPI targets, cadence, risks).
