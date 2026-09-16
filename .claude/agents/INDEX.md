# Agent Index — task-type → agent

See CLAUDE.md §18 for routing policy.

| Task type | Agent |
|---|---|
| PR/diff review for bugs, conventions | `code-reviewer` |
| Root-cause a failure/error | `debugger` |
| Check for undocumented public APIs | `doc-writer` |
| Flag duplication/complexity | `refactorer` |
| Security review (OWASP) | `security-auditor` |
| Test coverage check / write tests | `test-writer` |
| Test quality review | `pr-test-analyzer` |
| Swallowed-error audit | `silent-failure-hunter` |
| Plan a non-trivial task (3+ steps) | `planner` |
| Full staged feature pipeline | `.claude/workflows/dev-team.js` (see §7 — never invoke `orchestrator.md` as a subagent) |

`dev-team/` holds one file per pipeline stage (CLAUDE.md §7.4) — invoked
through the Workflow tool's role-resolution option, not called ad-hoc.
