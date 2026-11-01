# Gate Report: deliverables tables, Control Center bar removed, resource deployment start and end dates

**Verdict: WARN** (zero FAIL, zero Critical. Security PASS after two rounds of fixes.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was already up to date.
**Scope:** `git diff origin/main..HEAD`.
- Charter "Deliverables and Milestones": the Milestones table has a Due date and a Status taken from the plan step. A new Deliverables table lists one SOP document per live department (due 31 Dec 2026) and three rollout strategy documents (due 28 Feb 2027). All start as Yet to Start. Owners are the ones the owner gave. A department with no owner reads To be confirmed.
- The whole "MENA DIGITAL FACTORY" bar is gone from the Control Center.
- Resource deployments have a required start date and end date.
  - A deployment counts from its start to its end, both days included.
  - After the end date the Dashboard, the Control Center and the team hours show TBD, and the row stays as history.
  - The 100 percent rule is checked on the busiest day of the new row's period, counting only rows that share a day.
  - The same position can be held again later, not on a shared day.
- Plan data is untouched.

**Migration 0035** was applied to the live database with the owner's yes (1 Nov 2026) and verified: 99 rows dated 2026-08-01 to 2027-03-31, the new constraints exist, the old unique index is gone. A rolled-back test showed a shared day refused, the next day allowed, and an end before the start refused. The live backend does not send dates until this merge deploys.

**Checks on the final code:** backend 450/450, mcp-server 58/58, frontend 564/564, `vite build` clean, oxlint has no errors.

## Agents (round 3)

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS | Three earlier fixes confirmed. Checked under two other time zones |
| security-auditor | WARN | Cap bypass closed. One low item: zone offsets past 15:59 gave a logged 500 (fixed) |
| debugger | see below | |
| test-writer | PASS | Every round 2 fix has a direct test |
| refactorer | WARN | Duplicate `.retry` CSS, similar race-error builders, repeated test literals |
| doc-writer | WARN | README and api.md wording (fixed) |
| silent-failure-hunter | PASS | No findings |
| pr-test-analyzer | PASS | Mutation checks killed all but one equivalent mutant |

All agents ran on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8). The locked Initiative Plan files are unchanged (manual cross-check: empty diff).

## Fixed during the gate

- Round 1, Critical: a PATCH or restore reads stored dates as Date objects. The day comparison turned them into text and skipped the 100 percent and position checks. Dates are now cut from their local parts, with tests that fail on the old code.
- Round 2, Security: a date typed as 01/05/2027 passed validation and was compared as text, so it could skip the cap. Date fields now accept only ISO dates. The allocation check refuses anything else and a missing date.
- Round 2: a one-day deployment was judged backwards in a zone behind UTC. Both sides are now compared as whole days.
- Round 3: the date pattern accepted zone offsets Postgres refuses (past 15:59), which gave a logged 500. The pattern now stops at 15:59, with tests.
- Round 3: `backend/README.md` and `.claude/rules/api.md` now state the ISO date rule.
- Charter shows a loading line, an error line with a retry button, and an empty line.

## Open, not blocking

- [ ] `.retry` CSS is repeated in three components. Move to one shared rule later.
- [ ] `positionOverlapRaceError` words its message from the group key. It fires only when two writes race.
- [ ] `allocation.js` uses the database `current_date`. The Control Center uses the app's day. They can differ for a few hours if the zones differ.
- [ ] Date responses are the ISO form of a local midnight. Correct while the server runs in UTC, as on Render.
- [ ] 7 of 14 portal service cards have no Output text.
