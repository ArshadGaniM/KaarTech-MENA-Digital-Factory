# KaarTech MENA Digital Factory — Project Memory

> This file is the single source of truth for Claude working on this project.
> Read it fully at the start of every session before touching any code.

---

## 0. Product

KaarTech MENA Digital Factory is an internal management application for an
IT development "digital factory" — an organization that runs software
delivery as an ongoing production operation rather than one-off projects.
The app's job is to manage:

- **Resources** — people, tools, and capacity available to the factory
- **Process** — how work moves through the factory (workflow/pipeline stages,
  handoffs, status)
- **Team setup** — org structure, roles, team composition

Concrete scope (specific modules, data model, user roles, screens) is not
yet defined — see §23. Current stack:

- **Frontend:** React 19 + Vite 8, JavaScript (ES modules), CSS Modules-ready
- **Linting:** oxlint
- **Package manager:** npm
- **Backend / database:** not yet built — §10 (API Rules) and §11 (Database Rules)
  below are the standing conventions to follow **once** a backend is added.
  Until then they are forward-looking, not currently enforced.

Specific integrations and production infrastructure are not yet defined —
fill in as they are decided. Everything below this point is
the tooling/process layer and applies regardless of feature domain.

---

## 1. Core Principles

- **Simplicity First** — Make every change as simple as possible. Minimal code impact.
- **No Laziness** — Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact** — Only touch what is necessary. Avoid introducing bugs in unrelated code.
- **No Comments on the Obvious** — Only comment the WHY when it's non-obvious. Never describe WHAT.
- **No Unused Code** — Don't leave dead imports, commented-out blocks, or unused variables.
- **Security by Default** — Validate at system boundaries. Never trust user input. Secrets in env vars only.

---

## 2. Model Strategy

**Model ceiling (owner's standing instruction — applies to every agent on
this project, not just the dev-team pipeline):** no agent, of any kind,
runs on a model above Sonnet by default. Where an agent already has Haiku
assigned, it stays on Haiku. Where an agent is assigned Sonnet, it stays on
Sonnet. Any agent that was assigned Opus (or anything above Sonnet) has
been brought down to Sonnet — see `scripts/register_agent.py`'s
`MODEL_KEYWORDS` mapping (the concrete tier-to-model resolution) and,
once agent auto-registration runs per §14 (forward-looking — no backend
exists yet to register against), `.claude/agents/registry.json` as the
resulting inventory. Opus (or any
higher-than-Sonnet model) may be used **only** when Sonnet/Haiku
demonstrably cannot achieve the task, and **only** with the owner's
explicit, one-time ("allow once") approval for that specific use — never
pre-approved, never assigned as a default for a role.

**Trigger condition — when to ask:** if the assigned model (Sonnet or
Haiku) fails at a task repeatedly for the same agent/role — not one
retry, a genuine pattern (e.g. the same stage errors out or produces
unusable output across multiple consecutive attempts) — stop retrying
blindly on the same model and do not silently give up either. Instead,
explicitly ask the owner for one-time permission to use a higher model
for that specific job, stating what was tried and why a higher model is
believed necessary. Only after the owner approves that specific request
does the higher-model call happen — and only for that one job. The
approval never carries over to the next failure or the next agent; ask
again each time.

| Phase | Model tier | When |
|---|---|---|
| **Planning** | Deep-reasoning tier (Sonnet-class, capped per the model ceiling above) | Any task with 3+ steps, architectural decisions, ambiguous requirements |
| **Execution** | Fast/execution tier (Sonnet-class) | All regular prompts, all agent runs, all code writing |

**Rule:** Before writing a single line of code on any non-trivial task, invoke a planning agent (deep-reasoning tier) via `/plan <description>`. The planning tier thinks, the execution tier builds.

**Never skip planning for:**
- New features touching multiple files or layers
- New dependencies or services
- Database schema changes
- Any task where the approach is unclear

**Skip planning for:**
- Single-line fixes
- Config value changes
- Renames
- Adding a single test

---

## 3. Repository / File Map

