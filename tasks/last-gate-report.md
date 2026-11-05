# Gate Report: team pop-up revamp with small icon buttons, cost labels and a Module Lead note

**Verdict: WARN** (zero FAIL, zero Critical after round 2. Security PASS.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was up to date.
**Scope:** `git diff origin/main..HEAD`. Frontend only. No backend change and no migration.
- The ", not counted in the team" text is gone from the Module Lead row. A note at the bottom reads "Module Lead position is not counted in the total available, allocated and planned utilization hours." A second note covers other uncounted positions such as Enterprise Architect.
- "Allocated Team Cost" is now "Allocated Team Monthly Cost", on the pop-up and on the Control Center team card.
- A new "Utilized Team Total Cost" is the sum of every month in the Month-wise Utilization Cost list, the same number as its Total line. It reads "at least $X" when the plan is cut at 120 months and a dash when an older backend sends no plan.
- Assign (+), Unassign (x), Delete Position (trash) and Add Position (+) are small icon buttons. Each shows its name on hover and on keyboard focus. Every button keeps its full name for screen readers. What they do has not changed.

**Checks on the final code:** frontend 869/869, `vite build` clean, oxlint has no errors.

## Agents (round 2, after the round 1 fix)

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | PASS | Round 1 fixes confirmed. One style note for an aria-disabled button (fixed) |
| security-auditor | PASS | No findings. Static icons, escaped text, no new dependency |
| debugger | PASS | Tooltip states walked. Two cosmetic notes |
| test-writer | PASS | Every new behaviour has a test. 867 tests at that point |
| refactorer | PASS | No duplication. The tooltip code is small and clear |
| doc-writer | PASS | No stale text |
| silent-failure-hunter | WARN | Other uncounted positions lost their note and the chart total showed $0.00 without a plan (both fixed). Tooltip may clip on a narrow screen |
| pr-test-analyzer | WARN | Mutations caught. The throwing `:focus-visible` fallback had no test (added) |

Round 1 gave one FAIL from the silent-failure agent: the reason "Reload after the server update" on a disabled Unassign could not reach keyboard or touch users, because a disabled button cannot take focus or taps. It is fixed. The button now stays focusable, the reason is in its name and tooltip, and a click shows the reason and does nothing else. All agents ran on Sonnet. A test-quality agent changed two files temporarily for mutation checks and restored them. I checked the committed files are what was gated.

## Fixed during the gate

- The disabled Unassign reason reaches keyboard, touch and screen reader users.
- The tooltip moved to the right of the button. It no longer shows when focus returns from a closed modal. It hides after a click until the mouse leaves.
- A truncated plan shows "at least". A missing plan shows a dash on the stat and on the chart total.
- A second note explains positions other than Consultant and Lead Consultant.
- An aria-disabled button looks dimmed and has no hover highlight.
- New `IconButton.test.jsx`, plus tests for each fix.

## Open, not blocking

- [ ] The tooltip sits inside the scrolling seat table. On a very narrow screen the long Unassign reason could still be cut off.
- [ ] On a touch device that does not focus buttons on tap, the reason tooltip hides only on the next tap elsewhere.
- [ ] `TeamDialog.jsx` is about 470 lines.
- [ ] The new look has not been checked in a browser.
