import { describe, expect, it } from 'vitest';
import {
  addMonths,
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
  seatsByMonth,
  toCsv,
  topWithOther,
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

  it('adds months across a year boundary in both directions', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-01', -2)).toBe('2025-11');
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