```
KaarTech-MENA-Digital-Factory/
├── CLAUDE.md                          ← this file — permanent project memory
├── README.md                          ← public-facing overview
├── .gitignore
│
├── .claude/
│   ├── settings.json                  ← model choice, lifecycle hooks
│   ├── agents/
│   │   ├── code-reviewer.md, debugger.md, doc-writer.md, refactorer.md,
│   │   │   security-auditor.md, test-writer.md, planner.md, orchestrator.md
│   │   ├── dev-team/                  ← one .md file per pipeline specialist (see §7)
│   │   └── <external-source-slug>/    ← agents pulled in via /fetch-github-repo
│   ├── commands/
│   │   ├── fix-issue.md               ← /fix-issue <number>
│   │   ├── deploy.md                  ← /deploy [staging|production]
│   │   ├── pr-review.md               ← /pr-review <number>
│   │   ├── gate.md                    ← /gate — full quality-gate protocol (see §9)
│   │   ├── dev-team.md                ← manual pipeline trigger (auto-trigger is primary — §7)
│   │   ├── fetch-github-repo.md       ← /fetch-github-repo <url>
│   │   └── session-end.md
│   ├── hooks/
│   │   ├── pre-commit.sh   (chmod+x)  ← git pre-commit chain (see §5)
│   │   ├── lint-on-save.sh (chmod+x)
│   │   ├── session-start.sh           ← weekly skill/agent/command sync (see §13)
│   │   ├── bash-guard.sh              ← PreToolUse hook — blocks destructive Bash commands
│   │   └── post-edit-format.sh        ← PostToolUse hook — best-effort autoformat on save
│   ├── rules/
│   │   ├── api.md                     ← REST design conventions (see §10, forward-looking)
│   │   ├── database.md                ← model/query/migration conventions (see §11, forward-looking)
│   │   ├── frontend.md                ← component/state/styling conventions (see §12)
│   │   └── subagent-verification.md   ← sandbox hallucination safety net (see §8)
│   ├── workflows/
│   │   └── dev-team.js                ← Workflow-tool script implementing the staged pipeline (see §7)
│   ├── github-repos.json              ← external repo ingestion registry (see §13)
│   └── skills/                        ← populated by external ingestion + hand-written skills
│
├── scripts/
│   ├── update-skills.sh               ← weekly external-source sync script
│   ├── fetch-github-repo.sh           ← one-shot external repo ingestion script
│   ├── register_agent.py / register_skills.py
│   ├── backlog_add.py
│   └── backlog_run.py
│
├── .github/
│   └── workflows/
│       ├── auto-pr.yml                ← opens/updates PR on push, gate report as PR body
│       └── autonomous-backlog.yml     ← scheduled backlog executor (see §16)
│
└── tasks/
    ├── todo.md
    ├── lessons.md
    ├── handoff.md
    ├── backlog.md
    ├── pipeline-queue.md
    ├── pipeline-runs.md
    ├── alternate-features.md
    ├── last-gate-report.md
    └── agent-outputs/<role>/<id>.json
```

---

## 4. Personal Overrides — `CLAUDE.local.md` + `settings.local.json`

Both are gitignored. Templates committed as `CLAUDE.local.md.example` and `.claude/settings.local.json.example`.

| File | Purpose |
|---|---|
| `CLAUDE.local.md` | Personal paths, "when I say X" shortcuts, current focus. Loaded alongside `CLAUDE.md` every session. |
| `.claude/settings.local.json` | Per-machine model override, env vars, Bash allowlist. Overlays `.claude/settings.json`. |

```bash
cp CLAUDE.local.md.example CLAUDE.local.md
cp .claude/settings.local.json.example .claude/settings.local.json
```

---

## 5. Pre-commit Hook

Lives at `.claude/hooks/pre-commit.sh`, installed at `.git/hooks/pre-commit`.

**To re-install after a fresh clone:**
```bash
cp .claude/hooks/pre-commit.sh .git/hooks/pre-commit
```

**What it checks (in order):**
1. Type check (once TypeScript is adopted — currently a no-op for plain JS)
2. `oxlint` on staged frontend files
3. Backend linter on staged files (once a backend exists)
4. Secret scan on staged diff — blocks if API keys or passwords detected

**Known behaviour:** the linter step skips gracefully if no linter config is present — don't treat that as a bug.

### Claude Code lifecycle hooks (in `.claude/settings.json`)

| Event | Matcher | Script | Purpose |
|---|---|---|---|
| `SessionStart` | `*` | `.claude/hooks/session-start.sh` | Weekly skill/agent/command sync (async, background — see §13) |
| `PreToolUse` | `Bash` | `.claude/hooks/bash-guard.sh` | Block unambiguously destructive commands |
| `PostToolUse` | `Edit\|Write\|MultiEdit` | `.claude/hooks/post-edit-format.sh` | Best-effort autoformat: `oxlint --fix` on frontend files |

`bash-guard.sh` exits 2 to block; keep the matcher list conservative.

---

## 6. Workflow Orchestration — Plan Mode, Subagents, Self-Improvement

### Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building

### Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Review `tasks/lessons.md` at the start of every session

### Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness

### Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes

### Autonomous Bug Fixing
- When given a bug report: just fix it. Point at logs/errors/failing tests, resolve them.

---

## 7. The Staged Development Pipeline (dev-team pattern) — PERMANENT

> This is the non-negotiable rule for ALL non-trivial feature development on the project.
> Every change, every new feature, every bug — goes through this pipeline. No exceptions.
> No writing code directly for anything beyond a single-line fix, config change, rename, or single test.

### 7.1 Execution mechanism — Workflow tool, NOT a subagent orchestrator

