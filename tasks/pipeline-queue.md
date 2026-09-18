# Pipeline Queue

> Living queue of features — queued/in_flight/completed/halted/error, plus the
> current session's active run ID. Read this FIRST every time before deciding
> whether to resume or start fresh (CLAUDE.md §7.7).

**Active run ID:** none

**Feature counter:** 1

## Queue

| ID | Status | Requirement | Branch |
|---|---|---|---|
| FEAT-1 | queued | Redesign the frontend UI so it reads as a multi-user internal application (dashboard/app shell — nav, workspace chrome, data-dense views) rather than a public-facing "portal" landing-page style. | claude/trusting-curie-hlx1r6 |

## Completed

| ID | Status | Requirement | Branch | Architectural decision |
|---|---|---|---|---|
