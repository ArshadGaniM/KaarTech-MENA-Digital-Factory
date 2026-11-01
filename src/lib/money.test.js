import { describe, expect, it } from 'vitest';
import { formatDay, formatUsd } from './money';

describe('formatUsd', () => {
  it('formats a monthly cost in US dollars', () => {
    expect(formatUsd(2375)).toBe('$2,375.00');
    expect(formatUsd(383.06)).toBe('$383.06');
    expect(formatUsd(0)).toBe('$0.00');
  });

  it('shows a dash when there is no figure', () => {
    expect(formatUsd(null)).toBe('—');
    expect(formatUsd(undefined)).toBe('—');
  });
});

describe('formatDay', () => {
  it('shows a calendar day without moving it by time zone', () => {
    expect(formatDay('2026-12-05')).toBe('5 Dec 2026');
    expect(formatDay('2027-01-01')).toBe('1 Jan 2027');
  });
});
