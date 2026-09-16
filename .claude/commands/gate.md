---
description: Run the full quality-gate protocol against the merge target
---

Run the quality gate defined in `CLAUDE.md` §9.

1. Resolve `CURRENT_BRANCH=$(git branch --show-current)`.
2. Diff against the merge target: `git diff origin/main..HEAD`.
3. Launch all gate agents in parallel (§9.4): `code-reviewer`, `security-auditor`,
   `debugger`, `test-writer`, `refactorer`, `doc-writer`, `silent-failure-hunter`,
   `pr-test-analyzer`.
4. Apply the subagent verification rule (§8 / `.claude/rules/subagent-verification.md`)
   to any negative-existence claim from a gate agent before trusting it.
5. Compile the master gate report: agent-by-agent results table, detailed
   findings, prioritised action-item checklist.
6. Write the report to `tasks/last-gate-report.md`.
7. Determine verdict per §9.5 (PASS / WARN / BLOCKED). Any security finding,
   even WARN-level, upgrades to FAIL/BLOCKED.
8. Post the report as a comment on the GitHub PR for `${CURRENT_BRANCH}` if one exists.
9. Report the verdict to the user. If PASS or WARN, prompt: "Say 'Merge to Main' to merge."
   If BLOCKED, list blockers and stop.
