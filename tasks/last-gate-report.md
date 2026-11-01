# Gate Report: Organization Structure redesign and stable list order

**Verdict: WARN** (zero FAIL, zero Critical.)

**Branch:** `feat/org-structure-redesign` to `main`. Main was merged into the branch before the gate and again before this push.
**Scope:** `git diff origin/main..HEAD`, 17 files.
- Backend: `backend/src/masterDataRouter.js` adds `id` as the last sort key of every list route, with a test. Before this, 324 positions named "Consultant" tied on the sort key, so pages of 100 overlapped and dropped rows (338 distinct of 529 live positions). The Organization Structure page showed wrong seat counts per manager. Checked on the live data: after the change all rows come back, none repeated.
- Frontend: the Organization Structure page is redesigned. It has a Delivery Manager band, a seat share bar, five Project Manager cards, department tiles with a practice mix bar, a department search and a slide-over drawer with practices, shared Module Leads and team cards with filled and empty seats. Practice colours are tokens in `src/index.css`. `TreeNode.jsx` is removed.
- `backend/README.md` documents the sort order.

**Checks:** frontend 665/665 and backend 467/467 pass. Lint is clean on the changed files. The production build works. I looked at the page in a browser with realistic data on desktop (1440 px) and phone (400 px): no horizontal overflow.
One test from main (`Analytics.test.jsx`, "asks for a range of months around the current one") failed once under load and passed on 3 reruns. Not caused by this change.

| Agent | Verdict |
|---|---|
| code-reviewer | WARN |
| security-auditor | PASS |
| debugger | PASS |
| test-writer | WARN (85% or more per file, estimated, no coverage tool installed) |
| refactorer | WARN |
| doc-writer | WARN |
| silent-failure-hunter | WARN (low) |
| pr-test-analyzer | WARN |

All findings were confirmed by direct reads. No agent claimed a missing file, so nothing was relabelled as hallucinated.

## Fixed in this push

- The open drawer was `aria-modal` but Tab could leave it. Tab now wraps inside the drawer. Tested.
- The backdrop is a real labelled button, so tests find it by role and not by CSS class. Focus returns to the tile after Close, Escape and the backdrop. Tested.
- A deployment with no employee counted as a filled seat but not as a Module Lead. It no longer counts as filled anywhere. Tested.
- Singular and plural wording ("1 team", "1 seat") now uses one shared helper.
- `README` sort-order sentence, why-comments, and a description of the `buildOrgStructure` result shape.
- `DepartmentDrawer` props now describe the practices and leads they use.
- New tests: search by any case and whitespace only, singular wording, loading message, Tab trap.

## Open, not blocking

- [ ] The page reloads six whole tables on every change event and every 30 seconds per open tab. Same pattern as the Control Center.
- [ ] The live-refresh code is copied from the Control Center hook. A shared helper would remove about 30 lines.
- [ ] A live team whose department is deleted is not shown, and no warning appears.
- [ ] A department code in `odcLeadership.js` with no live department is skipped silently.
- [ ] A selected manager or open drawer comes back by itself if its target disappears and returns on a later refresh.
- [ ] `Map.groupBy` needs Chrome 117, Safari 17.4 or Firefox 119.
- [ ] Test gaps: the unnamed "Unassigned" manager card, the search-ranking variant of the list ordering, and `practiceColor` out-of-range input have no direct test.
- [ ] The manager seat bar and the manager cards are two sets of controls for one choice, so keyboard users tab past each choice twice.
- [ ] The Render backend must deploy before the page shows correct seat counts. The Vercel frontend deploys by itself.
