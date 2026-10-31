# Gate Report: fresh-gate check and Step 0 fix

Verdict: ⚠️ WARN (no FAIL, no Critical)

Scope: `.github/workflows/auto-pr.yml`, `CLAUDE.md` §9.3, `scripts/gate-fresh.sh`, `scripts/gate-fresh.test.sh`, `tasks/lessons.md`.

What changed:
- A push counts as a fresh gate run only when its own commits change the report and at least one other file. Merge commits and commits already on `main` do not count.
- CLAUDE.md §9.3 Step 0 now prescribes a real merge. It no longer uses `--strategy=ours`.
- The workflow passes `github.ref_name`, `github.event.before` and `github.sha` through `env:` and no longer interpolates them into shell text.

## Agent results

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Tests 4 and 5 never built a real merge. Fixed. Workflow now falls back to `false` if the script errors. Fixed. |
| security-auditor | FAIL, then PASS | First run found script injection through `github.ref_name`. Fixed with `env:`. Re-audit: PASS. |
| debugger | PASS | Traced `set -euo pipefail` paths. No unhandled failure. |
| test-writer | WARN | Branch coverage was low. Added 5 cases, now 13 and all pass. |
| refactorer | WARN | Comment repetition and two redundant lines. Not fixed, non-blocking. |
| doc-writer | PASS | Contract is consistent in all five places. New-branch sentence added to Step 5. |
| silent-failure-hunter | WARN | `git fetch` failure was swallowed. Fixed: the script now prints `false`. |
| pr-test-analyzer | PASS | Tests check behaviour and clean up after themselves. |

Subagent file-existence claims: none made. (manual cross-check not needed)

## Open WARN items

- [ ] Trim repeated "fresh" comments in the workflow (refactorer).
- [ ] Drop the redundant `sed` in `gate-fresh.sh` (refactorer).
- [ ] `gh pr merge --auto || true` hides merge failures. Existing line, not in this diff.
- [ ] Actions are pinned by tag, not SHA. Existing.
- [ ] The check is self-attested by the pusher. A writer can edit the script. Accepted for a single-maintainer repo.
- [ ] `scripts/gate-fresh.test.sh` is not wired into CI.
