import { describe, expect, it } from 'vitest';
import { STATUS } from '../data/initiativePlan';
import { effectivePoc, isBehindPlan, shortDate, weekEnd, weekOf, weekRangeLabel, weekStart } from './initiativePlanCalendar';

describe('initiative plan calendar (Week 1 starts 1 July 2026)', () => {
  it('starts Week 1 on 1 July 2026 and each week 7 days after the last', () => {
    expect(shortDate(weekStart(1))).toBe('1 Jul');
    expect(shortDate(weekStart(2))).toBe('8 Jul');
    expect(weekRangeLabel(1)).toBe('1 Jul 2026 to 7 Jul 2026');
    expect(weekRangeLabel(18)).toBe('28 Oct 2026 to 3 Nov 2026');
    expect(shortDate(weekEnd(65))).toBe('28 Sept');
  });

  it('works out which plan week a date is in', () => {
    expect(weekOf(new Date(2026, 6, 1))).toBe(1);
    expect(weekOf(new Date(2026, 6, 7))).toBe(1);
    expect(weekOf(new Date(2026, 6, 8))).toBe(2);
    expect(weekOf(new Date(2026, 9, 31))).toBe(18);
    expect(weekOf(new Date(2026, 5, 30))).toBe(0);
    expect(weekOf(new Date(2027, 8, 30))).toBe(66);
  });
});

describe('behind plan', () => {
  const row = (overrides) => ({ status: STATUS.IN_PROGRESS, startWeek: 14, endWeek: 17, poc: 0, ...overrides });

  it('is behind once the planned end week has passed and the work is not 100% done', () => {
    expect(isBehindPlan(row(), undefined, 18)).toBe(true);
    expect(isBehindPlan(row(), undefined, 17)).toBe(false);
    expect(isBehindPlan(row({ poc: 100, status: STATUS.COMPLETED }), undefined, 30)).toBe(false);
  });

  it('judges by the recorded actual percentage when there is one', () => {
    expect(isBehindPlan(row(), { actualPoc: 100 }, 30)).toBe(false);
    expect(isBehindPlan(row({ poc: 100 }), { actualPoc: 40 }, 30)).toBe(true);
    expect(effectivePoc(row({ poc: 18 }), { actualPoc: 60 })).toBe(60);
    expect(effectivePoc(row({ poc: 18 }), undefined)).toBe(18);
  });

  it('is behind when the planned start week has passed and nothing has started', () => {
    const notStarted = row({ status: STATUS.YET_TO_START, startWeek: 16, endWeek: 19 });
    expect(isBehindPlan(notStarted, undefined, 17)).toBe(true);
    expect(isBehindPlan(notStarted, undefined, 16)).toBe(false);
    expect(isBehindPlan(notStarted, { actualStartWeek: 16, actualPoc: 5 }, 17)).toBe(false);
  });

  it('is never behind before the plan has started', () => {
    expect(isBehindPlan(row(), undefined, 0)).toBe(false);
  });
});
