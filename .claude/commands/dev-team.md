---
description: Manual trigger for the staged development pipeline (auto-trigger is primary — see CLAUDE.md §7)
argument-hint: <feature description>
---

Manual entry point into the pipeline described in `CLAUDE.md` §7. Normally the
pipeline is auto-triggered from any feature/bug prompt — use this command only
when you need to explicitly (re)start or resume a run.

1. Read `tasks/pipeline-queue.md` to check for an active run ID.
2. If a run is active and not yet settled, do not start a new one — append this
   feature to the queue instead and let it fold in at the next natural settle point.
3. If no run is active, invoke `.claude/workflows/dev-team.js` (fresh, or via
   resume-from-run-id if continuing this session) with the queued/in-flight
   feature list, including `$ARGUMENTS` as a new `FEAT-{N}` entry.
4. Follow the concurrency rule: same specialist role never runs concurrently
   across features (per-role mutex).
