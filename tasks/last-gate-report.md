# Gate Report: full-screen Initiative Plan, three joined Initiative Owners, track co-owner roles, services from the top floor down

**Verdict: WARN** (zero FAIL, zero Critical. Security PASS.)

**Branch:** `claude/trusting-curie-hlx1r6` to `main`. Main had no new commits, so the branch was already up to date. The branch was restarted from main after PR #63, and its old history was joined with a normal merge.
**Scope:** `git diff origin/main..HEAD`.
- The Initiative Plan has a "View full screen" button. The popup shows the same plan and filters, shrinks to fit on screens 1200 pixels or wider and scrolls on narrower ones. Plan data is untouched.
- The three owners (Arshad, Mohammed Ibrahim, Srinivasan) all read Initiative Owner in the diagram, the Stakeholder Matrix and the Overview. In the diagram their lines join into one line that opens to the three track owners. The org chart no longer clips.
- The 12 open track co-owner rows read "Initiative Track Co-owner (Track in Vertical Vertical)" with empty name and designation.
- Portal services run from floor 13 down to floor 1, and the heading spells counts up to twenty.
- No migration, no backend change.

**Checks on the final code:** backend 416/416, mcp-server 57/57, frontend tests all passing, `vite build` clean, oxlint clean. The screens were checked in a real browser (full-screen plan at full HD, laptop and narrow widths, the org chart, services order).

## Agents

| Agent | Verdict | Notes |
|---|---|---|
| code-reviewer | WARN | Focus jumped to Close on every re-render in the popup (fixed) |
| security-auditor | PASS | No findings |
| debugger | WARN | Same focus bug (fixed) |
| test-writer | PASS | About 90 percent behaviour coverage |
| refactorer | WARN | `FitToScreen` shared a file with the dialog (split), overloaded `fit` flag, repeated connector CSS |
| doc-writer | WARN | Low: stale lines in the old gate report (rewritten here), missing comments |
| silent-failure-hunter | PASS | Two low notes, no action |
| pr-test-analyzer | WARN | Tab trap test too loose (rewritten), org chart test name overclaimed (renamed) |

All eight agents ran on Sonnet. No agent made a negative file-existence claim that needed a manual cross-check (CLAUDE.md §8).

## Fixed in this push

- The popup kept its keyboard handler in an effect that restarted on every re-render of the plan, so clicking a filter inside the popup moved focus to Close. The latest close function now lives in a ref and the effect runs once. A test clicks a filter inside the popup and checks focus stays put and returns to the opener on close.
- `FitToScreen` moved to its own file with its own styles and tests (one component per file).
- Tests added or tightened: Tab and Shift+Tab wrap to exact controls, focus recovery from outside the dialog, centring with a non-zero offset, resize re-measure and listener removal, latest close function used after a re-render.
- The org chart test is renamed to say what it proves. The joined lines are drawn with CSS, so a screenshot check covered them.

## Open, not blocking

- [ ] The plan is drawn twice in the page while the popup is open. Fine at this size.
- [ ] The plan behind the popup stays tabbable. The Tab trap and `aria-modal` cover keyboard users. `inert` would be tidier.
- [ ] At full HD the plan shows at about 68 percent size, on a 1440 pixel laptop about 49 percent. The owner accepted shrinking.
- [ ] The `fit` flag in `InitiativePlan` means four things. A rename to `inDialog` is optional.
- [ ] Connector CSS in `OrgChart.module.css` is written once for the owners row and once for the tracks row.
- [ ] A track with no owner in the stakeholder data would crash the org chart. It cannot happen with today's data.
- [ ] The 12 open seats show two blank cells in the Stakeholder Matrix, as asked.
- [ ] The password check is client-side, not real security (accepted limitation, CLAUDE.md §20).