If the sandbox forbids a subagent from spawning further subagents (surfaces as
`Error: No such tool available: Task. Task is disabled for this session, in subagents as well as here.`),
an orchestrator-as-subagent design is structurally impossible. **Do not invoke a
"run the whole pipeline" agent via the Agent/Task tool** — it will either error or
silently have zero effect. `orchestrator.md` is kept for reference only, with a
comment at its top explaining why it's inert.

**The real mechanism is the Workflow tool**, running the pipeline as a script from
the top level. The canonical script is `.claude/workflows/dev-team.js`.

### 7.2 Auto-Trigger — No command needed

**The owner will never type the manual trigger command.** They give prompts directly.

**Analyse every prompt: is this a change, feature, or bug?**
If yes → immediately queue it into the pipeline. Do NOT ask for confirmation. Do NOT
write code yourself. Just dispatch. Pure questions/explanations are the only exception.

**Protocol, every time:**
1. Read the persistent feature counter, increment it, assign `FEAT-{N}`.
2. Append a row to `tasks/pipeline-queue.md` (status: `queued`).
3. Don't stop a live run just to fold in a new/amended feature unless the owner
   explicitly says to — it gets picked up at the run's next natural settle point.
4. Once a run has settled, resume it with every queued/amended feature appended
   via the harness's resume-from-run-id mechanism (old features return from cache).
5. New session with no active run → start fresh with only still-queued/in-flight features.
6. After the run settles, update `tasks/pipeline-queue.md`: move the row to Completed.

**Continuous autonomous execution through the queue (owner's explicit standing
instruction, 2026-09-20):** once a feature's gate passes and it's pushed, do
NOT stop and wait for the owner to say "continue" — immediately pick up the
next `queued`/`in_flight` row in `tasks/pipeline-queue.md` and build it, gate
it, and push it, the same way, without pausing in between. This applies
across the whole queue, not just one feature at a time. The only things that
legitimately stop this loop: the queue genuinely has nothing left in
`queued`/`in_flight`/`error` state, a feature halts per §7.6 invariant 2 (a
genuine architecture/security/bug-fix-loop halt, not a routine gate finding —
those get self-fixed by the gate agents same as always), or the owner gives a
new instruction that supersedes this one for that turn.

**Concurrency rule:** features run interleaved, but **the same specialist role never
runs concurrently for two different features** — enforce with a per-role mutex.

**Bug reports go through the exact same mechanism as features.**

**When in doubt → queue it into the pipeline.** The only true exception is a request
that produces no code change at all.

### 7.3 Always-On Pipeline — runs non-stop, survives session limits

A recurring scheduled trigger (Routine/cron) does the resurrecting across session limits:
1. Checks out the active dev branch.
2. Reads `tasks/pipeline-queue.md` for any `queued`/`in_flight`/`error` feature.
3. Starts (or restarts) a pipeline run and drives it to completion.
4. On a hard error, diagnoses and fixes the script, commits, retries. Does not give up after one failure.
5. On a genuine halt (architecture rejection, blocking critic finding, security escalation,
   exhausted bug-fix loop) — stops for that feature and records the halt reason.
6. Updates the queue file; no-ops quietly if empty.

**Rules for every session:**
- Never leave a `queued`/`in_flight` feature idle at end of turn if a run can be started.
- Never treat "context is getting long" as a reason to stop the pipeline and wait — that's
  what the scheduled trigger is for.
- If the scheduled trigger is missing/disabled/misconfigured, recreate it.
- This is a standing, permanent instruction.

### 7.4 The Pipeline Stages

