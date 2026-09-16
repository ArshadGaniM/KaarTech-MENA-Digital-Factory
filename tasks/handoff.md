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
  hooks, rule files, the `dev-team.js` Workflow script, GitHub repo registry,
  and the `scripts/` tooling (fetch-github-repo, update-skills, register_agent,
  register_skills, backlog_add, backlog_run).
- Added `.github/workflows/auto-pr.yml` and `autonomous-backlog.yml`.
- Everything above is **committed locally** but **not pushed** — see Watch-outs.

## What's next

- Get GitHub push access sorted (see Watch-outs), then push.
- Decide whether the full 30-stage pipeline is right for this project's scale,
  or whether to run a lighter subset for early features (§23 open item).
- No actual product features exist yet — the app is the default Vite
  starter page. First real feature work should go through `/dev-team` or be
  auto-queued per §7.2, per the adopted pipeline rule.

## Watch-outs

- **GitHub push is blocked.** `git push` to
  `ArshadGaniM/KaarTech-MENA-Digital-Factory` fails with a 403: the Claude
  GitHub App isn't installed/authorized for this repo. Needs either an org
  admin installing the app (https://github.com/apps/claude/installations/select_target)
  or the user reconnecting GitHub in claude.ai settings. Until this is fixed,
  every session's work stays local-only and must be re-verified as committed
  (not just staged) before ending.
- The pipeline, gate, and backlog automation in `CLAUDE.md` assume a live
  backend/DB and a chosen deployment platform for some steps (agent
  registration API, deployment verification) — those are explicitly marked
  forward-looking/placeholder until a backend exists.

## Open questions

- What should this web app actually do? No business domain has been defined yet.
