# Handoff

> Read automatically at the start of the next session (CLAUDE.md §22).

## Where things stand

- Repo was empty (no commits) at session start. Scaffolded a React 19 + Vite 8
  web app (JavaScript, oxlint) and committed it.
- Adopted the user-provided "project base document" as this project's
  `CLAUDE.md`, with placeholders filled for the actual stack (React + Vite,
  no backend yet) and the business-domain-specific sections left as open
  items (§23).
- Built out the full `.claude/` structure the document describes: agents
  (8 standing gate/utility agents + 30 dev-team pipeline agents), commands,
  hooks, rule files, the `dev-team.js` Workflow script, and the `scripts/`
  tooling (fetch-github-repo, update-skills, register_agent, register_skills,
  backlog_add, backlog_run).
- Added `.github/workflows/auto-pr.yml` and `autonomous-backlog.yml`.
- GitHub push access was blocked (Claude GitHub App not authorized for this
  repo), then resolved by the user; `main` and `claude/busy-newton-mne2w1`
  are both live on GitHub.
- **Ingested all 40 registered external sources** (`.claude/github-repos.json`)
  at the owner's explicit request, after being warned about the supply-chain
  risk of pulling in unvetted third-party agent/skill instructions. ~152MB
  across `.claude/skills/`, `.claude/agents/`, `.claude/commands/`,
  `.claude/hooks/`. See "Watch-outs" for the real bugs this surfaced and the
  security tradeoff it forced.

## What's next

- No actual product features exist yet — the app is the default Vite
  starter page. First real feature work should go through `/dev-team` or be
  auto-queued per §7.2, per the adopted pipeline rule.
- Decide whether the full 30-stage pipeline is right for this project's scale,
  or whether to run a lighter subset for early features.
- `.claude/agents/INDEX.md` and `.claude/skills/INDEX.md` were not
  regenerated after the 40-source ingestion — still only describe
  first-party content, not the vendored sources.
- Consider a deliberate security-review pass over the ingested content (none
  has happened) if this project ever handles anything sensitive.

## Watch-outs

- **The 40-source ingestion has not been security-reviewed.** Nothing in the
  ingested `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, or
  `.claude/hooks/` content has been checked for malicious or low-quality
  instructions. A real leaked credential or malicious instruction buried in
  vendored content would not currently be caught by anything in this repo —
  see the pre-commit scanner note below.
- **Pre-commit secret scanner is scoped to first-party files only** (not
  vendored content). This was a direct, explicit-owner-approved consequence
  of ingestion: vendored security-scanning skills' own test fixtures and
  regex pattern definitions kept false-positiving on both the heuristic
  (`api_key=`/`secret=`/`password=`) and the "unambiguous" (AWS keys, PEM
  blocks) patterns. See `.claude/hooks/pre-commit.sh` for the exact scoping
  and the tradeoff spelled out in its comments.
- **Real bugs found and fixed in `scripts/fetch-github-repo.sh` during
  ingestion** (all fixed, but worth knowing if the script misbehaves again):
  1. `find | grep -q .` under `set -o pipefail` silently failed to detect
     components when a source had many matches (grep's early exit sent
     SIGPIPE to a still-writing `find`) — fixed with a `-print -quit`
     based check.
  2. Skills/agents were copied flat by basename, so multiple files sharing a
     name collided into one (lost 13 of 14 skills on `superpowers` before
     the fix) — now each skill's own directory is preserved.
  3. Registry updates replaced the whole entry instead of merging, wiping
     the curated `components` description — now merges.
  4. The script derived its slug from the URL basename, which doesn't match
     a curated registry slug that differs from the raw repo name (6 of the
     40 sources hit this: `agent-reach`, `anthropics-skills`, `omniroute`,
     `openmontage`, `system-prompts-leaks`, `ui-ux-pro-max`) — script now
     takes an optional slug-override argument.
  5. A repo with `SKILL.md` at its repository root (`ruflo`) caused the
     whole 137MB clone — source, build artifacts, its own `.git` — to be
     copied as "one skill". Fixed to just take the root `SKILL.md` file
     itself in that case, and to always strip any nested `.git` from a
     copied skill directory.
  6. A single unreadable file (a dangling symlink, found in `claude-skills`)
     aborted the entire script under `set -e`, dropping every skill after it
     and skipping the registry update — now warns and continues.
- **`.claude/hooks/pre-commit.sh` also had a vendored-content lint gap**:
  the frontend/backend linter exclusion only covered `.claude/skills/**` and
  `.claude/agents/<slug>/**`, not vendored `.claude/commands/<slug>_*.md` or
  `.claude/hooks/<slug>_*.sh` — those were getting scanned against our own
  lint/secret rules. Fixed.
- The pipeline, gate, and backlog automation in `CLAUDE.md` assume a live
  backend/DB and a chosen deployment platform for some steps (agent
  registration API, deployment verification) — those are explicitly marked
  forward-looking/placeholder until a backend exists.

## Open questions

- What should this web app actually do? No business domain has been defined yet.
- Should any of the 40 ingested sources go through an actual security/quality
  review before being trusted as active tooling?