| Stage | Role | Model tier | What It Does |
|---|---|---|---|
| 0.5 | Codebase Explorer | fast | Maps codebase patterns, module boundaries, naming idioms |
| 1 | Business Analyst | cheapest | Extracts requirements → traceability matrix + design brief |
| 2 | Enterprise/Solution Architect *(pre)* | deep | Enterprise architecture review — rejects bad ideas before any code |
| 2.5 | Tech Lead | deep | Challenges decisions, flags scaling risks, sets architecture direction |
| 3 | Solution Architect | fast | Produces a Solution Design Document (SDD) |
| 3.1 | Architecture Critic | deep | Adversarially reviews the SDD — blocking findings halt the pipeline |
| 3.3 | System Engineer | deep | Designs component structure, data flow, schema, caching strategy |
| 3.5 | Engineer (MVP) | fast | Builds production-ready MVP from SDD + system design |
| 4 | Developer | fast | Generates complete feature code |
| 4.15 | Database Specialist | fast | SQL/ORM/migration audit — N+1, missing indexes, unsafe queries |
| 4.16 | Language/Framework Specialist | fast | Async correctness, type-system usage, dependency injection |
| 4.2 | Code Reviewer | deep | Project-conventions review against this file's rule files |
| 4.3 | Frontend Engineer | fast | Production-grade UI — all states, accessible, responsive, reusable |
| 4.4 | Type-Design Analyzer | fast | Type system audit — weak types, missing invariant encoding |
| 4.5 | Senior Engineer | deep | Code quality audit — N+1, bad patterns, scalability risks |
| 4.6 | Software Architect | deep | Architecture restructuring — separates concerns, reduces coupling |
| 4.7 | Silent-Failure Hunter | fast | Error handling audit — swallowed exceptions, missing propagation |
| 4.8 | Code Simplifier | deep | Clarity refinement — removes unnecessary abstraction, over-engineering |
| 5 | Process Organiser | cheapest | Logs feature in process hierarchy |
| 5.9 | Test Architect | fast | Test architecture — unit vs integration boundaries, mock strategy |
| 6 | Test Script Writer | fast | Writes test scripts per Test Architect's plan |
| 6.1 | Test-Quality Analyzer | fast | Coverage of happy/error/edge paths, behaviour vs implementation |
| 7 | Tester | fast | Executes tests, reports defects |
| 8 | Bug-Fixer ↔ Tester | fast | Fix + re-test loop (max 5 iterations) |
| 8.5 | Debugger | deep | Root cause analysis — production outage mode, 3 levels deep |
| 8.6 | Performance Engineer | fast | N+1, missing indexes, async gaps, memory leaks |
| 8.7 | Security Auditor | deep | OWASP Top 10 — attack scenarios, secure fixes |
| 8.8 | DevOps Engineer | fast | Deployment architecture, monitoring, scaling, production checklist |
| 8.9 | Production Validator | fast | Final production-readiness check — no stubs, no TODOs, no debug code |
| 9 | Enterprise/Solution Architect *(post)* | fast | Final architectural verdict — **always runs** |

### 7.5 Model Tiers

Per §2's model ceiling: "Deep-reasoning" resolves to Sonnet, not Opus —
these roles still get the most capable model available under the ceiling,
just not one above it.

| Tier | Roles |
|---|---|
| **Deep-reasoning** | Tech Lead, Architecture Critic, System Engineer, Code Reviewer, Senior Engineer, Software Architect, Code Simplifier, Debugger, Security Auditor |
| **Fast/execution** | Codebase Explorer, Engineer, Developer, Database Specialist, Language Specialist, Frontend Engineer, Type-Design Analyzer, Silent-Failure Hunter, Performance Engineer, DevOps, Production Validator, Solution Architect, Enterprise Architect, Test Architect, Test Writer, Tester, Bug-Fixer, Test-Quality Analyzer |
| **Cheapest** | Business Analyst, Process Organiser |

### 7.6 Three Invariants (never break these)

1. **Code accumulates forward** — one `code` object from the "build MVP" stage onward; each subsequent stage improves it in-place, never regenerates it.
2. **Terminal hardening stages always run** — Debugger → Performance → Security → DevOps → Production Validator → final Architect sign-off, even if the bug-fix loop exhausted its max iterations.
3. **A forbidden-path/pattern denylist is checked after every code-generating step** — a hit is an immediate pipeline halt, no exceptions.

### 7.7 Pipeline execution files

| File | Purpose |
|---|---|
| `.claude/workflows/dev-team.js` | The canonical staged Workflow script. |
| `tasks/pipeline-queue.md` | Living queue — queued/in_flight/completed/halted/error, plus active run ID. Read FIRST every time. |
| `tasks/pipeline-runs.md` | Append-only run history, one row per completed feature. |
| `tasks/agent-outputs/<role>/<FEAT_ID>.json` | Per-stage outputs when a stage is run manually outside the Workflow. |

### 7.8 Agent files location

All specialist agent definitions live in `.claude/agents/dev-team/` — one `.md` file
per role listed in §7.4. `orchestrator.md` is kept for historical reference and is
marked **do not invoke as a subagent**.

---

## 8. Subagent Verification Rule (sandbox-specific reliability safety net)

### Why this rule exists

Some sandboxed environments' subagents (launched via a Task/Agent-style tool) exhibit
a very high hallucination rate specifically on file-existence claims.

### The rule

> **Before accepting a subagent claim that any file is missing, empty, deleted, or
> unchanged, the orchestrator MUST verify with a direct `Read` (or `Bash ls`/`wc -l`)
> in the main context.**

Applies to: code review subagents claiming "fix not applied", security auditors
claiming "files don't exist", doc writers claiming "no comments present", testers
claiming "test scripts not in repo", any subagent verdict pivoting on a *negative
existence claim*.

### How to apply

1. Run `ls -la <path>` and `wc -l <path>` to confirm whether the file actually exists.
2. If it does, `Read` the relevant section to confirm what's actually there.
3. Report manual finding alongside the subagent's hallucinated finding, marked `(manual cross-check)`.
4. In the master gate report, label the subagent verdict: `HALLUCINATED → manual: PASS`,
   `HALLUCINATED → manual: FAIL`, or `CONFIRMED`.

### What this rule does NOT cover

