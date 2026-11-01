import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonthsToDate,
  allocatedHoursOn,
  allocationByMonth,
  allocationPercentOf,
  extendDeployments,
  isSeatDeployment,
  monthlySeries,
  referenceDayOf,
  utilizationPercentOf,
} from './forecast';

const dep = (positionCode, percentage, start, end, over = {}) => ({ positionCode, allocationPercentage: percentage, start, end, positionName: 'Consultant', ...over });

describe('dates', () => {
  it('looks at today for the current month and the first day for any other month', () => {
    expect(referenceDayOf('2026-11', '2026-11-15')).toBe('2026-11-15');
    expect(referenceDayOf('2026-12', '2026-11-15')).toBe('2026-12-01');
    expect(referenceDayOf('2026-10', '2026-11-15')).toBe('2026-10-01');
  });

  it('adds days across a month and year end', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-11-15', 90)).toBe('2027-02-13');
  });

  it('adds months and stops at the end of a shorter month', () => {
    expect(addMonthsToDate('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonthsToDate('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonthsToDate('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonthsToDate('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonthsToDate('2026-03-31', 12)).toBe('2027-03-31');
  });
});

describe('allocatedHoursOn', () => {
  const rows = [dep('P1', 100, '2026-01-01', '2026-12-31'), dep('P2', 50, '2026-01-01', '2026-06-30'), dep('P2', 80, '2026-01-01', '2026-06-30')];

  it('counts a deployment on its first and last day only', () => {
    expect(allocatedHoursOn(rows, '2026-01-01')).toBe(160 + 160);
    expect(allocatedHoursOn(rows, '2026-06-30')).toBe(160 + 160);
    expect(allocatedHoursOn(rows, '2026-07-01')).toBe(160);
    expect(allocatedHoursOn(rows, '2025-12-31')).toBe(0);
  });

  it('never gives one seat more than one person’s hours', () => {
    expect(allocatedHoursOn([dep('P2', 50, '2026-01-01', '2026-06-30'), dep('P2', 80, '2026-01-01', '2026-06-30')], '2026-02-01')).toBe(160);
  });

  it('gives a part allocation its share of 160', () => {
    expect(allocatedHoursOn([dep('P1', 25, '2026-01-01', '2026-12-31')], '2026-05-01')).toBe(40);
    expect(allocatedHoursOn([], '2026-05-01')).toBe(0);
  });
});

describe('extendDeployments', () => {
  const rows = [dep('P1', 100, '2026-01-01', '2026-12-10'), dep('P2', 100, '2026-01-01', '2026-11-14'), dep('P3', 100, '2026-01-01', '2027-06-30')];

  it('moves only the ends inside the window, today and the last day included', () => {
    const extended = extendDeployments([...rows, dep('P4', 100, '2026-01-01', '2026-11-15'), dep('P5', 100, '2026-01-01', '2027-02-13'), dep('P6', 100, '2026-01-01', '2027-02-14')], '2026-11-15', { withinDays: 90, months: 3 });
    expect(extended.map((d) => d.end)).toEqual(['2027-03-10', '2026-11-14', '2027-06-30', '2026-11-15'.replace('2026-11-15', '2027-02-15'), '2027-05-13', '2027-02-14']);
  });

  it('returns the same list when nothing is extended', () => {
    expect(extendDeployments(rows, '2026-11-15', { withinDays: 90, months: 0 })).toBe(rows);
  });

  it('does not change the original deployments', () => {
    extendDeployments(rows, '2026-11-15', { withinDays: 90, months: 3 });
    expect(rows[0].end).toBe('2026-12-10');
  });
});

describe('series', () => {
  const seats = [
    { month: '2026-11', departmentName: 'A', availableHours: 160, allocatedHours: 160, utilizedHours: 80 },
    { month: '2026-11', departmentName: 'B', availableHours: 160, allocatedHours: 0, utilizedHours: 0 },
    { month: '2026-12', departmentName: 'A', availableHours: 160, allocatedHours: 80, utilizedHours: 80 },
  ];

  it('works out the allocation percentage of each month from the seats and the deployments', () => {
    const rows = allocationByMonth(seats, [dep('P1', 100, '2026-01-01', '2026-11-30')], ['2026-11', '2026-12'], '2026-11-15');
    expect(rows.map((r) => [r.label, r.available, r.allocated, r.percent])).toEqual([['Nov 26', 320, 160, 50], ['Dec 26', 160, 0, 0]]);
  });

  it('gives one line per group, and one line for everything when there is no field', () => {
    const grouped = monthlySeries(seats, ['2026-11', '2026-12'], 'departmentName', allocationPercentOf);
    expect(grouped.names).toEqual(['A', 'B']);
    expect(grouped.data[0]).toMatchObject({ label: 'Nov 26', A: 100, B: 0 });
    expect(grouped.data[1].B).toBeNull();
    const all = monthlySeries(seats, ['2026-11'], null, allocationPercentOf);
    expect(all.names).toEqual(['All seats']);
    expect(all.data[0]['All seats']).toBe(50);
  });

  it('leaves a month with no hours blank instead of 0 percent', () => {
    expect(allocationPercentOf([])).toBeNull();
    expect(utilizationPercentOf([{ allocatedHours: 0, utilizedHours: 0 }])).toBeNull();
    expect(utilizationPercentOf([{ allocatedHours: 160, utilizedHours: 40 }])).toBe(25);
  });

  it('counts only Consultant and Lead Consultant deployments as seats', () => {
    expect(isSeatDeployment({ positionName: 'Lead Consultant' })).toBe(true);
    expect(isSeatDeployment({ positionName: 'Module Lead' })).toBe(false);
  });
});
