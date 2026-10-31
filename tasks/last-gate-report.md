# Gate Report: lessons from the early auto-merge and the stale-base merges

**Verdict: WARN** (zero FAIL, zero Critical, security PASS clean)

**Branch:** `claude/sleepy-hopper-bpow3i` to `main`
**Scope:** `git diff origin/main..HEAD` is `tasks/lessons.md` only. Two lesson entries are added: how merging `main` into a branch can trigger the auto-merge before the gate has run, and the deploy order when a migration adds a required column. No code changed. Everything else from this branch (department floor number, floors built from data, the live team popup) is already merged and live.
**Checks run:** frontend 236/236 and backend 297/297 tests pass on this branch.

## Agent results

| Agent | Verdict | Summary |
|---|---|---|
| code-reviewer | WARN | Two real points, both fixed below. |
| security-auditor | PASS | No secrets, hostnames or unsafe content. |
| debugger | PASS | Documentation only. Both suites green. |
| test-writer | PASS | No executable lines, so no coverage question. |
| refactorer | WARN | Same two points, fixed below. |
| doc-writer | WARN | Same two points plus a missing link, fixed below. |
| silent-failure-hunter | PASS | No code changed. |
| pr-test-analyzer | PASS | No tests needed. |

Subagent verification rule (CLAUDE.md §8): the agents compared the lesson text with `.github/workflows/auto-pr.yml` and CLAUDE.md §9.3 by direct read. Eight agents ran on `sonnet` because the `deep` and `fast` model aliases in their definitions do not exist here.

## Fixed in this push

- The lesson about `--strategy=ours` no longer says "never". It says the "keep my version" merge keeps the branch's files and ignores main's changes, so a later squash reverts work that landed on `main`, and to use it only when the branch already holds everything on `main` that should stay.
- The unworkable advice to keep work on a branch the workflow does not watch is removed. The workflow watches every branch except `main`. The rule is now: do not push a merge of `main` that changes the report file while a gate runs, and push the gate report last.
- The deploy-order lesson has its own heading.
- The PR 47 claim now links to the pull request.

## Open (not blocking)

- [ ] CLAUDE.md §9.3 Step 0 still prescribes the "keep my version" merge as mandatory. It contradicts the lesson. The owner decides whether Step 0 should change.
- [ ] The auto-merge workflow counts a merge-of-`main` push as a fresh report. A check that the report changed in this branch's own commits would stop the early merge. That is a separate workflow change.
- [ ] CLAUDE.md §21 still says no deployment platform is wired up, but Vercel and Render are in use.