- Positive claims ("I found a bug at line 42") — normal scepticism, no automatic cross-check.
- Findings within files the subagent read successfully.
- Non-sandbox environments.

Full flowchart in `.claude/rules/subagent-verification.md`.

### Removal criteria

Delete this rule when two consecutive multi-agent runs show zero file-existence hallucinations.

---

## 9. Quality Gate — Auto-Trigger Rules — PERMANENT

> These rules are ALWAYS active. They override any default behaviour.

### 9.0 Target/Merge Branch

- Source: whatever branch is currently active
- Target: `main`
- Method: PR-gated merge (never direct push)

### 9.1 Trigger 0 — Auto merge-to-main on pipeline completion (no phrase needed)

Whenever a pipeline run reaches `completed` for a feature, immediately run the full
"Merge to Main" procedure (§9.3) on that branch, without waiting for the owner to say
the trigger phrase.

- Applies only to features reaching **completed**. A **halted** feature does NOT
  trigger this — it gets preserved per §15 instead.
- If the gate itself comes back BLOCKED on a completed feature, report the blockers
  and stop — do not force a merge.
- Multiple features completing in the same batch → run the gate once on the combined diff.

### 9.2 Trigger 1 — PR Creation / Review Request

Whenever the user says: "create PR", "open PR", "make a PR", "raise a PR", "PR to
main", "pull request to main", "pull request", "commit to main", "push to main",
`/gate`, `/pr-review` →

1. Resolve open PR (base = `main`, head = current active branch) or create one
2. Launch all gate agents in parallel (§9.4)
3. Compile the master gate report
4. Post the full report as a comment on the GitHub PR
5. Present PASS / WARN / FAIL verdict to user
6. If PASS or WARN → prompt: *"Say 'Merge to Main' to merge"*
7. If FAIL → list blockers and stop. Do NOT merge.

### 9.3 Trigger 2 — "Merge to Main"

Whenever the user says "Merge to Main" (case-insensitive):

> **Source branch is dynamic.** Capture it once: `CURRENT_BRANCH=$(git branch --show-current)`

**Step 0 — Squash-divergence repair (mandatory).**
```bash
git fetch origin
if ! git merge-base --is-ancestor origin/main HEAD; then
  git merge origin/main --strategy=ours \
    -m "merge: keep ${CURRENT_BRANCH} aligned with main (squash-divergence repair)"
fi
```
Symptom if skipped: the auto-PR workflow's merge call returns `HTTP 405 "Pull Request has merge conflicts"`.

**Step 1 — Run `/gate` (mandatory, no skipping).** Spawn all gate agents (§9.4) on
`git diff origin/main..HEAD`. Compile the master report. No focused-verification
mode, no "trivial diff" exception.

**Step 2 — If any Critical finding or FAIL gate → auto-fix loop.**
Smallest fix per Critical, one commit per finding, push to `${CURRENT_BRANCH}`,
re-run `/gate`. Repeat up to 3 iterations. If criticals remain, stop and present
to the user — do NOT merge. WARN findings go into the PR body as a checklist, not
auto-fixed.

**Step 3 — Write the gate report to `tasks/last-gate-report.md`**, committed in the
same push as the final fixes. This becomes the PR description.

**Step 4 — Push to the current branch.** `git push origin "${CURRENT_BRANCH}"`.
Report the PR URL and gate verdict.

**Step 5 — Auto-merge happens in the workflow, not in Claude.** The auto-PR workflow
squash-merges only when the push contains a fresh `tasks/last-gate-report.md` whose
verdict is not BLOCKED.

**This phrase ("Merge to Main") is the ONLY trigger for the gate-and-merge flow.
Never push directly to `main`.**

### 9.4 Gate Agents (all must pass)

| Agent | What it checks |
|---|---|
| `code-reviewer` | Bugs, logic errors, performance |
| `security-auditor` | OWASP Top 10, secrets, injection |
| `debugger` | Unhandled errors, runtime failures |
| `test-writer` | Coverage below 70% = FAIL |
| `refactorer` | Complexity, duplication |
| `doc-writer` | Undocumented public APIs |
| `silent-failure-hunter` | Swallowed exceptions, success-status masking errors |
| `pr-test-analyzer` | Test quality, negative coverage, behaviour vs implementation |

### 9.5 Gate Verdicts

| Verdict | Condition | Merge allowed? |
|---|---|---|
| ✅ PASS | All agents: no FAIL, no Critical | Yes — on "Merge to Main" |
| ⚠️ WARN | Some WARN, zero FAIL, zero Critical | Yes — on "Merge to Main" |
| ❌ BLOCKED | Any FAIL gate OR any Critical issue | No — fix first |

**Security exception:** any security finding (even WARN-level) automatically upgrades to FAIL.

### 9.6 Gate Report

Always posted to the GitHub PR as a comment. Includes: agent-by-agent results
table, detailed findings, prioritised action-item checklist.

---

