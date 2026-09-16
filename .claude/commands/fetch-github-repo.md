---
description: /fetch-github-repo <url> — ingest skills/agents/commands/hooks from an external repo
argument-hint: <github-url>
---

Given GitHub URL `$1` (also auto-triggers on any `github.com/...` URL in a user message):

1. Run `scripts/fetch-github-repo.sh $1`.
2. It detects and extracts, per `CLAUDE.md` §13.2:
   - `SKILL.md` files / `skills/` dirs → `.claude/skills/<slug>/`
   - `agents/*.md`, `.claude/agents/*.md` → `.claude/agents/<slug>_*.md`
   - `commands/*.md`, `.claude/commands/*.md` → `.claude/commands/<slug>_*.md`
   - `hooks/*.sh`, `.claude/hooks/*.sh` → `.claude/hooks/<slug>_*.sh`
3. Registers `$1` in `.claude/github-repos.json` (slug, URL, type, components, last-fetched).
4. Runs the agent/skill auto-registration step (`CLAUDE.md` §14) for anything new.
5. Commits with message: `Integrated external repo: <REPO_NAME> on <DATE>`.
