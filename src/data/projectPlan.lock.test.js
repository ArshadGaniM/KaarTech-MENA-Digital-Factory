import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PLAN_GROUPS, PLAN_MONTHS, PLAN_OWNER, PLAN_WEEK_COUNT, STATUS } from './projectPlan';

// THE PROJECT PLAN IS LOCKED. If this test fails, the plan's wording, status,
// weeks or percentages changed. Do not "fix" the test: the owner must have
// explicitly, repeatedly confirmed the change, and then both projectPlan.js
// and the hash below are updated in the same change, with the owner's
// confirmation noted in tasks/lessons.md (.claude/rules/project-plan.md).
const LOCKED_SHA256 = '22c459482e6c7ed1237ab50266b6bcacd3093f55ad5f8ee9a672a989d99a92b8';

describe('project plan lock', () => {
  it('matches the locked copy exactly (every word, status, week and percentage)', () => {
    const snapshot = JSON.stringify({
      months: PLAN_MONTHS,
      weeks: PLAN_WEEK_COUNT,
      owner: PLAN_OWNER,
      groups: PLAN_GROUPS,
      status: STATUS,
    });

    expect(createHash('sha256').update(snapshot).digest('hex')).toBe(LOCKED_SHA256);
  });

  it('cannot be edited at runtime', () => {
    expect(Object.isFrozen(PLAN_GROUPS)).toBe(true);
    expect(Object.isFrozen(PLAN_GROUPS[0].items[0])).toBe(true);
    expect(() => {
      'use strict';
      PLAN_GROUPS[0].items[0].activity = 'changed';
    }).toThrow();
  });

  it('keeps the sheet\'s own spelling and structure', () => {
    expect(PLAN_GROUPS.map((group) => group.slNo)).toEqual(['1.0', '2.0', '3.0']);
    expect(PLAN_GROUPS.map((group) => group.items.length)).toEqual([9, 9, 9]);
    expect(PLAN_GROUPS[0].items[5].activity).toBe('Implement a KPI-driven governance framework for Measruing Utilization');
    expect(PLAN_GROUPS[2].activity).toBe('Onshore Enabled Factory Delivery - Managed Services Project');
  });
});
