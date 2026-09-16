---
description: End-of-session close-out protocol
---

Follow `CLAUDE.md` §22:

1. Update `tasks/lessons.md` with anything learned this session (pattern + self-rule).
2. Queue every incomplete task into `tasks/backlog.md` (§16) with enough context
   for a cold-start session to pick it up. Mark `--autonomous no` for anything
   requiring a human decision.
3. Preserve every piece of unmerged/halted work per §15 — branch it, log it in
   `tasks/alternate-features.md`.
4. Write/refresh `tasks/handoff.md`: current state, what's next, watch-outs, open questions.
5. Confirm nothing is left only in the local working tree: `git status` must be
   clean, or everything staged/committed/pushed.
