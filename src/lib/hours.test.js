import { describe, expect, it } from 'vitest';
import { formatHours, STATUS_LABELS } from './hours';

describe('hours', () => {
  it('formats hours with a thousands separator and at most one decimal', () => {
    expect(formatHours(0)).toBe('0h');
    expect(formatHours(217.44)).toBe('217.4h');
    expect(formatHours(1234)).toBe('1,234h');
  });

  it('has a label for each of the four statuses', () => {
    expect(Object.keys(STATUS_LABELS).sort()).toEqual(['full', 'partial', 'unstaffed', 'unused']);
  });
});
