# Pipeline Queue

> Living queue of features — queued/in_flight/completed/halted/error, plus the
> current session's active run ID. Read this FIRST every time before deciding
> whether to resume or start fresh (CLAUDE.md §7.7).

**Active run ID:** wf_944e6031-685 (FEAT-1, dev-team-feat1-ui-redesign workflow, round 2 — solution-architect revising SDD per architecture-critic's round-1 finding)

**Feature counter:** 1

## Queue

| ID | Status | Requirement | Branch |
|---|---|---|---|
| FEAT-1 | in_flight | Redesign the frontend UI so it reads as a multi-user internal application (dashboard/app shell — nav, workspace chrome, data-dense views) rather than a public-facing "portal" landing-page style. Halted at architecture-critic (stage 3.1): the SDD's App.jsx branch still wraps the new AppShell in the old marketing Header/Footer, undermining the feature's own goal. Fix: solution-architect must amend app_jsx_change so the app-shell hash renders AppShell alone (no Header/Footer); marketing hash keeps Header/main/Footer as-is. Resume via Workflow(scriptPath, resumeFromRunId: "wf_944e6031-685") once the SDD is amended — architecture-critic will re-run first, then Build/Test/Harden proceed forward. | claude/trusting-curie-hlx1r6 |

## Completed

| ID | Status | Requirement | Branch | Architectural decision |
|---|---|---|---|---|