## 10. API Rules (`.claude/rules/api.md`) — REST Design (forward-looking, no backend yet)

See `.claude/rules/api.md` for the full convention set: URL structure, request/response
schemas, HTTP status codes, error shape, validation, pagination, auth, streaming,
versioning. Apply these the moment a backend is introduced.

---

## 11. Database Rules (`.claude/rules/database.md`) — (forward-looking, no database yet)

See `.claude/rules/database.md` for models, queries, migrations, indexes, naming
conventions, and transactions. Apply the moment a database is introduced.

---

## 12. Frontend Rules (`.claude/rules/frontend.md`)

See `.claude/rules/frontend.md` for components, state management, hooks, styling,
performance, and testing conventions. Applies now — this is a React + Vite project.

---

## 13. GitHub Repo Registry + Weekly Auto-Update — Full Mechanism

### 13.1 The registry file

`.claude/github-repos.json` is the single source of truth for every external repo
ever ingested. Columns: `Slug | Repo URL | Type | Components | Last Fetched`.

**Current state:** all 40 registered sources have been ingested (`last_fetched`
set on every entry). This was done at the owner's explicit request, without a
security review pass of the ingested content — see §23 for that accepted
tradeoff and its effect on the pre-commit secret scanner's scope. A handful
of sources extracted nothing (curated reference/awesome-lists with no
SKILL.md/agents/commands, or repos using a structural convention our generic
detection patterns don't match — e.g. agents under `categories/` instead of
`agents/`); that's a legitimate outcome, not a fetch failure. `.claude/agents/INDEX.md`
and `.claude/skills/INDEX.md` have been regenerated to route across all 40
ingested sources: each keeps its first-party routing table as the default,
adds an explicit "promoted niches" table for the specific gaps vendored
content fills, and inventories every vendored source by count and content
rather than enumerating all ~500 agents/~1,600 skills individually.

### 13.2 The `/fetch-github-repo` command

**Trigger:**
- Manual: `/fetch-github-repo <github-url>`
- **Auto:** Any `github.com/...` URL in a user message
- **Weekly:** Every 7 days via the session-start hook

**What It Extracts:**

| Component | Detection pattern | Integrated to |
|---|---|---|
| Skills | `SKILL.md` files, `skills/` dirs | `.claude/skills/<slug>/` |
| Agents | `agents/*.md`, `.claude/agents/*.md` | `.claude/agents/<slug>_*.md` |
| Commands | `commands/*.md`, `.claude/commands/*.md` | `.claude/commands/<slug>_*.md` |
| Hooks | `hooks/*.sh`, `.claude/hooks/*.sh` | `.claude/hooks/<slug>_*.sh` |
| Token optimisation | keyword scan in `.md`, `.py`, `.ts` | logged in registry |

**Files:** `scripts/fetch-github-repo.sh`, `.claude/github-repos.json`,
`.claude/hooks/session-start.sh`, `.claude/commands/fetch-github-repo.md`.

**Commit format:** `Integrated external repo: <REPO_NAME> on <DATE>`

### 13.3 How weekly re-sync works

1. `.claude/hooks/session-start.sh` runs at session start (async, background)
2. Reads `.claude/skills/.last-updated` — if <7 days old, exits silently
3. If 7+ days old, spawns `scripts/update-skills.sh` in the background
4. `update-skills.sh` clones each registered repo, diffs, copies only what changed
5. If anything changed, auto-commits/pushes: `chore: weekly skill update [YYYY-MM-DD]`
6. Progress logged to `.claude/skills/.update-log`

### 13.4 Adding a New Source

Edit exactly two lines in `scripts/update-skills.sh`:
```bash
SKILL_SOURCES["my-slug"]="https://github.com/author/repo.git"
SKILL_PATHS["my-slug"]="path/to/skills"
```

### 13.5 Directory Layout

```
.claude/
├── skills/
│   ├── .last-updated
│   ├── .update-log
│   └── <source-slug>/
└── agents/
    ├── (project agents)
    └── <source-slug>/
```

### 13.6 Skill / Agent Routing at Scale

Maintain routing indexes as sources accumulate:
- `.claude/agents/INDEX.md` — task-type → agent
- `.claude/skills/INDEX.md` — task-type → skill, plus inventory by source

**Default routing principle:** prefer first-party/project-native agents first;
reach for a vendored/external agent only for the specific niches it uniquely
covers, and document those niches explicitly.

---

## 14. Agent & Skill Auto-Registration — AI Ecosystem Sync — PERMANENT

> Always active. Every agent or skill installation triggers it — no exceptions.

**Trigger (agents):** Immediately after any agent `.md` file is added to
`.claude/agents/` (or subdirectory), via `/fetch-github-repo`, manual creation,
or the weekly sync.

**Trigger (skills):** Immediately after any skill directory is added to
`.claude/skills/`, run the skill-registration script.

### What to extract from the `.md` file

