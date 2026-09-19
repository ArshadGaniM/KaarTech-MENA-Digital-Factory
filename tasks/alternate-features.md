# Alternate Feature Registry

> Real work that exists in the codebase but isn't (yet, or ever) merged to
> main. Never silently dropped. See CLAUDE.md §15.

| ID | Description | Branch | Progress point | Status | Notes |
|---|---|---|---|---|---|
| ALT-1 | "Merge to Main" gate run (CLAUDE.md §9.3) on the 4 unmerged commits (Resource Cost/Teams/Resource Deployment tables, Resources table + real HR-export columns/data, permission-allowlist changes). | claude/trusting-curie-hlx1r6 | **Resolved.** Discovered the in-session gate never actually controlled the merge: `.github/workflows/auto-pr.yml`'s auto-merge check only verified `tasks/last-gate-report.md` existed and wasn't BLOCKED — no freshness check — so a stale WARN report from an old feature had been silently authorizing every push to squash-merge, including the unresolved `execute_sql` Critical below. Fixed both: removed `mcp__Supabase__execute_sql` from `.claude/settings.json`'s allowlist, and added a freshness check to the workflow (report must be touched by this push AND accompanied by another changed file). Ran a fresh 8-agent gate on that fix itself (1 Critical: force-push could crash the workflow step; 1 Warning-upgraded-to-FAIL: freshness check only proved path-touch not content-diff — both fixed). Merged via PR #18 at 2026-09-19T08:34:34Z. | resolved | See `tasks/lessons.md` for the pattern (stale gate report silently authorizing merges) so it isn't reintroduced. Resources data import (batches 046–098, ~1654 rows) is a separate, still-paused item — not part of this. |
