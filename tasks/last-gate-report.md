# Gate Report: password on every entry, Control Center order and layout, Stakeholder Matrix and org structure, services from Departments, SOP screens

**Verdict: WARN** (zero FAIL, zero Critical. Security PASS.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was already up to date.
**Scope:** `git diff origin/main..HEAD`.
- The application asks for the password on every entry from the portal. The unlock is React state only and clears when you leave the application.
- Control Center cards: inside a practice, allocated teams with nothing utilized, then allocated teams with some utilization, then teams with no live assignment. The dashed strip is gone. Cards have one fixed height. Competencies stay on one line with a "+N" chip that shows the full list on hover and focus.
- Charter: a 30-row Stakeholder Matrix (18 named people and 12 open track co-owner seats), an Initiative Org Structure diagram, and the initiative owner and co-owners in the Overview.
- Portal services come from the live departments (name is the title, Output is the description, floor order). Each card has a Read SOP link to a public SOP screen with ten fixed headings.
- No migration and no new backend route.

**Checks on the final code:** backend 416/416, mcp-server 57/57, frontend 514/514 tests, `vite build` clean, oxlint clean. The screens were checked in a real browser (card heights, tooltip, org chart, SOP screen, password asked again).

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Tooltip and fixed height clip in extreme cases, chip width is an estimate |
| security-auditor | PASS | No findings. Output text and stakeholder names are now public |
| debugger | PASS | No crash path. Ordering depends on the selected month |
| test-writer | PASS | All new code has behaviour tests |
| refactorer | WARN | Duplicate CSS rules, two unused exports |
| doc-writer | WARN | Stale history rows in the task logs |
| silent-failure-hunter | WARN | 100 department cap was silent, malformed hash shows the portal |
| pr-test-analyzer | WARN | End-date order inside a band untested, one weak assertion |

All eight agents ran on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed in this push

- The portal reads every page of departments, so no service is cut off past 100 (it was a silent cap).
- A bare `#sop/` link now shows the portal instead of "Service not found". Two unused exports were removed.
- Duplicate CSS rules in the services and Control Center styles were merged. The team name is clamped to two lines so a long name cannot push the card content out.
- New tests: end-date order inside each band, a stronger "no re-lock between sections" check, no unlock kept across a reload, and no change to the rows `toServices` receives.
- The FEAT-31 and FEAT-33 rows in the queue are marked as superseded.

## Open, not blocking

- [ ] Opening a SOP screen or going back fetches the departments again, so a short loading line shows each time. On a cold Render start it can take seconds. A shared cache would remove it.
- [ ] The chip count uses an estimated text width. A very wide letter could clip a chip with an ellipsis. The card never grows.
- [ ] The Control Center order depends on the selected month, because "utilized" is measured for that month. Another month can move a card between bands.
- [ ] Returning from an SOP screen to a section below Services can land slightly off target once the service cards load.
- [ ] A long tooltip list is clipped at the card edge. Four lines fit.
- [ ] Multi-paragraph SOP text will show as one paragraph until the SOP text is added with line breaks in mind.
- [ ] Department Output text and the stakeholder names are public on the portal. Reads were already open.
- [ ] The password check is client-side, not real security (accepted limitation, CLAUDE.md §20).
