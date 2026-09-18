# Pipeline Queue

> Living queue of features — queued/in_flight/completed/halted/error, plus the
> current session's active run ID. Read this FIRST every time before deciding
> whether to resume or start fresh (CLAUDE.md §7.7).

**Active run ID:** wf_944e6031-685 (FEAT-1, dev-team-feat1-ui-redesign workflow)

**Feature counter:** 1

## Queue

| ID | Status | Requirement | Branch |
|---|---|---|---|
| FEAT-1 | in_flight | Redesign the frontend UI so it reads as a multi-user internal application (dashboard/app shell — nav, workspace chrome, data-dense views) rather than a public-facing "portal" landing-page style. | claude/trusting-curie-hlx1r6 |

## Completed

| ID | Status | Requirement | Branch | Architectural decision |
|---|---|---|---|---|
| FEAT-1 | completed | Redesign the frontend UI so it reads as a multi-user internal application (dashboard/app shell — nav, workspace chrome, data-dense views) rather than a public-facing "portal" landing-page style. | claude/trusting-curie-hlx1r6 | Round-1 architecture-critic halt (AC-1: AppShell wrapped in old marketing Header/Footer) resolved by solution-architect's round-2 SDD amendment: App.jsx now uses a single outermost `APP_SHELL_HASHES.includes(hash)` ternary so AppShell and the marketing Header/main/Footer tree never co-mount. New: AppShell/Sidebar/TopBar/UserBadge components, src/lib/navigation.js, src/lib/currentUser.js (mock, explicitly labeled — no real auth backend exists), src/hooks/useCurrentUser.js. MasterDataTable re-parented as a child view inside AppShell. Final enterprise-architect-post sign-off: PASS — clean `oxlint`, clean `npm run build` (58 modules), 25/25 tests passing, no stubs/TODOs/secrets, no unresolved findings. Ready for CLAUDE.md §9.1 auto-merge-to-main. |
