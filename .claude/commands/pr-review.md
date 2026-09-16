---
description: /pr-review <number> — run the review + security agents against an existing PR
argument-hint: <pr-number>
---

Given PR number `$1`:

1. Fetch the PR's diff.
2. Run `code-reviewer` and `security-auditor` against it (apply the subagent
   verification rule from `.claude/rules/subagent-verification.md` to any
   negative-existence claim).
3. Post findings as a single PR comment, ending with the required attribution footer.
4. Summarize the verdict to the user (PASS / WARN / BLOCKED per `CLAUDE.md` §9.5).
