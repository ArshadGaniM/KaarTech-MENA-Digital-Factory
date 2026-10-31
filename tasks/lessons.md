# Lessons

> One entry per user correction — pattern + self-rule. Reviewed at the start
> of every session (CLAUDE.md §6).

## A CI auto-merge gate must check freshness, not just presence

**Pattern:** `.github/workflows/auto-pr.yml`'s auto-merge step checked only
whether `tasks/last-gate-report.md` existed and didn't contain "❌ BLOCKED".
It never checked that the report was produced *for the push being merged*.
A WARN-verdict report from an old, unrelated feature sat in the repo for
days, and every subsequent push — including one that introduced an
unremediated Critical security finding (`mcp__Supabase__execute_sql`
auto-approved in `.claude/settings.json`) — silently squash-merged to
`main` on the strength of that stale report. The in-session "Merge to
Main" gate procedure (CLAUDE.md §9.3) was never actually the thing
controlling merges; the CI workflow was, and it wasn't checking what its
own comment claimed it checked.

**Self-rule:** When a CI workflow's stated contract ("merges only when
X") is asserted in a comment or in CLAUDE.md, verify the actual
implementation enforces that contract before trusting it — a comment
describing intended behavior is not evidence the code does it. When
diagnosing "why did this already-flagged issue reach main," check
whether an automation bypassed the review step entirely before assuming
the review step itself was wrong. Any check gating an irreversible or
hard-to-reverse action (like auto-merging to `main`) needs an explicit
freshness/recency condition tied to the specific event being gated, not
just "does an artifact with an acceptable verdict exist somewhere."

## Control Center hours: confirm the definitions before building the calculation

- The owner's hour concepts were stated loosely twice and I built from my own reading both times. The agreed rules: available = seats x 160 (Consultant and Lead Consultant only, never Module Lead), allocated = filled seats x 160 scaled by allocation percentage, utilized = allocated scaled by the share of the selected month covered by project assignments.
- Card colors: green when utilized equals allocated, yellow when partly utilized, light red when none is, grey when nobody is deployed.
- When a metric has several similar-sounding terms, restate each one with a worked example and get a yes before writing code.

## Merging main into a branch can trigger the auto-merge early

- The auto-PR workflow merges a push when `tasks/last-gate-report.md` and at least one other file changed in that push. A merge of `origin/main` into a feature branch can bring in another session's gate report, so the push looks fresh before this branch's gate has run. PR 47 (https://github.com/ArshadGaniM/KaarTech-MENA-Digital-Factory/pull/47) was merged this way while its gate was still running.
- While a gate is running, do not push a merge of `main` that changes the report file. Run the gate on the merged code, and push the new gate report last.
- Merge `main` with a real merge and resolve conflicts by hand. `git merge origin/main --strategy=ours` keeps the branch's files and ignores main's changes, so a later squash of the branch reverts work that landed on `main` in the meantime. CLAUDE.md §9.3 Step 0 now prescribes a real merge, and the workflow only counts a push's own commits as a gate run (`scripts/gate-fresh.sh`), so a merge of `main` can no longer trigger the auto-merge early.

## Deploy order when a migration adds a required column

- Apply the migration to the database first, deploy the backend second, and let the frontend follow. Render hosts the API and did not redeploy on every merge to `main` in this project, so trigger the deploy and poll the API until it returns the new field.

## A squash from a stale branch deletes work that is already on main

- PR #40 was built from a branch cut before the Dashboard and Control Center merged, so its squash silently deleted both and removed `activeTotal`. The live Dashboard then counted deleted rows and nobody saw why until a screenshot showed it.
- Before merging any PR, read its diff stat for deletions of files the PR was never meant to touch. Rebase a long-lived branch onto `main` before the gate, not after.

## Full-page screenshots can catch width transitions mid-way

- A Playwright `fullPage` capture briefly resizes the page. Bars with a `transition: width` were caught partway and looked nearly empty, while the page itself measured correct. Check `getBoundingClientRect()` and take a normal viewport capture before calling it a CSS bug.


### Check platform facts against the live account before writing them down
CLAUDE.md said no deployment platform existed and no backend was built while both were live. Section 21 now holds IDs read from the Vercel and Render accounts. When a doc states a fact about hosting, read it from the platform, not from memory, and search the other files that repeat it (rule files, hook comments, .env.example).

### A test outside `src/*.test.js` never runs
The backend `npm test` glob is `src/*.test.js`. A first copy of the team-members test sat in `src/routes/` and was silently skipped. After adding a test file, check that the full suite count went up, and keep tests directly in `src/`.

### A hook that keeps the last result while loading must forget it after a failure
`useKeyedResource` keeps the previous result on screen while new filters load, so a chart does not blank. A failed fetch must then drop that result, and keep dropping it through the retry. Dropping it only while the error was set let the first filter's numbers come back under a third filter's chip as soon as a retry cleared the error. Two reviewers found it in the same round. Remember the failure in state, only ever write state from a callback that checks its request is still the current one (a slow answer for an old filter must not flip it), and test the sequences: load A, fail B, retry or pick C, and a late answer for B after C failed.

### Validate the raw query string, and build the error object from pairs
Express's default query parser silently removes a `__proto__` key, turns `a[b]=c` into an object and a repeated key into an array, so a validator that reads `req.query` can pass a request it should reject, and what it sees changes with the parser setting. Read the raw query string with `URLSearchParams`, collect `[key, message]` pairs, and build the 422 details with `Object.fromEntries`, because assigning to a key named `__proto__` on a plain object is also silently dropped. Test it under the `extended`, `simple` and `false` parser settings.

### The project plan is the owner's, and it is locked
The Project Plan section shows the owner's plan sheet. The owner said it must never change in wording, names, descriptions or dates unless they explicitly confirm, more than once. It is kept in `src/data/projectPlan.js`, frozen, with a hash lock test, and `.claude/rules/project-plan.md` states the rule. Do not fix a spelling in it (the sheet says "Measruing"), and do not edit it to match progress: track actuals beside it.
