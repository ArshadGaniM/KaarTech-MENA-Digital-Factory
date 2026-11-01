# Gate Report: Organization Structure page

**Verdict: WARN** (zero FAIL, zero Critical.)

**Branch:** `feat/org-structure` to `main`. Main had no new commits, so the branch was up to date.
**Scope:** `git diff origin/main..HEAD`, 18 files. A new Organization Structure section in the sidebar, between Control Center and Dashboard. It shows the ODC Delivery Manager, five ODC Project Managers (names TBD, set in `src/lib/odcLeadership.js`), then departments, practices, shared Module Leads and teams, all built from live data. Migration `0036` adds a change notification on `practices`. It was applied to the live database with the owner's approval.

**Checks:** frontend 597/597 and backend 450/450 pass. Lint is clean on the changed files.

| Agent | Verdict |
|---|---|
| code-reviewer | WARN |
| security-auditor | PASS |
| debugger | PASS |
| test-writer | PASS (about 90% estimated, no coverage tool installed) |
| refactorer | WARN |
| doc-writer | WARN |
| silent-failure-hunter | WARN |
| pr-test-analyzer | WARN |

All findings were confirmed by direct reads. None of the agents claimed a missing file, so there was nothing to relabel as hallucinated.

**An earlier round (before these results)** found a Critical: a Module Lead whose resource record is deleted had a null name and the sort crashed the page. It is fixed and tested, along with teams under a deleted practice, duplicated node keys, `TeamCard` in the wrong file, and the missing README entry for 0036.

**Fixed after this round:** two agents noted that deployments now have start and end dates, so a past or future Module Lead showed as current. Only deployments covering today now count. Covered by a new test.

**Open warnings (checklist, not blocking):**
- [ ] The live-refresh code is copied from `useControlCenter`. A shared helper would remove about 30 lines.
- [ ] Six whole tables reload on every change event and every 30 seconds, per open tab. Same pattern as the Control Center.
- [ ] A live team whose department is deleted is not shown, and no warning appears. Seats vanish from the total.
- [ ] A department code in `odcLeadership.js` with no live department is dropped silently. Only a comment tells the owner to check.
- [ ] The mixed-practice `console.warn` repeats on every refresh and is invisible in production.
- [ ] `Map.groupBy` needs Chrome 117, Safari 17.4 or Firefox 119. No browser target is declared.
- [ ] Test gaps: no test of one node toggled alone, of an out-of-order response, or of the loading state. `TABLE_COUNT` in the hook test is hard coded.
- [ ] Doc nits: `buildOrgStructure` does not describe its input rows, and the README stream row does not list which tables notify.
