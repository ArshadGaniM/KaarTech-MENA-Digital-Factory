# Skill Index — task-type → skill

See CLAUDE.md §13.6/§18 for routing policy. No first-party skills exist yet
(the project has none of its own) — everything below is vendored, ingested
via `/fetch-github-repo`. This project has no domain-specific skill needs
yet either (§0/§23 — feature scope still open), so nothing here is a "first
resort" the way the agent INDEX's first-party table is; treat every entry
as "reach for this specific one when the task matches," not a default.

## Routing by task type (most useful ingested skills for common needs)

| Task type | Skill(s) | Source |
|---|---|---|
| Convert a document (PDF/Word/etc.) to Markdown | `convert-documents-to-markdown` | `anydoc` |
| Generate/edit PDF, DOCX, PPTX, XLSX files | `pdf`, `docx`, `pptx`, `xlsx` | `anthropics-skills` |
| Build/register an MCP server | `mcp-builder` | `anthropics-skills` |
| Test a web app end-to-end | `webapp-testing` | `anthropics-skills` |
| Architecture/dataflow/sequence diagrams | `archify`, `archify-review` | `archify` |
| n8n workflow authoring/debugging | `n8n-workflow-patterns`, `n8n-error-handling`, `n8n-validation-expert`, etc. (15 total) | `n8n-mcp` |
| Multi-provider LLM routing/proxy CLI | `omni-*`, `cli-*` (47 total) | `omniroute` |
| Video/media generation & editing | 90 skills — `remotion`, `ffmpeg`, `elevenlabs`, `threejs-*`, `hyperframes-*`, etc. | `openmontage` |
| UI/design taste critique, redesign | `taste-skill`, `brutalist-skill`, `minimalist-skill`, `redesign-skill` | `taste-skill` |
| UI/UX system design (banners, brand, slides) | `banner-design`, `brand`, `design-system`, `slides`, `ui-styling` | `ui-ux-pro-max` |
| Marketing (SEO, ads, copywriting, CRO, retention) | ~50 skills — `seo-audit`, `ads`, `copywriting`, `cro`, `churn-prevention`, `pricing`, etc. | `marketingskills` |
| Business/C-level advisory (CFO, CTO, CMO, CISO, etc.) | `cs-*-advisor` (one per exec role) | `claude-skills` |
| Git worktrees, subagent-driven dev, systematic debugging workflow | `using-git-worktrees`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `writing-plans` | `superpowers` |
| Library/API documentation lookup | `context7-cli`, `context7-mcp`, `find-docs` | `context7` |
| Obsidian vault manipulation | `obsidian-bases`, `obsidian-cli`, `obsidian-markdown`, `json-canvas` | `obsidian-skills` |
| Agent/skill authoring meta-work (writing new skills, plugin structure) | `skill-development`, `command-development`, `agent-development`, `plugin-structure` | `claude-code` |
| Karpathy-style code-quality review | `karpathy-guidelines` | `andrej-karpathy-skills` |
| Browser automation (scrape, login, test, screenshot) | `browser-scrape`, `browser-test`, `browser-login`, `browser-screenshot-diff` | `ruflo` |

## Vendored sources — full inventory

Everything below lives under `.claude/skills/<slug>/`. For anything not
covered by the routing table above, `Read` the source's own `SKILL.md`
files directly rather than guessing from the name alone.

| Slug | Skill count | What's there |
|---|---|---|
| `agent-browser` | 10 | Vercel agent-browser tooling (electron, slack, vercel-sandbox, webmcp-gen) |
| `agent-reach` | 1 | career/dev/finance/search/social/video/web reference lookup |
| `agent-skills` | 25 | general engineering workflow skills (code-review, TDD, spec-driven dev, git workflow) |
| `andrej-karpathy-skills` | 1 | karpathy-guidelines (code quality philosophy) |
| `anthropics-skills` | 20 | pdf/docx/pptx/xlsx, mcp-builder, canvas-design, webapp-testing, brand-guidelines |
| `anydoc` | 1 | convert-documents-to-markdown |
| `archify` | 2 | architecture/dataflow diagram rendering |
| `claude-code` | 10 | Claude Code plugin/skill/agent/command/hook authoring |
| `claude-cookbooks` | 9 | financial modeling, Slack/Sentry/Linear integration cookbooks |
| `claude-mem` | 26 | memory/knowledge persistence tooling (mem-search, timeline-report, standup) |
| `claude-skills` | 464 | huge business/C-level + engineering skill library (cs-*-advisor, cs-*-engineer, marketing, compliance, wiki-*) |
| `codegraph` | 2 | agent-eval, add-lang |
| `context7` | 4 | library documentation lookup (CLI, MCP, docs) |
| `design-motion-principles` | 1 | UI motion/animation audit + creation |
| `everything-claude-code` | 294 | very broad: language patterns/testing (20+ languages), compliance (HIPAA/GDPR), infra (k8s, terraform), agent-ops, TDD workflows |
| `get-shit-done` | 0 | (agents only under this source, no SKILL.md extracted) |
| `impeccable` | 2 | audit, impeccable (visual-polish critique) |
| `learn-claude-code` | 4 | agent-builder, code-review, mcp-builder, pdf |
| `marketingskills` | 50 | SEO, ads, copywriting, CRO, email, social, pricing, retention |
| `n8n-mcp` | 15 | n8n workflow building/debugging/validation |
| `obsidian-skills` | 6 | Obsidian vault manipulation |
| `omniroute` | 47 | multi-provider LLM routing/proxy CLI toolchain |
| `one-skill-to-rule-them-all` | 1 | single general-purpose skill |
| `openmontage` | 90 | video/media generation and editing toolchain |
| `orca` | 8 | computer-use, orchestration, Linear ticket integration |
| `repomix` | 6 | repo packaging/exploration (browser-extension-developer, contextual-commit) |
| `ruflo` | 284 | very large agent-swarm/orchestration framework's own skill set (browser automation, cost tracking, DDD, harness tooling, trading) |
| `superpowers` | 14 | brainstorming, TDD, git worktrees, systematic debugging, code-review workflows |
| `system-prompts-leaks` | 54 | Claude/Anthropic product skill set (artifacts, design, deep-research, storybook, PPTX export) |
| `taste-skill` | 13 | design-taste critique/redesign skills |
| `ui-ux-pro-max` | 7 | banner-design, brand, design-system, slides, ui-styling |

## Sources with no extractable skills

Registered in `.claude/github-repos.json` but contributed nothing here —
curated reference lists or a structural convention our detection doesn't
match (see CLAUDE.md §13.1): `awesome-agent-skills`, `awesome-ai-agents`,
`awesome-claude-code`, `awesome-claude-code-subagents`,
`awesome-claude-design`, `awesome-openclaw-skills`, `design-md-chrome`,
`headroom`.
