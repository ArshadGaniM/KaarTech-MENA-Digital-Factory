import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCrossFilters } from './useCrossFilters';

const NONE = { a: null, b: null };

describe('useCrossFilters', () => {
  it('starts with the initial picks and no retries', () => {
    const { result } = renderHook(() => useCrossFilters(NONE));

    expect(result.current.filters).toBe(NONE);
    expect(result.current.retries).toBe(0);
  });

  it('picks a value, and picking the same value again removes it', () => {
    const { result } = renderHook(() => useCrossFilters(NONE));

    act(() => result.current.toggle('a', 'x'));
    expect(result.current.filters).toEqual({ a: 'x', b: null });

    act(() => result.current.toggle('a', 'x'));
    expect(result.current.filters).toEqual({ a: null, b: null });
  });

  it('picking another value replaces the first', () => {
    const { result } = renderHook(() => useCrossFilters(NONE));

    act(() => result.current.toggle('a', 'x'));
    act(() => result.current.toggle('a', 'y'));

    expect(result.current.filters.a).toBe('y');
  });

  it('clears one pick and leaves the others', () => {
    const { result } = renderHook(() => useCrossFilters(NONE));
    act(() => result.current.toggle('a', 'x'));
    act(() => result.current.toggle('b', 'y'));

    act(() => result.current.clear('a'));

    expect(result.current.filters).toEqual({ a: null, b: 'y' });
  });

  it('clears every pick back to the initial object', () => {
    const { result } = renderHook(() => useCrossFilters(NONE));
    act(() => result.current.toggle('a', 'x'));
    act(() => result.current.toggle('b', 'y'));

    act(() => result.current.clearAll());

    expect(result.current.filters).toBe(NONE);
  });

  it('counts retries upward, so each one changes the value', () => {
    const { result } = renderHook(() => useCrossFilters(NONE));

    act(() => result.current.retry());
    act(() => result.current.retry());

    expect(result.current.retries).toBe(2);
  });
});
