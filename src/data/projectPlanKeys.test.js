import { expect, it } from 'vitest';
import { PROJECT_PLAN_KEYS, PROJECT_PLAN_WEEKS } from '../../backend/src/projectPlanKeys.js';
import { PLAN_GROUPS, PLAN_WEEK_COUNT } from './projectPlan';

// The backend validates actuals against its own copy of the plan's Sl. No list.
it('lists exactly the keys the plan has, so the backend and the plan cannot drift', () => {
  const planKeys = PLAN_GROUPS.flatMap((group) => [group.slNo, ...group.items.map((item) => `${group.slNo.charAt(0)}${item.slNo}`)]);

  expect(PROJECT_PLAN_KEYS).toEqual(planKeys);
  expect(PROJECT_PLAN_WEEKS).toBe(PLAN_WEEK_COUNT);
});