| Field | Source |
|---|---|
| `agent_name` | Filename without `.md` |
| `display_name` | First `# Heading`; fallback: title-case of `agent_name` |
| `purpose` | First non-empty, non-heading paragraph, truncated to 250 chars |
| `model` | Scan content for tier keywords → deep/cheapest/fast model ID |
| `category` | `development_team` if under `dev-team/`; else `other` |
| `pipeline_stage` | `null` for all non-pipeline agents |

### Registration (once a backend exists to register against)

```bash
python scripts/register_agent.py --file .claude/agents/<slug>/<filename>.md --category other
python scripts/register_skills.py --skills-dir .claude/skills --registry .claude/github-repos.json
```

**Category inference (skill slug keywords):**

| Keywords in slug | Category |
|---|---|
| `security`, `audit`, `vuln` | `security` |
| `test`, `tdd`, `agent`, `skill`, `command`, `hook`, `mcp`, `dev`, `code`, `review` | `development` |
| `data`, `pipeline`, `ingest`, `etl`, `db`, `sql` | `data` |
| (everything else) | `other` |

### Idempotency

All scripts **upsert** — safe to re-run at any time.

---

## 15. Alternate Feature Preservation — PERMANENT

> Always active. **Nothing built in a session is ever left only in the local working tree.**

At the end of any meaningful unit of work — session ending, a pipeline run
settling, or any hands-on work outside the pipeline:

1. **Completed pipeline features** → merged to main via §9.1.
2. **Everything else** (halted feature, half-built ad-hoc change, abandoned
   experiment) → committed and pushed to its own branch, logged in
   `tasks/alternate-features.md`.

### Branch tagging convention

- Halted pipeline features: `dev-team/feat-<N>-<slug>`
- Other alternate/experimental work: `alt/<short-slug>`
- Every branch gets an entry in `tasks/alternate-features.md`.

### `tasks/alternate-features.md` — the registry

| Field | Meaning |
|---|---|
| `ID` | `ALT-<N>` (own counter), or `FEAT-<N>` if it's a halted pipeline feature |
| Description | What it is / what it was trying to do |
| Branch | Where the code actually lives |
| Progress point | How far it got, what's missing |
| Status | `halted` / `experimental` / `abandoned` |
| Notes | Blockers, decisions needed, related FEAT_ID |

### Retrieval trigger

When the owner says "bring me all the alternate features" (or a near-match):
1. Read `tasks/alternate-features.md` in full.
2. Summarize every entry: ID, description, branch, progress.
3. Wait for the owner to pick which to resume — don't auto-resume.
4. Once picked, check out that branch and continue from its recorded progress point.

### When this rule fires

At every session-end, whenever a pipeline run halts, whenever a session limit
approaches, whenever hands-on work is abandoned/superseded/left incomplete.

---

## 16. Autonomous Backlog System — PERMANENT

> Keep incomplete work alive across session limits. Always active.

1. **Backlog file:** `tasks/backlog.md`
2. **Executor script:** `scripts/backlog_run.py`
3. **Scheduled workflow:** `.github/workflows/autonomous-backlog.yml` — fires every
   2 hours, picks the next autonomous task, commits to the active dev branch, opens/
   updates a rolling PR to `main`.
4. **Session-end hook:** queues every incomplete item before closing out.

### Adding tasks to the backlog

```bash
# Autonomous (bot can execute without asking):
python scripts/backlog_add.py \
  --title "Add error state to X page" \
  --description "When the fetch hook returns an error, show a red banner instead of silently keeping stale data." \
  --context "path/to/relevant/file.tsx" \
  --autonomous yes

# Requires human input (bot skips, owner decides):
python scripts/backlog_add.py \
  --title "Choose rate-limiting strategy" \
  --description "Decide between token-bucket and sliding-window for a given endpoint." \
  --autonomous no
```

### Autonomy filter — the hard rule

**NEVER auto-execute a task that requires a human decision.** `requires_human: yes`
means architectural decisions, user-facing behaviour changes needing approval,
security-sensitive changes, or anything the owner must sign off on. When in doubt:
`--autonomous no`.

### Task lifecycle

```
pending → (bot picks up) → in_progress → done
                        ↘ blocked (BLOCKED: reason in summary)
```

### When this rule fires

At every session-end, whenever a session limit approaches, after any pipeline run
that left TODOs or deferred items.

---

## 17. Task Management Protocol

1. **Plan First** — Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan** — Check in with user before starting work on large tasks
3. **Track Progress** — Mark items complete as you go, not in a batch at the end
4. **Explain Changes** — One-sentence high-level summary at each meaningful step
5. **Document Results** — Add a review section to `tasks/todo.md` when done
6. **Capture Lessons** — Update `tasks/lessons.md` after every correction

---

## 18. Skill / Agent Routing — Read Before Picking a Tool

