# Gate Report: standing yes for safe migrations, queue status

**Verdict: WARN** (zero FAIL, zero Critical.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was up to date.
**Scope:** `git diff origin/main..HEAD`, docs only. No code, test or migration changed.
- `CLAUDE.md` §21 step 1: the owner's standing yes (1 Nov 2026) for safe migrations, with a written definition of safe and of unsafe.
- `.claude/rules/database.md` points to §21 for that definition.
- `tasks/lessons.md` records the owner's confirmation. `tasks/handoff.md` gets a "Migrations applied" list.
- `tasks/pipeline-queue.md`: FEAT-35 to FEAT-37 marked merged and deployed.

**Checks:** backend 450/450 and frontend 564/564 pass. No test reads the changed files.

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS | Wording consistent |
| security-auditor | WARN | Backfill wording and mixed migrations could pass as safe (fixed) |
| debugger | WARN | Safe definition contradicted itself on backfills (fixed) |
| test-writer | PASS | 564 frontend tests pass, no test reads the docs |
| refactorer | WARN | Two copies of the rule (fixed, one source in §21) |
| doc-writer | WARN | Stale queue wording (fixed) |
| silent-failure-hunter | WARN | Add-only gaps, no durable record (fixed) |
| pr-test-analyzer | PASS | No code changed |

All agents ran on Sonnet.

## Fixed in this push

- A fill of the new column may touch only that column. Any other UPDATE or DELETE makes the migration unsafe.
- A migration that mixes an add with a drop or replace is unsafe as a whole.
- A new constraint must hold on the live data and must not reject writes the running backend makes.
- One transaction or a written reverse statement is required.
- Each applied migration goes into `tasks/handoff.md`.
- The standing yes has no end date and the owner can withdraw it. `database.md` no longer restates the definition.
- The queue rows no longer say "on the branch only".

## Open, not blocking

- [ ] The agent applying a migration also judges it safe. The handoff list gives the owner a place to review.
