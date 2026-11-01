import { describe, expect, it } from 'vitest';
import {
  allocationBucket,
  applyFilters,
  applyFiltersExcept,
  average,
  countBy,
  countListBy,
  crossTab,
  histogram,
  labelOf,
  monthLabel,
  percent,
  percentBands,
  seatTotalsBy,
  seatTree,
  seatsByMonth,
  toCsv,
  topWithOther,
  monthCoverage,
  monthEndDay,
  monthsFromTo,
  overlapsMonth,
  spanDays,
  teamLabel,
} from './analyticsData';

const people = [
  { region: 'MENA', locationType: 'Offshore', skills: ['FI', 'MM', 'FI'] },
  { region: 'MENA', locationType: 'Onsite', skills: ['FI'] },
  { region: null, locationType: 'Offshore', skills: [] },
];

describe('filters', () => {
  it('keeps rows matching every set filter and treats an empty value as "Not set"', () => {
    expect(applyFilters(people, { region: 'MENA', locationType: 'Offshore' })).toHaveLength(1);
    expect(applyFilters(people, { region: 'Not set' })).toEqual([people[2]]);
    expect(labelOf('')).toBe('Not set');
    expect(applyFilters(people, { region: null })).toBe(people);
  });

  it('leaves out only the named field, so a chart keeps all its own slices', () => {
    const rows = applyFiltersExcept(people, { region: 'MENA', locationType: 'Offshore' }, 'region');
    expect(rows).toHaveLength(2);
  });
});

describe('counting', () => {
  it('counts by field, biggest first, ties by name', () => {
    expect(countBy(people, 'region')).toEqual([
      { name: 'MENA', value: 2 },
      { name: 'Not set', value: 1 },
    ]);
  });

  it('counts a list value once per person', () => {
    expect(countListBy(people, 'skills')).toEqual([
      { name: 'FI', value: 2 },
      { name: 'MM', value: 1 },
    ]);
  });

  it('adds the rest up as Other and adds nothing when the list is short', () => {
    const entries = [{ name: 'a', value: 5 }, { name: 'b', value: 3 }, { name: 'c', value: 2 }];
    expect(topWithOther(entries, 1)).toEqual([{ name: 'a', value: 5 }, { name: 'Other', value: 5 }]);
    expect(topWithOther(entries, 3)).toBe(entries);
  });
});

describe('allocation buckets', () => {
  it('puts exactly 100 in full, above it in over, between in partial and nothing in none', () => {
    expect([0, 40, 100, 100.5, undefined].map(allocationBucket)).toEqual(['none', 'partial', 'full', 'over', 'none']);
  });
});

describe('histogram', () => {
  it('uses equal bands, keeps empty bands in the middle and ignores missing values', () => {
    expect(histogram([0.5, 1.5, 6.2, null], 2)).toEqual([
      { from: 0, to: 2, label: '0-2', value: 2 },
      { from: 2, to: 4, label: '2-4', value: 0 },
      { from: 4, to: 6, label: '4-6', value: 0 },
      { from: 6, to: 8, label: '6-8', value: 1 },
    ]);
    expect(histogram([], 2)).toEqual([]);
    expect(histogram([1], 0)).toEqual([]);
  });

  it('percent bands include their upper end, so 100 sits in the top band', () => {
    expect(percentBands([100, 100, 40], 25, false)).toEqual([
      { label: '1-25', value: 0 },
      { label: '26-50', value: 1 },
      { label: '51-75', value: 0 },
      { label: '76-100', value: 2 },
    ]);
    expect(percentBands([0, 0, 100], 50, true)).toEqual([
      { label: '0', value: 2 },
      { label: '1-50', value: 0 },
      { label: '51-100', value: 1 },
    ]);
    expect(percentBands([0, 0], 50, false)).toEqual([]);
  });
});

describe('crossTab', () => {
  it('counts each pair and limits rows and columns to the biggest', () => {
    const grid = crossTab(people, 'region', 'locationType', 1, 2);
    expect(grid.rowNames).toEqual(['MENA']);
    expect(grid.colNames).toEqual(['Offshore', 'Onsite']);
    expect(grid.cell('MENA', 'Onsite')).toBe(1);
    expect(grid.cell('MENA', 'Nowhere')).toBe(0);
  });
});

describe('numbers and months', () => {
  it('averages numbers only, and gives null when there are none', () => {
    expect(average([2, null, 4])).toBe(3);
    expect(average([null])).toBeNull();
  });

  it('works out a percentage with one decimal and 0 for an empty whole', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(5, 0)).toBe(0);
  });

  it('labels a month in short form', () => {
    expect(monthLabel('2026-11')).toBe('Nov 26');
  });
});

const seats = [
  { month: '2026-11', departmentName: 'A', filled: true, availableHours: 160, allocatedHours: 160, utilizedHours: 80 },
  { month: '2026-11', departmentName: 'A', filled: false, availableHours: 160, allocatedHours: 0, utilizedHours: 0 },
  { month: '2026-10', departmentName: 'B', filled: true, availableHours: 160, allocatedHours: 80, utilizedHours: 80 },
];

