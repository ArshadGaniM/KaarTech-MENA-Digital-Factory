import { describe, expect, it } from 'vitest';
import { currentMonth, formatMonth, shiftMonth } from './months';

describe('months', () => {
  it('formats the current month as YYYY-MM with a zero-padded month', () => {
    expect(currentMonth(new Date(2026, 0, 15))).toBe('2026-01');
    expect(currentMonth(new Date(2026, 9, 30))).toBe('2026-10');
  });

  it('shifts across year boundaries in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-10', 0)).toBe('2026-10');
  });

  it('names the month in words', () => {
    expect(formatMonth('2026-10')).toBe('October 2026');
  });
});
