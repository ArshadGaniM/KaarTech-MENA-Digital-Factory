# Alternate Feature Registry

> Real work that exists in the codebase but isn't (yet, or ever) merged to
> main. Never silently dropped. See CLAUDE.md §15.

| ID | Description | Branch | Progress point | Status | Notes |
|---|---|---|---|---|---|
| ALT-1 | "Merge to Main" gate run (CLAUDE.md §9.3) on the 4 unmerged commits (Resource Cost/Teams/Resource Deployment tables, Resources table + real HR-export columns/data, permission-allowlist changes). Squash-divergence repair already done and pushed (merge commit d126cb3). | claude/trusting-curie-hlx1r6 | 4 of 8 gate agents finished before pause: refactorer (no findings), security-auditor (**Critical**: `.claude/settings.json` auto-approving `mcp__Supabase__execute_sql` — upgrades gate to FAIL per §9.5), test-writer (PASS, 50/50, coverage adequate for logic, router wiring untested), pr-test-analyzer (gaps: `duplicateFieldError`'s non-matching-constraint fallback untested, NaN case untested despite test name). code-reviewer/debugger/doc-writer/silent-failure-hunter were stopped mid-run, unfinished. | halted | Paused by explicit user instruction, to resume when told. Known remediation needed before re-running gate: remove or scope down the `execute_sql` allowlist entry to clear the Critical security finding. Resources data import (batches 046–098, ~1654 rows) is a separate, also-paused item — not part of this halt. |
