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