**Agents — prefer first-party.** Reach for vendored/external agents only for
niches first-party agents genuinely don't cover well (name the niches explicitly
as they're discovered: e.g. CI/CD & Dockerfiles/Kubernetes → deployment-focused
vendored agent; MCP protocol work → MCP-focused vendored agent).

**Skills — most nested two levels deep, not auto-surfaced.** Maintain
`.claude/skills/INDEX.md` mapping task-type → skill. For a skill not auto-listed,
`Read` its `SKILL.md` directly and apply its workflow.

When a skill or agent is genuinely useful but invisible, **promote it** by copying
it one directory up.

---

## 19. Git Conventions

- **Source branches:** any non-integration branch (feature/fix branches). Auto-PR
  workflow triggers on push to any branch except `main`.
- **Merge target:** `main`
- **Remote:** `origin` → `https://github.com/ArshadGaniM/KaarTech-MENA-Digital-Factory`
- **Push command:** `git push -u origin "$(git branch --show-current)"`
- Commit message format: `type: short description` (feat / fix / docs / refactor / test)
- Commit messages end with the session-attribution line required by the current
  harness's convention (see the harness's own system instructions for the exact
  footer to use — do not hardcode one here, as it changes per session).

---

## 20. Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Once a backend exists | Connection string for the primary datastore |
| `REDIS_URL` | If used | Cache/session store connection string |
| `SECRET_KEY` | Once a backend exists | App secret — must not be a placeholder value in production |
| OAuth client ID/secret pairs | Per integration | One per external service integrated |
| Encryption keys | Per integration | Document rotation impact explicitly |
| `BACKEND_URL` / `FRONTEND_URL` | Per integration | Public URLs used to build redirect URIs |
| `VITE_INTERNAL_API_KEY` | Required for the frontend's "Add `<Entity>`" forms (FEAT-14) | Must exactly match the backend's `INTERNAL_API_KEY`. **Not a real secret once set** — Vite inlines `VITE_` vars into the built JS bundle, so anyone visiting the site can read it. Accepted only because this app has no user-login system yet (see §0) — revisit the moment real auth exists, at which point writes should go through an authenticated session instead of a shared static key. |

Never hard-code secrets. Add new vars to `.env.example` alongside the actual `.env`.

---

## 21. Deployment Verification Protocol

> Always use a documented method to check whether a deployment is healthy after
> any push to `main`. No deployment platform is wired up yet — fill in once one is
> chosen (e.g. Vercel, Render).

### Standard Check (run after every merge to `main`, once deployment exists)
```
1. Look up the deployment platform's workspace/project ID
2. Pull recent error/critical/warning logs for the deployed service (last 30 lines)
3. Read and diagnose every error/warning line
4. If any ERROR or CRITICAL found → fix the root cause, commit, push
5. Confirm health via a startup-complete line and a successful health-check request
```

### Known recurring issues table

| Error | Root cause | Fix |
|---|---|---|
| *(fill in as issues are discovered)* | | |

---

## 22. Session-End Protocol (what `/session-end` should do)

1. Update `tasks/lessons.md` with anything learned this session.
2. Queue every incomplete task into `tasks/backlog.md` (§16) with full context.
3. Preserve every piece of unmerged/halted work per §15.
4. Write/refresh `tasks/handoff.md`: where things stand, what's next, watch-outs,
   open questions.
5. Confirm nothing is left only in the local working tree — `git status` clean or
   everything staged/committed/pushed.

---

## 23. Open Items For This Project

These are the placeholders this template intentionally leaves for a new project,
still unresolved here — fill in as decided:

- [ ] Concrete feature scope for the factory-management product (§0): which
      modules come first (resource management? team/org directory? process/
      workflow tracking?), user roles, data model. Business domain itself is
      now known — this is about turning it into a buildable first feature.
- [ ] Backend framework, database, and hosting choice
- [ ] API endpoint list, data models, integration specifics
- [ ] Deployment platform and its MCP tooling
- [ ] Production URLs, service IDs, workspace IDs
- [ ] Whether the 30-step dev-team pipeline (§7) should run in full for this
      project's scale, or a lighter subset — currently scaffolded but not yet
      exercised end-to-end
- [ ] All 40 registered external sources have been ingested (~152MB across
      `.claude/skills/`, `.claude/agents/`, `.claude/commands/`, `.claude/hooks/`),
      at the owner's explicit request, without any content security review —
      none of it has been checked for malicious or low-quality instructions.
      The pre-commit secret scanner was narrowed to first-party files only as
      a direct consequence (vendored security-scanning skills' own test
      fixtures/pattern definitions made both the heuristic and "unambiguous"
      credential patterns unusable against vendored content — see
      `.claude/hooks/pre-commit.sh`). A real leaked credential or a malicious
      instruction buried in the 40 sources would not be caught by anything in
      this repo today.
- [x] `.claude/agents/INDEX.md` and `.claude/skills/INDEX.md` regenerated to
      route across the 40 ingested sources (first-party table + promoted
      niches + full per-source inventory).
