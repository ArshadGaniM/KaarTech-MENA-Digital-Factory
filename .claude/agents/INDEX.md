# Agent Index — task-type → agent

See CLAUDE.md §18 for routing policy: prefer first-party agents; reach for a
vendored agent only for a niche first-party genuinely doesn't cover.

## First-party (always prefer these first)

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

## Vendored niches promoted for use (first-party doesn't cover these)

These are the specific gaps identified so far. Only use a vendored agent
outside this list if you've confirmed first-party genuinely has no
equivalent — check here first.

| Niche | Agent |
|---|---|
| Build/compile-error resolution, per language (C++, C#, Dart/Flutter, Django, Go, Java, Kotlin, PHP, PyTorch, React, Rust, Swift) | `everything-claude-code/<lang>-build-resolver.md` |
| Language-specific idiomatic code review (C++, C#, Django, Flutter, F#, Go, Java, Kotlin, PHP, Python, React, Rust, Swift, TypeScript, Vue) | `everything-claude-code/<lang>-reviewer.md` |
| MCP server/protocol implementation work | `n8n-mcp/mcp-backend-engineer.md` |
| CI/CD pipeline & container/Kubernetes deployment design | `n8n-mcp/deployment-engineer.md` |
| Accessibility (WCAG) architecture review | `everything-claude-code/a11y-architect.md` |
| Network design/troubleshooting (routing, DNS, homelab) | `everything-claude-code/network-architect.md`, `network-troubleshooter.md`, `homelab-architect.md` |
| Financial analysis (burn rate, runway, startup metrics) | `claude-cookbooks/financial-analyst.md` |
| Technical recruiting / hiring evaluation | `claude-cookbooks/recruiter.md` |
| RAG pipeline review (retrieval, chunking, embeddings) | `everything-claude-code/rag-pipeline-reviewer.md` |
| Open-sourcing a repo (secret/PII scrub, packaging) | `everything-claude-code/opensource-forker.md`, `opensource-sanitizer.md`, `opensource-packager.md` |

## Vendored sources — inventory (not individually routed)

Everything else ingested lives under `.claude/agents/<slug>/`. Read a
source's own `.md` files directly when a task falls in its territory and
nothing above already routes there.

| Slug | Count | What's there |
|---|---|---|
| `agent-skills` | 4 | code-reviewer, security-auditor, test-engineer, web-performance-auditor |
| `anthropics-skills` | 3 | analyzer, comparator, grader (skill-creation support agents) |
| `claude-code` | 14 | Claude Code plugin/skill authoring agents (agent-sdk-verifier, code-architect, plugin-validator, type-design-analyzer, etc.) |
| `claude-code-router` | 10 | per-model-provider router configs (claude-code, codex, grok, kimi, etc.) |
| `claude-cookbooks` | 7 | citations, financial-analyst, recruiter, research_lead_agent, research_subagent |
| `claude-skills` | 167 | very broad C-level advisory + business-ops agent set (cs-*-advisor, cs-*-engineer, wiki-*, content-*) — mostly business/strategy, not engineering |
| `context7` | 2 | docs-researcher (library documentation lookup) |
| `everything-claude-code` | 73 | per-language build-resolvers/reviewers, a11y, network, healthcare, marketing, security-reviewer, tdd-guide, spec-miner |
| `get-shit-done` | 37 | `gsd-*` planning/execution pipeline agents (roadmapper, planner, executor, verifier, doc-writer) |
| `impeccable` | 8 | visual-polish/design-critique pipeline (asset-producer, documenter, finish-reviewer, manual-edit-applier) |
| `n8n-mcp` | 8 | code-reviewer, context-manager, debugger, deployment-engineer, mcp-backend-engineer, technical-researcher, test-automator |
| `openmontage` | 15 | video/media generation & editing agent set (director, builder, outbound-calls, widget-embedding) |
| `repomix` | 9 | repo-analysis reviewer swarm (conventions, cross-platform, docs-i18n, performance, security, test-coverage) |
| `ruflo` | 200 | very large multi-agent swarm/orchestration framework (coordinators, DDD, security-architect, trading, vector/memory specialists) — mostly infra for ruflo's own runtime, not standalone task agents |
| `system-prompts-leaks` | 6 | Explore, Plan, claude-code-guide, general-purpose, statusline-setup |
| `ui-ux-pro-max` | 1 | design-review |

`dev-team` is excluded above — it's first-party (CLAUDE.md §7.8).
