# Gate report: FEAT-42, Organization Structure tree view

Verdict: PASS with WARN items

Branch `claude/dreamy-knuth-76pnsa`, diff `origin/main..HEAD`. Main was already an ancestor, so no merge was needed. Frontend only: no route, migration or environment variable.

## What changed

- A Cards and Tree switch at the top of the Organization Structure page. Cards is unchanged in behaviour.
- The page content sits in a centred column (1120px) with margins.
- The tree shows the Delivery Manager, the five Project Managers, then for the picked manager its departments, practices, Module Leads and teams. It reads the same grouping the page already builds, so "No practice" and an unfilled Module Lead (TBD) come out as before. Each department has an Open link to the existing drawer.

## Agents

| Agent | Result | Notes |
|---|---|---|
| code-reviewer | WARN, 0 Critical | Fixed: `aria-controls` only while open, counts kept on phones, long names wrap, re-picking the same manager keeps the open rows, `Toggle` split into its own file |
| security-auditor | PASS | No findings. Names are React text, the only style value is a practice token from a fixed list, no new network call |
| debugger | PASS | No crash path. Empty lists cannot reach the tree because the builder drops them |
| test-writer | PASS | About 77 percent of branches before the extra tests, estimated. The remaining gaps are unreachable branches |
| refactorer | WARN, 0 Critical | Fixed: shared `initialsOf`, dead class reference, duplicated CSS selectors |
| doc-writer | PASS | No doc describes the page layout. Queue row and counter are right |
| silent-failure-hunter | WARN | Fixed: a deployed Module Lead's avatar read "TBD", which made a filled seat look vacant |
| pr-test-analyzer | WARN | Added tests: team filled styling, practice colour, keyboard use, avatar initials, practice toggle, aria-controls, refresh keeps open state, picked manager disappears |

Two agents found the same real bug (the TBD avatar on a filled lead). It is fixed and a mutation check confirms the new test fails without the fix.

Subagent verification rule (CLAUDE.md section 8): one agent reported uncommitted edits in the working tree. That was true while fixes were in progress (CONFIRMED) and is resolved by the commit before this report.

## Checks run

- Frontend: 70 files, 678 tests pass
- Backend: 467 tests pass
- Build: clean
- Lint: no warnings in the changed files
- Mutation checks: pick reset, default open, view switch, department collapse and the avatar fix each fail a test when reverted
- Browser check: the real component rendered in Chromium with live data in both views, no console errors

## Remaining WARN items (not blocking)

- [ ] Tab switching: the tree's open rows reset when you switch to Cards and back
- [ ] An open department drawer stays open if its department disappears and then reappears on a later refresh (already in main, affects Cards too)
- [ ] If the picked manager disappears on refresh, the page falls back to the first manager without saying so (already in main)
- [ ] `LeaderBand` is not re-indented inside its new `view === 'cards'` wrapper (formatting only)
- [ ] Frontend coverage is estimated, not measured. No coverage provider is installed
- [ ] `tasks/pipeline-queue.md` still carries an old "queue is empty" sentence in its header

## Notes for the owner

- The mockup you approved is what was built. Names stay TBD until you give them.
- Round 2 of the analytics work (Structure and Projects tabs) is set aside on this branch by a revert and resumes after this merge.
