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

- The auto-PR workflow merges a push when `tasks/last-gate-report.md` and at least one other file changed in that push. Merging `origin/main` into a feature branch brings in other sessions' gate reports, so the push looks "fresh" even though this branch's gate has not run. PR 47 merged that way while the gate was still running.
- While a gate is running, do not push a merge of `main` that changes the report. Run the gate against the merged code first and push the report last, or keep the work on a branch the workflow does not watch until the gate is done.
- A "keep my version" merge (`--strategy=ours`) deletes work that landed on `main` in the meantime. Always use a real merge and resolve conflicts by hand.
- Apply a required-column migration before the code that reads it is deployed, deploy the backend, then let the frontend follow. Render does not redeploy on every merge, so trigger it and poll the API for the new fields.
