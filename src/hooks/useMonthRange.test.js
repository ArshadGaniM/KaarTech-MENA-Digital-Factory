import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMonthRange } from './useMonthRange';

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 15) }));
afterEach(() => vi.useRealTimers());

describe('useMonthRange', () => {
  it('starts two months back to six ahead, focused on the current month', () => {
    const { result } = renderHook(() => useMonthRange());

    expect(result.current).toMatchObject({ base: '2026-11', from: '2026-09', to: '2027-05', focus: '2026-11' });
  });

  it('drags To along when From moves past it, and From when To moves before it', () => {
    const { result } = renderHook(() => useMonthRange());

    act(() => result.current.setFrom('2027-08'));
    expect([result.current.from, result.current.to]).toEqual(['2027-08', '2027-08']);

    act(() => result.current.setTo('2026-01'));
    expect([result.current.from, result.current.to]).toEqual(['2026-01', '2026-01']);
  });

  it('keeps the focus month inside the range and returns to the choice when the range allows it', () => {
    const { result } = renderHook(() => useMonthRange());

    act(() => result.current.setFrom('2027-01'));
    expect(result.current.focus).toBe('2027-01');

    act(() => result.current.setFrom('2026-09'));
    expect(result.current.focus).toBe('2026-11');

    act(() => result.current.setFocus('2027-03'));
    expect(result.current.focus).toBe('2027-03');
  });
});
