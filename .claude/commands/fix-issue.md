---
description: /fix-issue <number> — end-to-end issue-to-PR flow
argument-hint: <issue-number>
---

Given issue number `$1`:

1. Fetch the issue title/body.
2. Treat it as a feature/bug per `CLAUDE.md` §7.2 — assign a `FEAT-{N}` ID and
   queue it into `tasks/pipeline-queue.md` rather than writing code directly,
   unless it's a single-line fix/config change/rename/single test.
3. Run (or resume) the staged pipeline (`.claude/workflows/dev-team.js`) for that feature.
4. On completion, follow §9.1 (auto merge-to-main via the gate).