describe('seat totals', () => {
  it('sums hours per month in month order, with allocation and utilization percentages', () => {
    const [october, november] = seatsByMonth(seats);
    expect(october.month).toBe('2026-10');
    expect(november).toMatchObject({ seats: 2, filled: 1, available: 320, allocated: 160, utilized: 80, vacant: 160, allocationPercent: 50, utilizationPercent: 50 });
  });

  it('sums per value of a field, with vacant seats and fill rate', () => {
    const a = seatTotalsBy(seats, 'departmentName').find((entry) => entry.name === 'A');
    expect(a).toMatchObject({ seats: 2, vacantSeats: 1, fillPercent: 50, allocationPercent: 50 });
  });
});

describe('toCsv', () => {
  it('quotes commas and quotes, and defuses cells a spreadsheet would run as a formula', () => {
    expect(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['=1+1', null]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n\'=1+1,');
  });
});

describe('seatTree', () => {
  const seat = (department, team, kind, allocatedHours) => ({ departmentName: department, team, positionName: kind, availableHours: 160, allocatedHours });
  const rows = [
    seat('Design', 'T1', 'Consultant', 160),
    seat('Design', 'T1', 'Lead Consultant', 80),
    seat('Design', 'T2', 'Consultant', 40),
    seat('Audit', 'T3', 'Consultant', 0),
    seat(null, 'T4', 'Consultant', 10.04),
  ];

  it('leaves out seats with no hours and gives every parent the sum of its children', () => {
    const tree = seatTree(rows, 'allocated', (i) => `fill${i}`);

    expect(tree.children.map((department) => department.name)).toEqual(['Design', 'Not set']);
    expect(tree.children[0].value).toBe(280);
    expect(tree.children[0].children.map((team) => [team.name, team.value])).toEqual([['T1', 240], ['T2', 40]]);
    expect(tree.value).toBe(290);
    expect(tree.children[1].value).toBe(10);
  });

  it('measures vacant hours as available minus allocated', () => {
    const tree = seatTree(rows, 'vacant', () => 'x');

    expect(tree.children.find((department) => department.name === 'Audit').value).toBe(160);
    expect(tree.children.find((department) => department.name === 'Design').children[0].children.map((leaf) => leaf.value)).toEqual([80]);
  });

  it('names each leaf with its team so two teams with the same seat type never share a name, and colours by department', () => {
    const tree = seatTree(rows, 'allocated', (i) => `fill${i}`);
    const leaves = tree.children.flatMap((department) => department.children.flatMap((team) => team.children));

    expect(new Set(leaves.map((leaf) => leaf.name)).size).toBe(leaves.length);
    expect(leaves[0]).toMatchObject({ name: 'Consultant (T1)', kind: 'Consultant', fill: 'fill0' });
  });

  it('is an empty tree with a zero total when no seat has hours', () => {
    expect(seatTree([], 'allocated', () => 'x')).toMatchObject({ children: [], value: 0 });
  });
});

describe('assignment dates', () => {
  it('finds the last day of any month, including February in a leap year', () => {
    expect(monthEndDay('2026-11')).toBe('2026-11-30');
    expect(monthEndDay('2028-02')).toBe('2028-02-29');
    expect(monthEndDay('2026-12')).toBe('2026-12-31');
  });

  it('counts the days of a span with both ends included', () => {
    expect(spanDays('2026-01-01', '2026-01-01')).toBe(1);
    expect(spanDays('2026-01-01', '2026-12-31')).toBe(365);
  });

  it('tells whether an assignment touches a month, including its first and last day', () => {
    const assignment = { start: '2026-10-31', end: '2026-12-01' };
    expect(overlapsMonth(assignment, '2026-10')).toBe(true);
    expect(overlapsMonth(assignment, '2026-12')).toBe(true);
    expect(overlapsMonth(assignment, '2026-09')).toBe(false);
    expect(overlapsMonth(assignment, '2027-01')).toBe(false);
  });

  it('works out the share of a month covered, counting overlapping days once', () => {
    const half = [{ start: '2026-11-01', end: '2026-11-15' }, { start: '2026-11-10', end: '2026-11-15' }];
    expect(monthCoverage(half, '2026-11')).toBe(50);
    expect(monthCoverage([{ start: '2026-01-01', end: '2026-12-31' }], '2026-11')).toBe(100);
    expect(monthCoverage([], '2026-11')).toBe(0);
    expect(monthCoverage([{ start: '2026-12-01', end: '2026-12-31' }], '2026-11')).toBe(0);
  });

  it('lists months across a year boundary', () => {
    expect(monthsFromTo('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(monthsFromTo('2027-01', '2026-11')).toEqual([]);
  });

  it('labels a team by code, adding its name only when it differs', () => {
    expect(teamLabel('TEAM-1', 'TEAM-1')).toBe('TEAM-1');
    expect(teamLabel('TEAM-1', 'Support')).toBe('Support (TEAM-1)');
    expect(teamLabel('TEAM-1', null)).toBe('TEAM-1');
  });
});
