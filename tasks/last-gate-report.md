# Gate Report: Planned Resource Cost, Control Center costs and assignments, no-overlap rule, pinned sidebar

**Verdict: WARN** (zero FAIL, zero Critical. One accepted security limitation, noted below.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main` (main merged into the branch before the gate, by a real merge)
**Scope:** `git diff origin/main..HEAD`.
- New table Planned Resource Cost (`planned_resource_costs`, migration 0030, 33 designations, monthly USD, offshore and onsite). The old Resource Cost is now labelled Actual Resource Cost.
- Control Center: the team card shows the assignment end date and Allocated Team Cost. The popup has Planned, Actual and Allocated Resource Cost columns, Allocated Team Cost, Month-wise Utilization Percentage and Cost panels, an Onsite/Offshore/Hybrid dot, and Add and Edit Project Assignment for the current assignment.
- A team's live project assignments cannot share a day (API check under a per-team lock, plus the exclusion constraint in migration 0029).
- The sidebar stays pinned while the page scrolls.
**Checks on the final code:** backend 390/390, mcp-server 55/55, frontend 463/463 tests, `vite build` clean. The overlap rule and the exclusion constraint were also exercised against the live database inside a rolled-back transaction: a clashing row was refused, the next day was allowed, and no test row remained.

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Unbounded monthly plan, future assignment looked lost, developer field name in an error, missing limits on the new table |
| security-auditor | PASS on new defects | Only the accepted client-side gate and open reads |
| debugger | WARN | Escape did nothing with the form open, edit form could follow a changed assignment, 30 February gave a 500 |
| test-writer | WARN | New props and helpers without direct tests |
| refactorer | WARN | Repeated rule checks, a misnamed lock helper |
| doc-writer | WARN | `api.md` lacked 23P01, MCP README lacked the overlap rule |
| silent-failure-hunter | WARN | Missing default cost row silently zero, defaulted people invisible on the card, rollback failure swallowed, null lock value silent |
| pr-test-analyzer | WARN | Route pass-through and cost edge cases untested |

The first launch of agents in an earlier gate failed on a model setting, so this gate ran every agent on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed in this push

- The monthly plan is cut at 120 months (`truncated`), so one absurd end date cannot make the popup compute tens of thousands of months.
- A future-dated assignment that was just added shows as "Next assignment" in the popup, so a save does not look lost. Edit still applies only to the current assignment.
- A missing Senior Consultant planned cost no longer makes people silently free: they are tagged Missing. The team card and popup say how many people were costed at the default rate.
- Escape closes the open form first, then the popup. The Edit form keeps the assignment it was opened on.
- A date such as 30 February is a 422, not a 500.
- The overlap message says "team", not a field name (`groupLabel` on the rule).
- The allocation and overlap checks are one `validateGroupRules` call, and `withAllocationLock` is now `withGroupLock`. A null group value throws, and a failed rollback is logged and its connection dropped.
- Planned Resource Cost has length and cost limits in the API (and the MCP mirror). The matching check constraints are in migration 0032.
- `api.md` and the MCP README document the 23P01 mapping and the overlap rule. The backend README documents the new fields.
- Tests added for each of the above, the cost edge cases, the route pass-through, `validateOverlap`, the error helpers and `RecordFormModal`'s `initialValues` and `lockedKeys`.

## Accepted, not fixed

- **Client-side password (Low, owner-accepted).** Reads stay open, including the per-person costs the Control Center now returns, and the write key is in the bundle (CLAUDE.md §20). It is not access control.
- The lock key changed from `hashtext(..)` of an integer to one of text. During a rolling deploy an old and a new backend would briefly use different keys. With one Render instance this is negligible, and the exclusion constraint backs the overlap rule.
- `teamCosts` builds a per-person map for every team on the card. Harmless at this size.

## Action items

- [ ] Owner: say yes to apply migration 0032 (check constraints on `planned_resource_costs`). The code does not need it.
- [ ] After merge: run the §21 deployment check. Trigger the Render deploy if none starts. Migrations 0029 to 0031 are already applied.
