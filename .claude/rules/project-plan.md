# Project Plan Rules — the plan is locked

The Project Plan section (`src/data/projectPlan.js`, shown by
`src/components/ProjectPlan/`) holds the owner's own plan, transcribed exactly
from their sheet: the activities and their wording (including the sheet's
spellings, such as "Measruing"), the statuses, the week bars, the percentages
and the month headings.

- **Never** change, add, remove, reword, re-date or re-order anything in the
  plan on your own initiative — not to fix a typo, not to "improve" a phrase,
  not to match actual progress.
- A change is made only after the owner has **explicitly and repeatedly**
  confirmed it (a first request is not enough: restate exactly what will change
  and ask again). Dates and weeks are covered by this too.
- When a confirmed change is made, update `projectPlan.js` and the locked hash
  in `src/data/projectPlan.lock.test.js` in the same change, and record the
  owner's confirmation in `tasks/lessons.md`.
- Actual progress is tracked **beside** the plan (plan versus actual), never by
  editing the plan.
- Suggestions for showing the plan better go in the conversation, never into
  the plan data.
- The start date of Week 1 (1 July 2026, given by the owner on 31 October 2026)
  is part of the locked plan. Calendar dates shown in the view are derived from
  it and are never stored.
- Actual progress (start and end week, percent complete) is stored apart from
  the plan, in `project_plan_actuals`, and is the only part the app edits.
